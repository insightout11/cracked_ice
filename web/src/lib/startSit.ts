import type { RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace } from './leagueWorkspace';
import { bestDailyLineup, isOut } from './weekPlanner';

export interface StartSitGame {
  date: string;
  opponent: string;
  isHome: boolean;
  startTime?: string;
  isOffNight?: boolean;
}

export interface StartSitContender {
  /** A, B, C… so replies can be one letter. */
  letter: string;
  player: RosterPlayer;
  game: StartSitGame;
  fppg: number;
  /** His team's games in that matchup week, this one included. */
  weekGames: number;
  /** Whether the best lineup (by FPPG) benches him. */
  suggestedSit: boolean;
}

/** One decision: players who can take each other's lineup spots, more of them than spots. */
export interface StartSitGroup {
  /** Who's in it: forwards, defence, goalies or skaters. */
  label: 'forwards' | 'defence' | 'goalies' | 'skaters';
  contenders: StartSitContender[];
  /** How many of the contenders sit, and how many start. */
  sits: number;
  spots: number;
}

export interface StartSitDecision {
  date: string;
  /** Separate decisions that night (at D, at RW…), the most crowded first. */
  groups: StartSitGroup[];
  sits: number;
  /** Starters not in any decision, locked into the lineup. */
  locked: RosterPlayer[];
}

type Schedule = Record<string, StartSitGame[]>;
const LETTERS = 'ABCDEFGH';
/** Most players shown per decision: the benched ones plus their weakest rivals. */
const MAX_CONTENDERS = 4;
const FORWARD = new Set(['C', 'LW', 'RW', 'F', 'W']);
const kind = (player: RosterPlayer) => {
  const positions = player.positions.map((position) => position.toUpperCase());
  if (positions.every((position) => position === 'G')) return 'goalies';
  return positions.some((position) => FORWARD.has(position)) ? (positions.includes('D') ? 'skaters' : 'forwards') : 'defence';
};
const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const onIr = (player: RosterPlayer) => player.current_slot?.toUpperCase().startsWith('IR') === true;

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function weekOf(date: string, weekStartIndex: number): { start: string; end: string } {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -((weekday - weekStartIndex + 7) % 7));
  return { start, end: addDays(start, 6) };
}

/** Healthy roster players (not injured, not on IR) with a game that night. */
function playingOn(roster: RosterPlayer[], schedule: Schedule, date: string): Array<{ player: RosterPlayer; game: StartSitGame }> {
  return roster.flatMap((player) => {
    if (isOut(player) || onIr(player)) return [];
    const game = schedule[player.team]?.find((item) => item.date === date);
    return game ? [{ player, game }] : [];
  });
}

/**
 * A night's start/sit decisions. The best lineup (by FPPG) benches some players; a
 * starter is a rival of a benched player when swapping them still fills the lineup.
 * Players linked that way form one decision (at RW, at D…), so a ballot never asks a
 * winger to take a defenceman's spot. Null when everyone playing fits.
 */
export function startSitDecision(workspace: LeagueWorkspace, roster: RosterPlayer[], schedule: Schedule, date: string, fppgOf: (player: RosterPlayer) => number): StartSitDecision | null {
  const playing = playingOn(roster, schedule, date);
  const players = playing.map((item) => item.player);
  const best = bestDailyLineup(workspace, players, fppgOf);
  const startedIds = new Set(best.started.map((player) => normalizeId(player.id)));
  const benched = players.filter((player) => !startedIds.has(normalizeId(player.id)));
  if (!benched.length) return null;

  const fills = (lineup: RosterPlayer[]) => bestDailyLineup(workspace, lineup, fppgOf).started.length === lineup.length;
  const rivals = new Map(benched.map((sitter) => [sitter, best.started.filter((starter) => fills([...best.started.filter((player) => player !== starter), sitter]))]));

  // Group benched players that share a rival: one decision each.
  const groups: Array<{ benched: RosterPlayer[]; rivals: Set<RosterPlayer> }> = [];
  benched.forEach((sitter) => {
    const mine = new Set(rivals.get(sitter));
    const joined = groups.filter((group) => [...mine].some((rival) => group.rivals.has(rival)));
    const merged = { benched: [sitter, ...joined.flatMap((group) => group.benched)], rivals: new Set([...mine, ...joined.flatMap((group) => [...group.rivals])]) };
    joined.forEach((group) => groups.splice(groups.indexOf(group), 1));
    groups.push(merged);
  });

  const { start, end } = weekOf(date, { sunday: 0, monday: 1, saturday: 6 }[workspace.schedule.matchupWeekStart]);
  const gameOf = new Map(playing.map(({ player, game }) => [player, game]));
  const inAnyDecision = new Set<RosterPlayer>();
  const built = groups
    .filter((group) => group.rivals.size > 0)
    .map((group): StartSitGroup => {
      const sitters = [...group.benched].sort((a, b) => fppgOf(b) - fppgOf(a)).slice(0, MAX_CONTENDERS - 1);
      const shownRivals = [...group.rivals].sort((a, b) => fppgOf(a) - fppgOf(b)).slice(0, Math.max(1, MAX_CONTENDERS - sitters.length));
      const inRunning = [...sitters, ...shownRivals];
      inRunning.forEach((player) => inAnyDecision.add(player));
      const contenders = inRunning
        .sort((a, b) => fppgOf(b) - fppgOf(a))
        .map((player, index): StartSitContender => ({
          letter: LETTERS[index],
          player,
          game: gameOf.get(player) as StartSitGame,
          fppg: fppgOf(player),
          weekGames: (schedule[player.team] ?? []).filter((item) => item.date >= start && item.date <= end).length,
          suggestedSit: sitters.includes(player),
        }));
      const kinds = new Set(inRunning.map(kind));
      const label = kinds.size === 1 ? [...kinds][0] : 'skaters';
      return { label, contenders, sits: sitters.length, spots: contenders.length - sitters.length };
    })
    .sort((a, b) => b.contenders.length - a.contenders.length || b.sits - a.sits);
  if (!built.length) return null;
  return {
    date,
    groups: built,
    sits: built.reduce((sum, group) => sum + group.sits, 0),
    locked: best.started.filter((player) => !inAnyDecision.has(player)),
  };
}

/** Nights from `from` over `days` days when someone has to sit, with how many. */
export function busyNights(workspace: LeagueWorkspace, roster: RosterPlayer[], schedule: Schedule, from: string, days: number, fppgOf: (player: RosterPlayer) => number): Array<{ date: string; sits: number }> {
  return Array.from({ length: days }, (_, index) => addDays(from, index)).flatMap((date) => {
    const decision = startSitDecision(workspace, roster, schedule, date, fppgOf);
    return decision ? [{ date, sits: decision.sits }] : [];
  });
}

const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const gameTime = (startTime?: string) => (startTime?.includes('T') ? new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

/** One decision as plain text, for comment threads and chats that don't take images. */
export function startSitText(date: string, group: StartSitGroup, { showPick = false, credit = true }: { showPick?: boolean; credit?: boolean } = {}): string {
  const lines = [`Start/sit, ${shortDate(date)} (${group.label}): ${group.contenders.length} players, ${group.sits} ${group.sits === 1 ? 'sits' : 'sit'}`];
  group.contenders.forEach((contender) => {
    const time = gameTime(contender.game.startTime);
    const matchup = `${contender.player.team} ${contender.game.isHome ? 'vs' : '@'} ${contender.game.opponent}${time ? `, ${time}` : ''}`;
    lines.push(`${contender.letter}) ${contender.player.full_name} (${matchup}): ${contender.fppg.toFixed(2)} pts/game, ${contender.weekGames} game${contender.weekGames === 1 ? '' : 's'} this week${contender.game.isOffNight ? ', off-night' : ''}`);
  });
  lines.push(group.sits === 1 ? 'Who sits?' : `Which ${group.sits} sit?`);
  if (showPick) lines.push(`My tool says sit ${group.contenders.filter((contender) => contender.suggestedSit).map((contender) => contender.letter).join(' + ')}.`);
  if (credit) lines.push('(via crackedicehockey.com)');
  return lines.join('\n');
}
