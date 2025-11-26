import { describe, it, expect } from 'vitest';
import { buildProjection, DateWindow } from '../scoring';
import { simulateLineup } from '../simulation';
import type { Player, LeagueProfile } from '../types';

describe('simulateLineup', () => {
  it('allocates starters by position and sums fantasy points', () => {
    const window: DateWindow = { start: '2025-10-10', end: '2025-10-12' };
    const lineupSlots = { F: 1 };

    const league: LeagueProfile = {
      league_name: 'Test League',
      scoring_type: 'points',
      skater_scoring: {
        goals: 3,
        assists: 2,
        shots_on_goal: 0.4,
        blocks: 0.6,
        powerplay_points: 0.5
      },
      goalie_scoring: {},
      lineup_slots: lineupSlots
    };

    const players: Player[] = [
      {
        id: 'alpha',
        full_name: 'Alpha Skater',
        team: 'AAA',
        position: 'F',
        games_played: 2,
        stats: {
          goals: 2,
          assists: 1,
          shots_on_goal: 6,
          blocks: 1,
          power_play_points: 1
        },
        upcoming_games: ['2025-10-10', '2025-10-12'],
        is_drop_eligible: false,
        tags: []
      },
      {
        id: 'beta',
        full_name: 'Beta Skater',
        team: 'BBB',
        position: 'F',
        games_played: 2,
        stats: {
          goals: 1,
          assists: 1,
          shots_on_goal: 3,
          blocks: 1,
          power_play_points: 0
        },
        upcoming_games: ['2025-10-10', '2025-10-11'],
        is_drop_eligible: false,
        tags: []
      }
    ];

    const projections = players.map((player) =>
      buildProjection(player, league, window, undefined, null, null, {
        recentFormBoost: false,
        enableBadgeDebug: false
      })
    );

    const result = simulateLineup(projections, window, lineupSlots);

    expect(result.totalPoints).toBeCloseTo(14.9, 2);
    expect(result.startsByPlayer.get('alpha')).toBe(2);
    expect(result.startsByPlayer.get('beta')).toBe(1);
  });
});
