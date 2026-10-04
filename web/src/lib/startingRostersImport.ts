import type { PlayerSearchResult } from '../types';
import type { LeagueWorkspace } from './leagueWorkspace';
import { matchScreenshotPlayers, type ScreenshotPlayer } from './screenshotImport';

/** One filled lineup spot on Yahoo's Starting Rosters page. */
export interface StartingRosterPlayer {
  slot: string;
  name: string;
  team: string;
  positions: string[];
  /** Yahoo's status tag after the name (DTD, IR, NA, …), or null. */
  status: string | null;
}

export interface StartingRosterTeam {
  name: string;
  players: StartingRosterPlayer[];
}

const SLOT = /^(C|LW|RW|F|W|D|G|Util|BN|IR\+?|IL\+?|NA)$/;
const EMPTY = /^(--empty--|\(Empty\))$/i;
const TEAM_POSITION = /^([A-Za-z]{2,4})\s+-\s+((?:C|LW|RW|D|G|F|W|Util)(?:\s*,\s*(?:C|LW|RW|D|G|F|W|Util))*)$/;
const STATUS = /^(DTD|IR-LT|IR-NR|IR\+?|NA|O|SUSP)/;
const NAME = /^[\p{L}\p{M} .'’-]{2,40}$/u;

/** Yahoo's league link ("…/hockey/15713/…") or a bare league number, as the league id. */
export function yahooLeagueIdFrom(text: string): string | null {
  const trimmed = text.trim();
  const fromLink = trimmed.match(/fantasysports\.yahoo\.com\/(?:hockey|nhl)\/(\d{1,9})(?:[/?#]|$)/i);
  if (fromLink) return fromLink[1];
  return /^\d{1,9}$/.test(trimmed) ? trimmed : null;
}

export const yahooStartingRostersUrl = (leagueId: string) => `https://hockey.fantasysports.yahoo.com/hockey/${encodeURIComponent(leagueId)}/startingrosters`;

/**
 * Reads text copied from Yahoo's Starting Rosters page (select all, copy). Each team is
 * its name, then "Pos" and "Player" headings, then one entry per lineup spot: the slot
 * ("C", "BN", "IR+", …), the player's name, the name again with Yahoo's status and note
 * ("Brad MarchandIRPlayer Note"), then "TEAM - POS", sometimes followed by last night's
 * result. Empty spots read "--empty--". Yahoo's icons (private-use characters) are dropped.
 */
export function parseYahooStartingRosters(text: string): StartingRosterTeam[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\p{Co}/gu, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const teams: StartingRosterTeam[] = [];
  let current: StartingRosterTeam | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (lines[index + 1] === 'Pos' && lines[index + 2] === 'Player') {
      current = { name: line.slice(0, 60), players: [] };
      teams.push(current);
      index += 2;
      continue;
    }
    if (!current || !SLOT.test(line)) continue;
    const name = lines[index + 1] ?? '';
    if (EMPTY.test(name)) continue;
    const tagged = lines[index + 2] ?? '';
    const teamPosition = (lines[index + 3] ?? '').match(TEAM_POSITION);
    if (!NAME.test(name) || !tagged.startsWith(name) || !teamPosition) continue;
    const status = tagged.slice(name.length).match(STATUS)?.[1] ?? null;
    current.players.push({
      slot: line,
      name,
      team: teamPosition[1].toUpperCase(),
      positions: teamPosition[2].split(',').map((position) => position.trim().toUpperCase()),
      status,
    });
    index += 3;
  }
  return teams.filter((team) => team.players.length > 0);
}

export interface StartingRosterMatch {
  player: PlayerSearchResult;
  row: StartingRosterPlayer;
  fantasyTeam: string;
}

export function matchStartingRosters(directory: PlayerSearchResult[], teams: StartingRosterTeam[]): { matched: StartingRosterMatch[]; unmatched: StartingRosterPlayer[] } {
  const rows = teams.flatMap((team) => team.players.map((row) => ({ row, fantasyTeam: team.name })));
  const reads: ScreenshotPlayer[] = rows.map(({ row }) => ({ name: row.name, team: row.team, positions: row.positions, status: 'unknown', waiverDate: null }));
  const { matched } = matchScreenshotPlayers(directory, reads);
  const byRead = new Map(matched.map((match) => [match.read, match.player]));
  const result: StartingRosterMatch[] = [];
  const unmatched: StartingRosterPlayer[] = [];
  rows.forEach(({ row, fantasyTeam }, index) => {
    const player = byRead.get(reads[index]);
    if (player) result.push({ player, row, fantasyTeam });
    else unmatched.push(row);
  });
  return { matched: result, unmatched };
}

/** The pasted team that is the manager's: the one named like their team, or the one marked theirs before. */
export function guessMyStartingRosterTeam(workspace: LeagueWorkspace, teams: StartingRosterTeam[]): string | null {
  const norm = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
  const known = [workspace.fantasyTeam?.name, workspace.leagueRosters?.teams.find((team) => team.mine)?.name].filter((name): name is string => Boolean(name?.trim()));
  return teams.find((team) => known.some((name) => norm(name) === norm(team.name)))?.name ?? null;
}

/**
 * Replaces every team's roster with the pasted one, so the league is exactly as Yahoo
 * shows it now (no replaying adds and drops). With `updateMyRoster`, your own saved
 * roster becomes your Yahoo lineup, slots included, keeping your keeper and
 * do-not-drop marks for players still on it.
 */
export function applyStartingRosters(workspace: LeagueWorkspace, matches: StartingRosterMatch[], teams: StartingRosterTeam[], myTeam: string, now: string, updateMyRoster = true): LeagueWorkspace {
  const opponent = workspace.leagueRosters?.opponent;
  const bare = (id: string) => id.replace(/^nhl:/, '');
  const previous = new Map(workspace.roster.map((entry) => [bare(entry.playerId), entry]));
  const mine = matches.filter((match) => match.fantasyTeam === myTeam);
  const roster = updateMyRoster && mine.length
    ? mine.map(({ player, row }) => {
      const kept = previous.get(bare(player.id));
      return {
        ...(kept ?? { keeper: false, protected: false, undroppable: false }),
        playerId: kept?.playerId ?? player.id,
        fullName: player.name,
        team: player.team,
        positions: player.pos,
        slot: row.slot,
      };
    })
    : workspace.roster;
  return {
    ...workspace,
    numberOfTeams: teams.length >= 2 && teams.length <= 32 ? teams.length : workspace.numberOfTeams,
    fantasyTeam: workspace.fantasyTeam?.name ? workspace.fantasyTeam : { ...workspace.fantasyTeam, name: myTeam },
    roster,
    leagueRosters: {
      teams: teams.map((team) => ({
        name: team.name,
        mine: team.name === myTeam,
        playerIds: matches.filter((match) => match.fantasyTeam === team.name).map((match) => match.player.id),
      })),
      updatedAt: now,
      ...(opponent && teams.some((team) => team.name === opponent.name) ? { opponent } : {}),
    },
    updatedAt: now,
  };
}
