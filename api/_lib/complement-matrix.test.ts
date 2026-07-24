import { describe, expect, it } from 'vitest';
import { calculateComplementMatrix } from './complement-matrix.js';
import type { ScheduleContext } from './schedule.js';

const context: ScheduleContext = {
  sets: new Map([
    ['ANA', new Set(['2026-10-05', '2026-10-07'])],
    ['BOS', new Set(['2026-10-07', '2026-10-08'])],
    ['CAR', new Set(['2026-10-09'])],
  ]),
  teamNameMap: new Map([
    ['ANA', 'Anaheim Ducks'],
    ['BOS', 'Boston Bruins'],
    ['CAR', 'Carolina Hurricanes'],
  ]),
};

describe('calculateComplementMatrix', () => {
  it('precomputes symmetric pair cells in one response', () => {
    const response = calculateComplementMatrix(context, '2026-10-05', '2026-10-09');

    expect(response.teams.map((team) => team.code)).toEqual(['ANA', 'BOS', 'CAR']);
    expect(response.cells.ANA.BOS).toEqual({
      sharedNights: 1,
      usableStarts: 3,
      separateGames: 2,
      offNightShare: 0.667,
    });
    expect(response.cells.BOS.ANA).toEqual(response.cells.ANA.BOS);
    expect(response.cells.ANA.CAR).toMatchObject({ sharedNights: 0, usableStarts: 3 });
    expect(response.range).toEqual({ minSharedNights: 0, maxSharedNights: 1 });
  });

  it('respects the selected date window', () => {
    const response = calculateComplementMatrix(context, '2026-10-07', '2026-10-08');

    expect(response.teams.find((team) => team.code === 'ANA')?.games).toBe(1);
    expect(response.cells.ANA.BOS).toMatchObject({ sharedNights: 1, usableStarts: 2 });
  });
});
