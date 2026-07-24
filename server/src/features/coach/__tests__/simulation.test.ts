import { describe, expect, it } from 'vitest';
import { simulateLineup } from '../simulation';
import type { PlayerProjection } from '../types';

const DAY_ONE = '2026-10-01';
const DAY_TWO = '2026-10-02';

function projection(
  id: string,
  position: string,
  fppg: number,
  games: string[] = [DAY_ONE],
  currentSlot = 'BN',
): PlayerProjection {
  return {
    base: {
      id,
      full_name: id,
      team: 'TBL',
      position,
      games_played: 82,
      stats: { goals: 0, assists: 0, shots_on_goal: 0, blocks: 0, power_play_points: 0 },
      upcoming_games: games,
      is_drop_eligible: true,
      tags: [],
      current_slot: currentSlot,
    },
    fppg,
    projectedPoints: fppg * games.length,
    upcomingGamesInWindow: games,
    offNightRate: 0,
    strengthOfSchedule: 5,
    iceScore: 5,
  };
}

describe('simulateLineup', () => {
  it('allocates the highest-value legal starters and sums fantasy points', () => {
    const result = simulateLineup(
      [projection('alpha', 'F', 7.45, [DAY_ONE, DAY_TWO]), projection('beta', 'F', 4, [DAY_ONE])],
      { start: DAY_ONE, end: DAY_TWO },
      { F: 1 },
    );

    expect(result.totalPoints).toBe(14.9);
    expect(result.startsByPlayer.get('alpha')).toBe(2);
    expect(result.startsByPlayer.get('beta')).toBeUndefined();
  });

  it('solves multi-position assignments exactly when a greedy tie would strand a teammate', () => {
    const result = simulateLineup(
      [projection('flexible', 'C/LW', 10), projection('center-only', 'C', 9), projection('wing-only', 'LW', 1)],
      { start: DAY_ONE, end: DAY_ONE },
      { C: 1, LW: 1, BN: 2 },
    );

    expect(result.totalPoints).toBe(19);
    expect(result.startRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'center-only', position: 'C' }),
      expect.objectContaining({ playerId: 'flexible', position: 'LW' }),
    ]));
    expect(result.unusedSlotsByDate.get(DAY_ONE)).toEqual({});
  });

  it('lets a bench player backfill after a starter is removed', () => {
    const roster = [projection('starter', 'C', 5, [DAY_ONE], 'C'), projection('bench', 'C', 3)];
    const baseline = simulateLineup(roster, { start: DAY_ONE, end: DAY_ONE }, { C: 1, BN: 1 });
    const withoutStarter = simulateLineup(roster.filter(({ base }) => base.id !== 'starter'), { start: DAY_ONE, end: DAY_ONE }, { C: 1, BN: 1 });

    expect(baseline.startsByPlayer.get('starter')).toBe(1);
    expect(withoutStarter.startsByPlayer.get('bench')).toBe(1);
    expect(withoutStarter.unusedSlotsByDate.get(DAY_ONE)).toEqual({});
  });

  it('excludes IR players from active lineup competition', () => {
    const result = simulateLineup(
      [projection('injured-star', 'C', 10, [DAY_ONE], 'IR'), projection('healthy-bench', 'C', 2)],
      { start: DAY_ONE, end: DAY_ONE },
      { C: 1, BN: 1, IR: 1 },
    );

    expect(result.totalPoints).toBe(2);
    expect(result.startsByPlayer.get('injured-star')).toBeUndefined();
    expect(result.startsByPlayer.get('healthy-bench')).toBe(1);
  });

  it('keeps goalies in goalie slots and skaters in utility slots', () => {
    const result = simulateLineup(
      [projection('goalie', 'G', 8), projection('skater', 'D', 5)],
      { start: DAY_ONE, end: DAY_ONE },
      { G: 1, UTIL: 1 },
    );

    expect(result.totalPoints).toBe(13);
    expect(result.startRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'goalie', position: 'G' }),
      expect.objectContaining({ playerId: 'skater', position: 'UTIL' }),
    ]));
  });

  it('reports unused capacity for every date in the selected window', () => {
    const result = simulateLineup(
      [projection('one-game-center', 'C', 4, [DAY_ONE])],
      { start: DAY_ONE, end: DAY_TWO },
      { C: 1 },
    );

    expect(result.unusedSlotsByDate.get(DAY_ONE)).toEqual({});
    expect(result.unusedSlotsByDate.get(DAY_TWO)).toEqual({ C: 1 });
  });
});
