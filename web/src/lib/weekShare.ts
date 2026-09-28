import type { RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace } from './leagueWorkspace';
import type { StartSitGame } from './startSit';
import { bestDailyLineup, isOut } from './weekPlanner';

export type WeekCell = 'start' | 'bench' | 'off-start' | null;

export interface WeekShareRow {
  player: RosterPlayer;
  /** Per day: starts, plays but the lineup is full, starts on an off-night, or no game. */
  cells: WeekCell[];
  games: number;
  starts: number;
}

export interface WeekShare {
  start: string;
  dates: string[];
  rows: WeekShareRow[];
  games: number;
  starts: number;
  offNightStarts: number;
  /** Nights someone playing has to sit. */
  busyNights: number;
}

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const onIr = (player: RosterPlayer) => player.current_slot?.toUpperCase().startsWith('IR') === true;
const isGoalie = (player: RosterPlayer) => player.positions.length > 0 && player.positions.every((position) => position.toUpperCase() === 'G');
const ORDER = ['C', 'LW', 'RW', 'D', 'G'];
const rank = (player: RosterPlayer) => Math.min(...player.positions.map((position) => { const index = ORDER.indexOf(position.toUpperCase()); return index < 0 ? ORDER.length : index; }));

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/**
 * The matchup week containing `date`, for the roster: each player's games, which of
 * them start in the best lineup that night, and the week's totals. Goalies' games are
 * shown but counted as starts only when the lineup would use them.
 */
export function weekShare(workspace: LeagueWorkspace, roster: RosterPlayer[], schedule: Record<string, StartSitGame[]>, date: string, fppgOf: (player: RosterPlayer) => number): WeekShare {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const startIndex = { sunday: 0, monday: 1, saturday: 6 }[workspace.schedule.matchupWeekStart];
  const start = addDays(date, -((weekday - startIndex + 7) % 7));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const healthy = roster.filter((player) => !isOut(player) && !onIr(player));
  const gameOn = (player: RosterPlayer, day: string) => schedule[player.team]?.find((game) => game.date === day);
  const startedByDay = dates.map((day) => new Set(bestDailyLineup(workspace, healthy.filter((player) => gameOn(player, day)), fppgOf).started.map((player) => normalizeId(player.id))));
  const rows = healthy
    .map((player): WeekShareRow => {
      const cells = dates.map((day, index): WeekCell => {
        const game = gameOn(player, day);
        if (!game) return null;
        if (!startedByDay[index].has(normalizeId(player.id))) return 'bench';
        return game.isOffNight ? 'off-start' : 'start';
      });
      return { player, cells, games: cells.filter(Boolean).length, starts: cells.filter((cell) => cell === 'start' || cell === 'off-start').length };
    })
    .sort((a, b) => Number(isGoalie(a.player)) - Number(isGoalie(b.player)) || rank(a.player) - rank(b.player) || b.starts - a.starts);
  return {
    start,
    dates,
    rows,
    games: rows.reduce((sum, row) => sum + row.games, 0),
    starts: rows.reduce((sum, row) => sum + row.starts, 0),
    offNightStarts: rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell === 'off-start').length, 0),
    busyNights: dates.filter((_, index) => rows.some((row) => row.cells[index] === 'bench')).length,
  };
}
