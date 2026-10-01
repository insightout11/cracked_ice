/**
 * NHL schedule math for the ChatGPT plugin (api/mcp.ts): which teams play when, off-nights,
 * streaming windows, schedule pairings, fantasy playoff schedules, and whether a roster's
 * games fit a lineup. Public NHL data only: the season schedule file and the NHL player
 * directory. No league, roster or availability data, and nothing sourced from Yahoo.
 *
 * Definitions match the site: an off-night has 8 or fewer NHL games, a packed night 13 or
 * more; teams rank 60% on games and 40% on the share of them on off-nights (web/src/lib/schedule.ts).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SEASON } from './season.js';

export const OFF_NIGHT_MAX_GAMES = 8;
export const PACKED_NIGHT_MIN_GAMES = 13;
export const SITE = 'https://www.crackedicehockey.com';
export const MAX_WINDOW_DAYS = 45;

export const TEAMS: Record<string, { name: string; city: string; nickname: string }> = {
  ANA: { name: 'Anaheim Ducks', city: 'Anaheim', nickname: 'Ducks' },
  BOS: { name: 'Boston Bruins', city: 'Boston', nickname: 'Bruins' },
  BUF: { name: 'Buffalo Sabres', city: 'Buffalo', nickname: 'Sabres' },
  CAR: { name: 'Carolina Hurricanes', city: 'Carolina', nickname: 'Hurricanes' },
  CBJ: { name: 'Columbus Blue Jackets', city: 'Columbus', nickname: 'Blue Jackets' },
  CGY: { name: 'Calgary Flames', city: 'Calgary', nickname: 'Flames' },
  CHI: { name: 'Chicago Blackhawks', city: 'Chicago', nickname: 'Blackhawks' },
  COL: { name: 'Colorado Avalanche', city: 'Colorado', nickname: 'Avalanche' },
  DAL: { name: 'Dallas Stars', city: 'Dallas', nickname: 'Stars' },
  DET: { name: 'Detroit Red Wings', city: 'Detroit', nickname: 'Red Wings' },
  EDM: { name: 'Edmonton Oilers', city: 'Edmonton', nickname: 'Oilers' },
  FLA: { name: 'Florida Panthers', city: 'Florida', nickname: 'Panthers' },
  LAK: { name: 'Los Angeles Kings', city: 'Los Angeles', nickname: 'Kings' },
  MIN: { name: 'Minnesota Wild', city: 'Minnesota', nickname: 'Wild' },
  MTL: { name: 'Montreal Canadiens', city: 'Montreal', nickname: 'Canadiens' },
  NJD: { name: 'New Jersey Devils', city: 'New Jersey', nickname: 'Devils' },
  NSH: { name: 'Nashville Predators', city: 'Nashville', nickname: 'Predators' },
  NYI: { name: 'New York Islanders', city: 'New York', nickname: 'Islanders' },
  NYR: { name: 'New York Rangers', city: 'New York', nickname: 'Rangers' },
  OTT: { name: 'Ottawa Senators', city: 'Ottawa', nickname: 'Senators' },
  PHI: { name: 'Philadelphia Flyers', city: 'Philadelphia', nickname: 'Flyers' },
  PIT: { name: 'Pittsburgh Penguins', city: 'Pittsburgh', nickname: 'Penguins' },
  SEA: { name: 'Seattle Kraken', city: 'Seattle', nickname: 'Kraken' },
  SJS: { name: 'San Jose Sharks', city: 'San Jose', nickname: 'Sharks' },
  STL: { name: 'St. Louis Blues', city: 'St. Louis', nickname: 'Blues' },
  TBL: { name: 'Tampa Bay Lightning', city: 'Tampa Bay', nickname: 'Lightning' },
  TOR: { name: 'Toronto Maple Leafs', city: 'Toronto', nickname: 'Maple Leafs' },
  UTA: { name: 'Utah Mammoth', city: 'Utah', nickname: 'Mammoth' },
  VAN: { name: 'Vancouver Canucks', city: 'Vancouver', nickname: 'Canucks' },
  VGK: { name: 'Vegas Golden Knights', city: 'Vegas', nickname: 'Golden Knights' },
  WPG: { name: 'Winnipeg Jets', city: 'Winnipeg', nickname: 'Jets' },
  WSH: { name: 'Washington Capitals', city: 'Washington', nickname: 'Capitals' },
};

export interface ScheduleGame { date: string; opponent: string | null; isHome: boolean; gameId: number; startTime: string | null; isOffNight?: boolean }
export interface SeasonSchedule { season: string; games: Record<string, ScheduleGame[]>; lastRefreshed?: string }
export interface DirectoryPlayer { id: string; name: string; team: string; pos: string[]; aliases?: string[] }

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

function dataFile(name: string): string {
  const candidates = [join(process.cwd(), 'data', name), join(process.cwd(), '..', 'data', name)];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Missing data/${name}`);
  return found;
}

let scheduleCache: SeasonSchedule | null = null;
let playerCache: DirectoryPlayer[] | null = null;

export function loadSchedule(): SeasonSchedule {
  scheduleCache ??= JSON.parse(readFileSync(dataFile(SEASON.scheduleFile), 'utf8')) as SeasonSchedule;
  return scheduleCache;
}

export function loadPlayers(): DirectoryPlayer[] {
  // data/players.json is the NHL roster directory (names, teams, NHL positions).
  playerCache ??= (JSON.parse(readFileSync(dataFile('players.json'), 'utf8')) as { players: DirectoryPlayer[] }).players;
  return playerCache;
}

// ---------------------------------------------------------------------------------------------
// Dates (fantasy weeks run Monday to Sunday; dates are NHL game dates, Eastern)
// ---------------------------------------------------------------------------------------------

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

const dayLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
export const weekday = (date: string) => dayLabel(date, { weekday: 'short' });
export const shortDate = (date: string) => dayLabel(date, { weekday: 'short', month: 'short', day: 'numeric' });

/** Today's date in Eastern time: the NHL's game-date calendar. */
export function todayEastern(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** "7:00 PM ET" for a UTC start time. */
export function easternTime(startTime: string | null): string | null {
  if (!startTime) return null;
  return `${new Date(startTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date window inside the season. A missing start means today (or opening night before the
 * season starts); windows are capped at MAX_WINDOW_DAYS and clipped to the regular season.
 */
export function resolveWindow(input: { start?: string; days?: number; end?: string }, now = new Date()): { start: string; end: string; days: number } {
  const seasonStart = SEASON.regularSeasonStart;
  const seasonEnd = SEASON.regularSeasonEnd;
  if (input.start && !ISO_DATE.test(input.start)) throw new Error('Dates must be YYYY-MM-DD.');
  if (input.end && !ISO_DATE.test(input.end)) throw new Error('Dates must be YYYY-MM-DD.');
  let start = input.start ?? todayEastern(now);
  if (start < seasonStart) start = seasonStart;
  if (start > seasonEnd) throw new Error(`The ${SEASON.label} regular season ends ${seasonEnd}.`);
  const requestedDays = Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.round(input.days ?? 7)));
  let end = input.end ?? addDays(start, requestedDays - 1);
  if (end < start) throw new Error('The end date is before the start date.');
  if (end > addDays(start, MAX_WINDOW_DAYS - 1)) end = addDays(start, MAX_WINDOW_DAYS - 1);
  if (end > seasonEnd) end = seasonEnd;
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
  return { start, end, days };
}

export function resolveTeam(query: string): string | null {
  const text = query.trim().toLowerCase().replace(/[.]/g, '');
  if (!text) return null;
  const upper = text.toUpperCase();
  const aliases: Record<string, string> = { LA: 'LAK', SJ: 'SJS', TB: 'TBL', NJ: 'NJD', WAS: 'WSH', MON: 'MTL', LV: 'VGK', VEG: 'VGK', ARI: 'UTA', UTAH: 'UTA' };
  if (TEAMS[upper]) return upper;
  if (aliases[upper]) return aliases[upper];
  const matches = Object.entries(TEAMS).filter(([, team]) => {
    const full = team.name.toLowerCase().replace(/[.]/g, '');
    return full === text || team.nickname.toLowerCase() === text || full.includes(text) || text.includes(team.nickname.toLowerCase());
  });
  return matches.length === 1 ? matches[0][0] : null;
}

// ---------------------------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------------------------

export interface Night { date: string; weekday: string; games: number; kind: 'off-night' | 'packed' | 'normal' | 'no games' }
export interface TeamWindow {
  team: string;
  name: string;
  games: number;
  offNightGames: number;
  dates: string[];
  backToBacks: string[][];
  score: number;
}

function teamGamesBetween(schedule: SeasonSchedule, team: string, start: string, end: string): ScheduleGame[] {
  return (schedule.games[team] ?? []).filter((game) => game.date >= start && game.date <= end).sort((a, b) => a.date.localeCompare(b.date));
}

export function nightsBetween(schedule: SeasonSchedule, start: string, end: string): Night[] {
  const counts = new Map<string, Set<number>>();
  for (const games of Object.values(schedule.games)) {
    for (const game of games) {
      if (game.date < start || game.date > end) continue;
      if (!counts.has(game.date)) counts.set(game.date, new Set());
      counts.get(game.date)!.add(game.gameId);
    }
  }
  const nights: Night[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const games = counts.get(date)?.size ?? 0;
    const kind = games === 0 ? 'no games' : games <= OFF_NIGHT_MAX_GAMES ? 'off-night' : games >= PACKED_NIGHT_MIN_GAMES ? 'packed' : 'normal';
    nights.push({ date, weekday: weekday(date), games, kind });
  }
  return nights;
}

/** Every team's games in the window, best schedules first (the site's "Best Schedule First" sort). */
export function teamsBetween(schedule: SeasonSchedule, start: string, end: string): TeamWindow[] {
  const offNights = new Set(nightsBetween(schedule, start, end).filter((night) => night.kind === 'off-night').map((night) => night.date));
  const teams = Object.keys(schedule.games).map((team) => {
    const dates = teamGamesBetween(schedule, team, start, end).map((game) => game.date);
    const backToBacks = dates.filter((date, index) => index > 0 && dates[index - 1] === addDays(date, -1)).map((date) => [addDays(date, -1), date]);
    return { team, name: TEAMS[team]?.name ?? team, games: dates.length, offNightGames: dates.filter((date) => offNights.has(date)).length, dates, backToBacks, score: 0 };
  });
  const maxGames = Math.max(1, ...teams.map((team) => team.games));
  for (const team of teams) {
    team.score = Number(((team.games / maxGames) * 60 + (team.games ? (team.offNightGames / team.games) * 40 : 0)).toFixed(1));
  }
  return teams.sort((a, b) => b.score - a.score || b.games - a.games || a.team.localeCompare(b.team));
}

export function weekSummary(schedule: SeasonSchedule, weekOf: string) {
  const start = mondayOf(weekOf);
  const end = addDays(start, 6);
  const nights = nightsBetween(schedule, start, end);
  const teams = teamsBetween(schedule, start, end);
  return {
    weekStart: start,
    weekEnd: end,
    totalGames: nights.reduce((sum, night) => sum + night.games, 0),
    nights,
    offNights: nights.filter((night) => night.kind === 'off-night').map((night) => night.date),
    packedNights: nights.filter((night) => night.kind === 'packed').map((night) => night.date),
    fourGameTeams: teams.filter((team) => team.games >= 4).map((team) => team.team),
    twoOrFewerGameTeams: teams.filter((team) => team.games <= 2).map((team) => team.team),
    teams,
  };
}

export function teamSchedule(schedule: SeasonSchedule, team: string, start: string, end: string) {
  const nightKinds = new Map(nightsBetween(schedule, start, end).map((night) => [night.date, night]));
  const games = teamGamesBetween(schedule, team, start, end);
  const dates = games.map((game) => game.date);
  return games.map((game, index) => ({
    date: game.date,
    weekday: weekday(game.date),
    opponent: game.opponent,
    opponentName: game.opponent ? TEAMS[game.opponent]?.name ?? game.opponent : null,
    home: game.isHome,
    startTimeEastern: easternTime(game.startTime),
    leagueGamesThatNight: nightKinds.get(game.date)?.games ?? 0,
    offNight: nightKinds.get(game.date)?.kind === 'off-night',
    backToBack: index > 0 && dates[index - 1] === addDays(game.date, -1),
  }));
}

/**
 * Two-team pairings covering the most nights with the fewest same-night clashes. With
 * `team`, only pairings that include it: "who complements my Canucks?"
 */
export function schedulePairs(schedule: SeasonSchedule, start: string, end: string, team: string | null, count = 8) {
  const offNights = new Set(nightsBetween(schedule, start, end).filter((night) => night.kind === 'off-night').map((night) => night.date));
  const datesOf = (code: string) => new Set(teamGamesBetween(schedule, code, start, end).map((game) => game.date));
  const codes = Object.keys(schedule.games).sort();
  const pairs: Array<{ teams: [string, string]; games: number; nightsCovered: number; clashes: number; offNightsCovered: number }> = [];
  for (let i = 0; i < codes.length; i += 1) {
    for (let j = i + 1; j < codes.length; j += 1) {
      if (team && codes[i] !== team && codes[j] !== team) continue;
      const a = datesOf(codes[i]);
      const b = datesOf(codes[j]);
      const covered = new Set([...a, ...b]);
      pairs.push({
        teams: [codes[i], codes[j]],
        games: a.size + b.size,
        nightsCovered: covered.size,
        clashes: [...a].filter((date) => b.has(date)).length,
        offNightsCovered: [...covered].filter((date) => offNights.has(date)).length,
      });
    }
  }
  return pairs
    .sort((x, y) => y.nightsCovered - x.nightsCovered || x.clashes - y.clashes || y.offNightsCovered - x.offNightsCovered || x.teams.join().localeCompare(y.teams.join()))
    .slice(0, count)
    .map((pair) => {
      // Lead with the requested team, so "Canucks + X" reads naturally.
      const ordered = team && pair.teams[1] === team ? [pair.teams[1], pair.teams[0]] as [string, string] : pair.teams;
      return { ...pair, teams: ordered, names: ordered.map((code) => TEAMS[code]?.name ?? code) };
    });
}

// ---------------------------------------------------------------------------------------------
// Roster check
// ---------------------------------------------------------------------------------------------

// The site's Yahoo standard preset (server/src/features/coach/presets.ts), without the bench.
export const DEFAULT_LINEUP = { C: 2, LW: 2, RW: 2, UTIL: 2, D: 4, G: 2 } as const;
export type LineupSlots = Partial<Record<'C' | 'LW' | 'RW' | 'F' | 'D' | 'UTIL' | 'G', number>>;

const normalizeName = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface RosterMatch { input: string; player?: DirectoryPlayer; candidates?: Array<{ name: string; team: string; pos: string[] }> }

/**
 * Names to NHL players. "Elias Pettersson (VAN, C)" style hints pick between namesakes; an
 * unknown or ambiguous name comes back with candidates instead of a guess.
 */
export function matchPlayers(inputs: string[], players: DirectoryPlayer[] = loadPlayers()): RosterMatch[] {
  const byName = new Map<string, DirectoryPlayer[]>();
  for (const player of players) {
    for (const name of [player.name, ...(player.aliases ?? [])]) {
      const key = normalizeName(name);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), player]);
    }
  }
  return inputs.map((raw) => {
    const input = raw.trim();
    // Hints only in parentheses or after a comma: hyphens belong to names (Marc-Andre Fleury).
    const hintMatch = input.match(/\s*(?:\(([^)]*)\)|,\s*([^,]*))\s*$/);
    const hint = hintMatch ? (hintMatch[1] ?? hintMatch[2] ?? '') : '';
    const hintTokens = hint.toUpperCase().split(/[\s,/]+/).filter(Boolean);
    const teamHint = hintTokens.map((token) => resolveTeam(token)).find(Boolean) ?? null;
    const positionHint = hintTokens.filter((token) => ['C', 'LW', 'RW', 'D', 'G'].includes(token));
    const name = hintMatch ? input.slice(0, input.length - hintMatch[0].length).trim() : input;
    let found = [...new Set(byName.get(normalizeName(name)) ?? [])];
    if (!found.length) {
      // A unique surname is enough ("Pettersson" is not; "Demko" is).
      const surname = normalizeName(name.split(/\s+/).pop() ?? '');
      found = players.filter((player) => normalizeName(player.name.split(/\s+/).pop() ?? '') === surname);
      if (found.length > 1 && !teamHint && !positionHint.length) {
        return { input, candidates: found.slice(0, 6).map((player) => ({ name: player.name, team: player.team, pos: player.pos })) };
      }
    }
    // A team hint picks between namesakes; it doesn't discard a player who has since changed teams.
    if (teamHint && found.some((player) => player.team === teamHint)) found = found.filter((player) => player.team === teamHint);
    if (positionHint.length && found.length > 1) found = found.filter((player) => player.pos.some((pos) => positionHint.includes(pos)));
    if (found.length === 1) return { input, player: found[0] };
    return { input, candidates: found.slice(0, 6).map((player) => ({ name: player.name, team: player.team, pos: player.pos })) };
  });
}

const fits = (slot: string, positions: string[]) =>
  slot === 'UTIL' ? positions.some((pos) => pos !== 'G')
    : slot === 'F' ? positions.some((pos) => pos === 'C' || pos === 'LW' || pos === 'RW')
      : positions.includes(slot);

/** The most of these players one lineup can start (bipartite matching over slot seats). */
export function maxStarters(positionsList: string[][], slots: LineupSlots): { started: number[]; benched: number[] } {
  const seats = Object.entries(slots).flatMap(([slot, count]) => Array.from({ length: Math.max(0, count ?? 0) }, () => slot));
  const seatOwner = new Array<number>(seats.length).fill(-1);
  const tryPlace = (player: number, seen: boolean[]): boolean => {
    for (let seat = 0; seat < seats.length; seat += 1) {
      if (seen[seat] || !fits(seats[seat], positionsList[player])) continue;
      seen[seat] = true;
      if (seatOwner[seat] === -1 || tryPlace(seatOwner[seat], seen)) { seatOwner[seat] = player; return true; }
    }
    return false;
  };
  // Single-position players first, so flexible ones take the leftover seats.
  const order = positionsList.map((_, index) => index).sort((a, b) => positionsList[a].length - positionsList[b].length);
  const started: number[] = [];
  const benched: number[] = [];
  for (const player of order) (tryPlace(player, new Array(seats.length).fill(false)) ? started : benched).push(player);
  return { started: started.sort((a, b) => a - b), benched: benched.sort((a, b) => a - b) };
}

/**
 * Night by night: which of these players play, how many a lineup can start, how many games
 * are stuck on the bench, and how many seats sit empty (room to stream). It counts games,
 * not fantasy points: who to bench on a crowded night is the manager's call.
 */
export function rosterCheck(schedule: SeasonSchedule, roster: DirectoryPlayer[], slots: LineupSlots, start: string, end: string) {
  const nights = nightsBetween(schedule, start, end);
  const playing = new Map(roster.map((player) => [player.id, new Set(teamGamesBetween(schedule, player.team, start, end).map((game) => game.date))]));
  const seatCount = Object.values(slots).reduce((sum, count) => sum + Math.max(0, count ?? 0), 0);
  const perNight = nights.map((night) => {
    const tonight = roster.filter((player) => playing.get(player.id)!.has(night.date));
    const { started, benched } = maxStarters(tonight.map((player) => player.pos), slots);
    return {
      date: night.date,
      weekday: night.weekday,
      leagueGames: night.games,
      offNight: night.kind === 'off-night',
      playing: tonight.map((player) => player.name),
      canStart: started.length,
      benchedGames: benched.length,
      benchedCandidates: benched.map((index) => tonight[index].name),
      emptySeats: seatCount - started.length,
    };
  });
  const perPlayer = roster.map((player) => {
    const dates = [...playing.get(player.id)!].sort();
    const crowded = perNight.filter((night) => night.benchedGames > 0 && night.playing.includes(player.name)).length;
    return { name: player.name, team: player.team, positions: player.pos, games: dates.length, offNightGames: dates.filter((date) => nights.find((night) => night.date === date)?.kind === 'off-night').length, gamesOnCrowdedNights: crowded };
  });
  const totalGames = perNight.reduce((sum, night) => sum + night.playing.length, 0);
  const benchedGames = perNight.reduce((sum, night) => sum + night.benchedGames, 0);
  return {
    totals: { games: totalGames, usableGames: totalGames - benchedGames, benchedGames, emptySeatNights: perNight.reduce((sum, night) => sum + night.emptySeats, 0) },
    perNight,
    perPlayer,
    bestNightsToStream: perNight.filter((night) => night.leagueGames > 0 && night.emptySeats > 0).sort((a, b) => b.emptySeats - a.emptySeats || a.leagueGames - b.leagueGames).slice(0, 4).map((night) => ({ date: night.date, weekday: night.weekday, emptySeats: night.emptySeats, leagueGames: night.leagueGames })),
  };
}
