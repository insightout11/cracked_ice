import { describe, expect, it } from 'vitest';
import type { PlayerProjection } from './coachSchemas';
import { getLeagueFppg, getPlayerProjection, offNightStarts, startedPoints } from './playerProjection';

const projection = { iceScore: 5.5 } as PlayerProjection;

describe('getPlayerProjection', () => {
  it('matches prefixed player IDs to numeric projection keys', () => {
    expect(getPlayerProjection({ '8483495': projection }, 'nhl:8483495')).toBe(projection);
  });

  it('matches numeric player IDs to prefixed projection keys', () => {
    expect(getPlayerProjection({ 'nhl:8483495': projection }, '8483495')).toBe(projection);
  });
});

describe('getLeagueFppg', () => {
  it('prefers a projection recalculated with current league settings', () => {
    expect(getLeagueFppg(
      { seasonFppg: 3.5 },
      { ...projection, fppg: 2.34 },
    )).toBe(2.34);
  });

  it('uses the hydrated league split until a projection is available', () => {
    expect(getLeagueFppg({ seasonFppg: 3.5 })).toBe(3.5);
  });
});

// A bench player: four team games, two of them off-nights, started only on the off-nights.
const game = (isOffNight: boolean) => ({ opponent: 'TOR', isHome: true, isOffNight, startTime: '' });
const benchPlayer = {
  fppg: 2.5,
  starts: 2,
  gamesAvailable: 4,
  projectedPoints: 10,
  offNightRate: 0.5,
  strengthOfSchedule: 5,
  gamesByDate: {
    '2026-10-12': game(true),
    '2026-10-13': game(false),
    '2026-10-15': game(true),
    '2026-10-17': game(false),
  },
  startsByDate: { '2026-10-12': 1, '2026-10-15': 1 },
} as PlayerProjection;

describe('offNightStarts', () => {
  it('counts simulated starts on off-night dates rather than applying the all-games rate', () => {
    expect(offNightStarts(benchPlayer)).toBe(2);
    expect(benchPlayer.starts * benchPlayer.offNightRate).toBe(1);
  });

  it('falls back to starts × off-night rate without per-date data', () => {
    expect(offNightStarts({ ...benchPlayer, startsByDate: undefined })).toBe(1);
    expect(offNightStarts(undefined)).toBe(0);
  });
});

describe('startedPoints', () => {
  it('scores only started games, not every team game', () => {
    expect(startedPoints(benchPlayer)).toBe(5);
    expect(benchPlayer.projectedPoints).toBe(10);
    expect(startedPoints(undefined)).toBe(0);
  });
});
