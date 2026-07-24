import { describe, expect, it } from 'vitest';
import { goalieStatView } from './goalieStats';
import type { RosterPlayer } from './coachSchemas';

function goalie(stats: Record<string, number>): RosterPlayer {
  return {
    id: '1',
    full_name: 'Test Goalie',
    team: 'ANA',
    positions: ['G'],
    games_played: 56,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0, ...stats },
  };
}

describe('goalieStatView', () => {
  it('reads the server snake-case contract', () => {
    const view = goalieStatView(goalie({
      wins: 30,
      losses: 20,
      overtime_losses: 4,
      games_started: 55,
      saves: 1344,
      shots_against: 1513,
      goals_against: 169,
      save_percentage: 0.8883,
      goals_against_average: 3.10287,
      shutouts: 2,
    }));

    expect(view.overtimeLosses).toBe(4);
    expect(view.gamesStarted).toBe(55);
    expect(view.savePercentage).toBeCloseTo(0.8883, 4);
    expect(view.goalsAgainstAverage).toBeCloseTo(3.10287, 5);
  });

  it('derives saves and save percentage when an older cache omitted them', () => {
    const view = goalieStatView(goalie({ shots_against: 1513, goals_against: 169 }));
    expect(view.saves).toBe(1344);
    expect(view.savePercentage).toBeCloseTo(0.8883, 4);
  });
});

