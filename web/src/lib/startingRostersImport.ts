import type { PlayerSearchResult } from '../types';
import type { LeagueWorkspace } from './leagueWorkspace';
import { matchScreenshotPlayers, type ScreenshotPlayer } from './screenshotImport';
import { activeSlotCapacities } from './acquisitionAnalysis';
import { canPositionsFillSlot } from './rosterEligibility';

const RESERVE_SLOTS = new Set(['IR', 'IR+', 'IL', 'IL+', 'NA']);

/**
 * Your best lineup from a roster: Yahoo's Starting Rosters page shows one day's lineup,
 * so stars whose team is off that day sit on the bench and spots stay empty. Players in
 * IR and NA stay there; everyone else is seated best first (by points per game) in every
 * lineup spot they can fill, and the rest go to the bench. Players are moved between
 * spots when that lets a better player start (an augmenting path), so no spot is left
 * empty that someone on the bench could fill.
 */
export function bestLineupSlots(workspace: LeagueWorkspace, players: Array<{ id: string; positions: string[]; value: number; slot: string }>): Map<string, string> {
  const units = Object.entries(activeSlotCapacities(workspace)).flatMap(([slot, count]) => Array.from({ length: count }, () => slot));
  const seated: Array<number | null> = units.map(() => null);
  const result = new Map<string, string>();
  const candidates = players.filter((player) => !RESERVE_SLOTS.has(player.slot.toUpperCase())).sort((a, b) => b.value - a.value);
  const seat = (index: number, visited: boolean[]): boolean => {
    for (let unit = 0; unit < units.length; unit += 1) {
      if (visited[unit] || !canPositionsFillSlot(candidates[index].positions, units[unit])) continue;
      visited[unit] = true;
      const occupant = seated[unit];
      if (occupant === null || seat(occupant, visited)) { seated[unit] = index; return true; }
    }
    return false;
  };
  candidates.forEach((_, index) => { seat(index, units.map(() => false)); });
  players.forEach((player) => { if (RESERVE_SLOTS.has(player.slot.toUpperCase())) result.set(player.id, player.slot); });
  seated.forEach((index, unit) => { if (index !== null) result.set(candidates[index].id, units[unit]); });
  candidates.forEach((player) => { if (!result.has(player.id)) result.set(player.id, 'BN'); });
  return result;
}

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
const DAY_MS = 86_400_000;

/** League rosters pasted in the last three days: recent enough to trust over availability checks. */
export function rostersAreFresh(workspace: LeagueWorkspace, now = Date.now()): boolean {
  const rosters = workspace.leagueRosters;
  return Boolean(rosters?.teams.length) && now - new Date(rosters!.updatedAt).getTime() <= 3 * DAY_MS;
}

/** Dropped from a team in the last three days, so probably still on waivers. */
export function likelyOnWaivers(workspace: LeagueWorkspace, playerId: string, now = Date.now()): boolean {
  const bare = playerId.replace(/^nhl:/, '');
  return Boolean(workspace.leagueRosters?.recentlyDropped?.some((entry) => entry.playerId.replace(/^nhl:/, '') === bare && now - new Date(entry.droppedAt).getTime() <= 3 * DAY_MS));
}

export function applyStartingRosters(workspace: LeagueWorkspace, matches: StartingRosterMatch[], teams: StartingRosterTeam[], myTeam: string, now: string, updateMyRoster = true): LeagueWorkspace {
  const opponent = workspace.leagueRosters?.opponent;
  // Anyone on a team last time and on none now was just dropped; keep earlier drops for a week.
  const nowMs = new Date(now).getTime();
  const rostered = new Set(matches.map((match) => match.player.id.replace(/^nhl:/, '')));
  const before = new Set((workspace.leagueRosters?.teams ?? []).flatMap((team) => team.playerIds.map((id) => id.replace(/^nhl:/, ''))));
  const recentlyDropped = [
    ...(workspace.leagueRosters?.recentlyDropped ?? []).filter((entry) => !rostered.has(entry.playerId.replace(/^nhl:/, '')) && !before.has(entry.playerId.replace(/^nhl:/, '')) && nowMs - new Date(entry.droppedAt).getTime() <= 7 * DAY_MS),
    ...[...before].filter((id) => !rostered.has(id)).map((id) => ({ playerId: `nhl:${id}`, droppedAt: now })),
  ];
  const bare = (id: string) => id.replace(/^nhl:/, '');
  const previous = new Map(workspace.roster.map((entry) => [bare(entry.playerId), entry]));
  const mine = matches.filter((match) => match.fantasyTeam === myTeam);
  const lineup = bestLineupSlots(workspace, mine.map(({ player, row }) => ({ id: player.id, positions: player.pos, value: player.blendedFppg ?? 0, slot: row.slot })));
  const roster = updateMyRoster && mine.length
    ? mine.map(({ player, row }) => {
      const kept = previous.get(bare(player.id));
      return {
        ...(kept ?? { keeper: false, protected: false, undroppable: false }),
        playerId: kept?.playerId ?? player.id,
        fullName: player.name,
        team: player.team,
        positions: player.pos,
        slot: lineup.get(player.id) ?? row.slot,
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
      ...(recentlyDropped.length ? { recentlyDropped } : {}),
      ...(opponent && teams.some((team) => team.name === opponent.name) ? { opponent } : {}),
    },
    updatedAt: now,
  };
}
