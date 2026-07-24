import { filterDatesByRange, OFF_NIGHTS, weekdayOf } from './dates';
import type { ScheduleContext } from './schedule';

export interface ComplementMatrixCell {
  sharedNights: number;
  usableStarts: number;
  separateGames: number;
  offNightShare: number;
}

export interface ComplementMatrixResponse {
  start: string;
  end: string;
  metric: 'sharedNights';
  teams: Array<{ code: string; name: string; games: number }>;
  cells: Record<string, Record<string, ComplementMatrixCell>>;
  range: { minSharedNights: number; maxSharedNights: number };
}

export function calculateComplementMatrix(
  scheduleContext: ScheduleContext,
  start: string,
  end: string
): ComplementMatrixResponse {
  const codes = [...scheduleContext.sets.keys()].sort();
  const schedules = new Map(codes.map((code) => [
    code,
    filterDatesByRange(scheduleContext.sets.get(code) ?? new Set<string>(), start, end),
  ]));
  const cells: ComplementMatrixResponse['cells'] = Object.fromEntries(codes.map((code) => [code, {}]));
  let minSharedNights = Number.POSITIVE_INFINITY;
  let maxSharedNights = 0;

  for (let row = 0; row < codes.length; row += 1) {
    for (let column = row + 1; column < codes.length; column += 1) {
      const first = codes[row];
      const second = codes[column];
      const firstDates = schedules.get(first) ?? new Set<string>();
      const secondDates = schedules.get(second) ?? new Set<string>();
      const sharedNights = [...firstDates].filter((date) => secondDates.has(date)).length;
      const uniqueDates = new Set([...firstDates, ...secondDates]);
      const offNights = [...uniqueDates].filter((date) => OFF_NIGHTS.has(weekdayOf(date))).length;
      const cell: ComplementMatrixCell = {
        sharedNights,
        usableStarts: uniqueDates.size,
        separateGames: firstDates.size + secondDates.size - (sharedNights * 2),
        offNightShare: uniqueDates.size ? Math.round((offNights / uniqueDates.size) * 1000) / 1000 : 0,
      };
      cells[first][second] = cell;
      cells[second][first] = cell;
      minSharedNights = Math.min(minSharedNights, sharedNights);
      maxSharedNights = Math.max(maxSharedNights, sharedNights);
    }
  }

  return {
    start,
    end,
    metric: 'sharedNights',
    teams: codes.map((code) => ({
      code,
      name: scheduleContext.teamNameMap.get(code) ?? code,
      games: schedules.get(code)?.size ?? 0,
    })),
    cells,
    range: {
      minSharedNights: Number.isFinite(minSharedNights) ? minSharedNights : 0,
      maxSharedNights,
    },
  };
}
