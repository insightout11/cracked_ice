import { describe, expect, it } from 'vitest';
import { splitPositions, toNumericId, normalizeLeagueProfile } from '../../../routes/coach';
import type {
  Player,
  PlayerProjection,
  SimulationResult,
  SimulationStartRecord
} from '../types';

describe('coach route contracts', () => {
  it('splitPositions normalizes hybrid position strings', () => {
    expect(splitPositions('C/RW')).toEqual(['C', 'RW']);
  });

  it('toNumericId removes nhl: prefix', () => {
    expect(toNumericId('nhl:8478402')).toBe('8478402');
  });

  it('normalizeLeagueProfile merges default preset weights', () => {
    const { profile, weightsSource } = normalizeLeagueProfile({ league_name: 'My League' }, null);

    expect(profile.league_name).toBe('My League');
    expect(profile.preset_name).toBe('Default');
    expect(profile.skater_scoring.power_play_points).toBeGreaterThan(0);
    expect(profile.goalie_scoring.wins).toBeGreaterThan(0);
    expect(weightsSource).toBe('league');
  });

  it('projection payload uses numeric string keys', () => {
    const projectionBase: Player = {
      id: 'nhl:8478402',
      full_name: 'Vincent Trocheck',
      team: 'NYR',
      position: 'C/RW',
      games_played: 18,
      stats: {
        goals: 7,
        assists: 14,
        shots_on_goal: 58,
        blocks: 6,
        power_play_points: 8,
        shorthanded_goals: 0,
        shorthanded_assists: 1,
        hits: 12,
        game_winning_goals: 2
      },
      upcoming_games: ['2025-01-13'],
      is_drop_eligible: false,
      tags: [],
      current_slot: 'C'
    };

    const projection: PlayerProjection = {
      base: projectionBase,
      fppg: 3.28,
      projectedPoints: 9.84,
      upcomingGamesInWindow: ['2025-01-13'],
      offNightRate: 0.25
    };

    const startRecord: SimulationStartRecord = {
      playerId: 'nhl:8478402',
      playerName: 'Vincent Trocheck',
      position: 'C',
      date: '2025-01-13',
      fppg: 3.28
    };

    const simulation: SimulationResult = {
      totalPoints: 0,
      startsByPlayer: new Map<string, number>([['8478402', 1]]),
      startRecords: [startRecord],
      benchRecords: [],
      unusedSlotsByDate: new Map()
    };

    const projectionPayload: Record<string, { starts: number; fppg: number; projectedPoints: number; startsByDate?: Record<string, number> }> = {};
    const startsByDate: Record<string, Record<string, number>> = {};

    for (const record of simulation.startRecords) {
      const numericId = toNumericId(record.playerId);
      const summary = startsByDate[numericId] ?? {};
      summary[record.date] = (summary[record.date] ?? 0) + 1;
      startsByDate[numericId] = summary;
    }

    for (const item of [projection]) {
      const numericId = toNumericId(item.base.id);
      const starts = simulation.startsByPlayer.get(item.base.id) ?? simulation.startsByPlayer.get(numericId) ?? 0;
      const startsSummary = startsByDate[numericId];

      const response: { starts: number; fppg: number; projectedPoints: number; startsByDate?: Record<string, number> } = {
        fppg: item.fppg,
        starts,
        projectedPoints: item.projectedPoints
      };

      if (startsSummary && Object.keys(startsSummary).length) {
        response.startsByDate = startsSummary;
      }

      projectionPayload[numericId] = response;
    }

    expect(Object.keys(projectionPayload)).toEqual(['8478402']);
    expect(projectionPayload['8478402'].startsByDate).toEqual({ '2025-01-13': 1 });
  });
});
