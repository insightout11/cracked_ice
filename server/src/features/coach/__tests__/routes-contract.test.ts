import { describe, expect, it } from 'vitest';
import { splitPositions, toNumericId, normalizeLeagueProfile, resolvePlayerForProjection, resolveRequestedLeagueProfile } from '../../../routes/coach';
import { ESPN_STANDARD_PRESET, YAHOO_STANDARD_PRESET } from '../presets';
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

  it('resolves League Workspace players from a prefixed directory id', () => {
    const resolved = resolvePlayerForProjection('8476453', null, {
      meta: { sourcePath: 'test', generatedAt: null, playerCount: 1 },
      entries: [{ id: 'nhl:8476453', name: 'Nikita Kucherov', team: 'TBL', pos: ['RW'], aliases: [] }],
    });

    expect(resolved).toMatchObject({
      id: '8476453',
      full_name: 'Nikita Kucherov',
      team: 'TBL',
      position: 'RW',
    });
  });

  it('normalizeLeagueProfile merges default preset weights', () => {
    const { profile, weightsSource } = normalizeLeagueProfile({ league_name: 'My League' }, null);

    expect(profile.league_name).toBe('My League');
    expect(profile.preset_name).toBe('Default');
    expect(profile.skater_scoring.power_play_points).toBeGreaterThan(0);
    expect(profile.goalie_scoring.wins).toBeGreaterThan(0);
    expect(weightsSource).toBe('league');
  });

  it('does not merge hidden defaults into explicit custom scoring', () => {
    const { profile, weightsSource } = normalizeLeagueProfile({
      league_name: 'Low scoring league',
      preset_name: 'Custom points',
      skater_scoring: { goals: 1 },
      goalie_scoring: { wins: 1 },
    }, null);

    expect(profile.skater_scoring).toEqual({ goals: 1 });
    expect(profile.goalie_scoring).toEqual({ wins: 1 });
    expect(weightsSource).toBe('custom');
  });

  it('keeps server preset resolution on the shared League Workspace contract', () => {
    expect(YAHOO_STANDARD_PRESET.skater_scoring).toMatchObject({ goals: 6, assists: 4, shorthanded_goals: 4 });
    expect(YAHOO_STANDARD_PRESET.goalie_scoring).toMatchObject({ wins: 5, shutouts: 3 });
    expect(ESPN_STANDARD_PRESET.skater_scoring).toMatchObject({ goals: 3, assists: 2, plus_minus: 0.25 });
    expect(ESPN_STANDARD_PRESET.goalie_scoring).toMatchObject({ wins: 5, shutouts: 5 });
  });

  it('lets an explicit request profile override stale stored scoring', () => {
    const fallback = normalizeLeagueProfile({
      league_name: 'Stored league',
      skater_scoring: { goals: 9 },
      goalie_scoring: { wins: 9 },
    }, null).profile;
    const requested = resolveRequestedLeagueProfile(JSON.stringify({
      league_name: 'Active workspace',
      scoring_type: 'points',
      lineup_slots: { C: 2, G: 2 },
      skater_scoring: { goals: 1.25, shorthanded_goals: 3 },
      goalie_scoring: { wins: 2 },
    }), fallback);

    expect(requested?.league_name).toBe('Active workspace');
    expect(requested?.skater_scoring).toEqual({ goals: 1.25, shorthanded_goals: 3 });
    expect(requested?.goalie_scoring).toEqual({ wins: 2 });
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
