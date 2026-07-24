import { describe, expect, it } from 'vitest';
import type { PlayerProjection } from './coachSchemas';
import { getLeagueFppg, getPlayerProjection } from './playerProjection';

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
