import { describe, it, expect } from 'vitest';
import { buildProjection, DateWindow } from '../scoring';
import type { Player, LeagueProfile } from '../types';
import type { TeamStatsContext } from '../../../context/teamStats';
import type { ScheduleContext } from '../../../context/schedules';

describe('Strength of Schedule (SoS) calculation', () => {
  const window: DateWindow = { start: '2025-10-10', end: '2025-10-16' };

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
    lineup_slots: { F: 1 }
  };

  const basePlayer: Player = {
    id: 'test-player',
    full_name: 'Test Player',
    team: 'TOR',
    position: 'F',
    games_played: 10,
    stats: {
      goals: 10,
      assists: 10,
      shots_on_goal: 30,
      blocks: 5,
      power_play_points: 5
    },
    upcoming_games: ['2025-10-10', '2025-10-12', '2025-10-14'],
    is_drop_eligible: false,
    tags: []
  };

  it('returns neutral SoS (5) when player has no games in window', () => {
    const player = { ...basePlayer, upcoming_games: [] };

    const teamStats: TeamStatsContext = {
      loaded: true,
      byTeam: new Map([['TOR', { teamCode: 'TOR', gaPer60: 2.5 }]])
    };

    const projection = buildProjection(player, league, window, null, null, teamStats);

    expect(projection.strengthOfSchedule).toBe(5); // Neutral when no games
  });

  it('returns neutral SoS (5) when teamStats are not loaded', () => {
    const player = basePlayer;

    const teamStats: TeamStatsContext = { loaded: false, byTeam: new Map() };

    const projection = buildProjection(player, league, window, null, null, teamStats);

    expect(projection.strengthOfSchedule).toBe(5); // Neutral when stats not loaded
  });

  it('returns neutral SoS (5) when no contexts provided', () => {
    const player = basePlayer;

    const projection = buildProjection(player, league, window, null, null, null);

    expect(projection.strengthOfSchedule).toBe(5); // Neutral fallback
  });

  it('SoS value is always within 1-10 range', () => {
    const player = basePlayer;

    // Test with various context combinations
    const contexts = [
      { schedule: null, teamStats: null },
      { schedule: null, teamStats: { loaded: false, byTeam: new Map() } },
      {
        schedule: null,
        teamStats: {
          loaded: true,
          byTeam: new Map([
            ['TOR', { teamCode: 'TOR', gaPer60: 2.5 }],
            ['MTL', { teamCode: 'MTL', gaPer60: 3.0 }]
          ])
        }
      }
    ];

    for (const ctx of contexts) {
      const projection = buildProjection(
        player,
        league,
        window,
        null,
        ctx.schedule as any,
        ctx.teamStats as TeamStatsContext | null
      );

      expect(projection.strengthOfSchedule).toBeGreaterThanOrEqual(1);
      expect(projection.strengthOfSchedule).toBeLessThanOrEqual(10);
      expect(Number.isInteger(projection.strengthOfSchedule)).toBe(true); // Should be whole number
    }
  });

  it('SoS calculation does not crash with edge cases', () => {
    // Player with missing team
    const noTeamPlayer = { ...basePlayer, team: '' };
    const projection1 = buildProjection(noTeamPlayer, league, window, null, null, null);
    expect(projection1.strengthOfSchedule).toBe(5);

    // Player with very old games (outside window)
    const oldGamesPlayer = { ...basePlayer, upcoming_games: ['2020-01-01', '2020-01-02'] };
    const projection2 = buildProjection(oldGamesPlayer, league, window, null, null, null);
    expect(projection2.strengthOfSchedule).toBe(5);

    // Player with games far in the future
    const futureGamesPlayer = { ...basePlayer, upcoming_games: ['2030-01-01', '2030-01-02'] };
    const projection3 = buildProjection(futureGamesPlayer, league, window, null, null, null);
    expect(projection3.strengthOfSchedule).toBe(5);
  });
});
