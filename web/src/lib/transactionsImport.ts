import type { PlayerSearchResult } from '../types';
import type { LeagueWorkspace } from './leagueWorkspace';
import { matchScreenshotPlayers, waiverDateFrom, type ScreenshotPlayer } from './screenshotImport';

export interface TransactionMove {
  name: string;
  team: string;
  positions: string[];
  kind: 'add' | 'drop' | 'unknown';
  /** The movement line as Yahoo shows it ("Free Agent", "To Waivers", …). */
  detail: string;
}

/** One entry on Yahoo's Transactions page: a fantasy team's moves at one time. */
export interface Transaction {
  fantasyTeam: string;
  date: string;
  /** Minutes after midnight, for ordering same-day entries. */
  minute: number;
  moves: TransactionMove[];
}

const PLAYER = /^(.+?)\s+([A-Za-z]{2,4})\s+-\s+((?:C|LW|RW|D|G|F|W|Util)(?:\s*,\s*(?:C|LW|RW|D|G|F|W|Util))*)$/;
const WHEN = /^([A-Z][a-z]{2})[a-z]*\s+(\d{1,2}),\s*(\d{1,2}):(\d{2})\s*([ap]m)$/i;
const ADDED_FROM = /^(Free Agents?|Waivers?)$/i;
const DROPPED_TO = /^To\s+(Waivers?|Free Agents?)$/i;
const NOISE = /^(logo|Open chat|Transactions|Recent Transactions|All Teams|All Transactions|Added Players|Dropped Players|Trades|FAB Offers)$/i;

/**
 * Reads text copied from Yahoo's league Transactions page (select all, copy). Each
 * entry lists its players, each followed by where he came from ("Free Agent",
 * "Waivers": added) or went ("To Waivers": dropped), then the fantasy team and the
 * time. Entries are returned oldest first, ready to replay. Movement lines we don't
 * recognise (trades) come back as 'unknown' rather than guessed.
 */
export function parseYahooTransactions(text: string, today: string): Transaction[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\p{Co}/gu, '').replace(/\s+/g, ' ').trim()).filter((line) => line && !NOISE.test(line));
  const entries: Transaction[] = [];
  let moves: TransactionMove[] = [];
  let pending: Omit<TransactionMove, 'kind' | 'detail'> | null = null;
  let loose: string[] = [];
  lines.forEach((line) => {
    const player = line.match(PLAYER);
    const when = line.match(WHEN);
    if (player && /^[\p{L}\p{M} .'’-]{2,40}$/u.test(player[1])) {
      pending = { name: player[1].trim(), team: player[2].toUpperCase(), positions: player[3].split(',').map((position) => position.trim().toUpperCase()) };
      loose = [];
      return;
    }
    if (pending) {
      const kind = ADDED_FROM.test(line) ? 'add' : DROPPED_TO.test(line) ? 'drop' : 'unknown';
      moves.push({ ...pending, kind, detail: line });
      pending = null;
      return;
    }
    if (when) {
      const date = waiverDateFrom(when[1], when[2], today);
      const fantasyTeam = loose[loose.length - 1];
      if (date && fantasyTeam && moves.length) {
        const hour = Number(when[3]) % 12 + (when[5].toLowerCase() === 'pm' ? 12 : 0);
        entries.push({ fantasyTeam: fantasyTeam.slice(0, 60), date: date > today ? shiftYear(date, -1) : date, minute: hour * 60 + Number(when[4]), moves });
      }
      moves = [];
      loose = [];
      return;
    }
    loose.push(line);
  });
  // Yahoo lists newest first; replay oldest first.
  return entries.reverse().sort((a, b) => a.date.localeCompare(b.date) || a.minute - b.minute);
}

/** Transaction dates are in the past: "Dec 30" read in January belongs to last year. */
function shiftYear(date: string, years: number): string {
  return `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
}

export interface TransactionReplay {
  workspace: LeagueWorkspace;
  applied: number;
  /** Your own team's net moves (the last move per player wins), to mirror on your roster. */
  mine: { added: PlayerSearchResult[]; dropped: PlayerSearchResult[] };
  unknownTeams: string[];
  unmatched: string[];
  unreadable: TransactionMove[];
}

/**
 * Replays transactions on the league rosters, oldest first: an add moves the player
 * to that team (off any other), a drop takes him off. Replaying the same entries
 * again changes nothing, so the page can be pasted as often as you like.
 */
export function applyTransactions(workspace: LeagueWorkspace, directory: PlayerSearchResult[], transactions: Transaction[], now: string): TransactionReplay {
  const rosters = workspace.leagueRosters;
  const empty: TransactionReplay = { workspace, applied: 0, mine: { added: [], dropped: [] }, unknownTeams: [], unmatched: [], unreadable: [] };
  if (!rosters) return empty;
  const names = new Set(rosters.teams.map((team) => team.name));
  const unknownTeams = [...new Set(transactions.map((entry) => entry.fantasyTeam).filter((name) => !names.has(name)))];
  const known = transactions.filter((entry) => names.has(entry.fantasyTeam));
  const moves = known.flatMap((entry) => entry.moves.map((move) => ({ entry, move })));
  // Match each distinct player once (the matcher uses a player only once per batch).
  const keyOf = (move: TransactionMove) => `${move.name.toLowerCase()}|${move.team}`;
  const reads = [...new Map(moves.map(({ move }) => [keyOf(move), { name: move.name, team: move.team, positions: move.positions, status: 'unknown', waiverDate: null } as ScreenshotPlayer])).entries()];
  const { matched } = matchScreenshotPlayers(directory, reads.map(([, read]) => read));
  const playerByRead = new Map(matched.map((match) => [match.read, match.player]));
  const playerByKey = new Map(reads.map(([key, read]) => [key, playerByRead.get(read)]));
  const teams = rosters.teams.map((team) => ({ ...team, playerIds: [...team.playerIds] }));
  const bare = (id: string) => id.replace(/^nhl:/, '');
  const takeOff = (playerId: string) => teams.forEach((team) => { team.playerIds = team.playerIds.filter((id) => bare(id) !== bare(playerId)); });
  const myTeam = teams.find((team) => team.mine)?.name;
  const myMoves = new Map<string, { player: PlayerSearchResult; kind: 'add' | 'drop' }>();
  const unmatched: string[] = [];
  const unreadable: TransactionMove[] = [];
  let applied = 0;
  moves.forEach(({ entry, move }) => {
    if (move.kind === 'unknown') { unreadable.push(move); return; }
    const player = playerByKey.get(keyOf(move));
    if (!player) { unmatched.push(move.name); return; }
    takeOff(player.id);
    if (move.kind === 'add') teams.find((team) => team.name === entry.fantasyTeam)?.playerIds.push(player.id);
    if (entry.fantasyTeam === myTeam) myMoves.set(bare(player.id), { player, kind: move.kind });
    applied += 1;
  });
  const net = [...myMoves.values()];
  const mine = { added: net.filter((move) => move.kind === 'add').map((move) => move.player), dropped: net.filter((move) => move.kind === 'drop').map((move) => move.player) };
  return {
    workspace: applied ? { ...workspace, leagueRosters: { ...rosters, teams, updatedAt: now }, updatedAt: now } : workspace,
    applied,
    mine,
    unknownTeams,
    unmatched: [...new Set(unmatched)],
    unreadable,
  };
}

/** Your own team's net adds (to the bench) and drops, mirrored on your saved roster. */
export function mirrorOnRoster(roster: LeagueWorkspace['roster'], mine: TransactionReplay['mine']): LeagueWorkspace['roster'] {
  const bare = (id: string) => id.replace(/^nhl:/, '');
  const dropped = new Set(mine.dropped.map((player) => bare(player.id)));
  const kept = roster.filter((entry) => !dropped.has(bare(entry.playerId)));
  const have = new Set(kept.map((entry) => bare(entry.playerId)));
  const added = mine.added
    .filter((player) => !have.has(bare(player.id)))
    .map((player) => ({ playerId: player.id, fullName: player.name, team: player.team, positions: player.pos, slot: 'BN', keeper: false, protected: false, undroppable: false }));
  return [...kept, ...added];
}
