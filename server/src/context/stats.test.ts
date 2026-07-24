import { describe, expect, it } from 'vitest';
import { normalizeGoalieStats } from './stats';

describe('normalizeGoalieStats', () => {
  it('repairs missing saves, save percentage, and GAA from NHL cache totals', () => {
    const normalized = normalizeGoalieStats({
      wins: 30,
      losses: 20,
      overtimeLosses: 4,
      gamesPlayed: 56,
      gamesStarted: 55,
      saves: 0,
      shotsAgainst: 1513,
      goalsAgainst: 169,
      savePct: 0,
      gaa: 0,
      shutouts: 0,
      toi: '3267:56',
    });

    expect(normalized?.saves).toBe(1344);
    expect(normalized?.savePct).toBeCloseTo(0.8883, 4);
    expect(normalized?.gaa).toBeCloseTo(3.1029, 4);
  });

  it('preserves authoritative non-zero NHL values', () => {
    const normalized = normalizeGoalieStats({
      wins: 1,
      losses: 0,
      overtimeLosses: 0,
      gamesPlayed: 1,
      gamesStarted: 1,
      saves: 31,
      shotsAgainst: 32,
      goalsAgainst: 1,
      savePct: 0.96875,
      gaa: 1.01,
      shutouts: 0,
      toi: '59:24',
    });

    expect(normalized?.saves).toBe(31);
    expect(normalized?.savePct).toBe(0.96875);
    expect(normalized?.gaa).toBe(1.01);
  });
});
