import { describe, expect, it } from 'vitest';
import type { AcquisitionScenario } from './acquisitionScenarios';
import { discoverPickupCandidates, selectRecommendationLanes } from './pickupCandidateDiscovery';
import type { PlayerSearchResult } from '../types';

function player(id: string, name: string, pos: string[], options: Partial<PlayerSearchResult> = {}): PlayerSearchResult {
  return { id, name, pos, team: 'EDM', aliases: [], blendedFppg: 4, ...options };
}

function scenario(id: string, points: number, starts: number, fppg: number, drop: string | null = `drop-${id}`): AcquisitionScenario {
  return {
    id,
    calculationFingerprint: id,
    calculationVersion: 'acquisition-scenario-v1',
    leagueId: 'league',
    rosterFingerprint: 'roster',
    lane: 'this-week',
    analysis: { start: '2026-10-01', end: '2026-10-07', calculatedAt: '2026-09-21T00:00:00.000Z', projectionSource: 'test' },
    addition: { id, full_name: id, team: 'EDM', positions: ['C'], games_played: 50, stats: {}, blendedFppg: fppg },
    drop: drop ? { id: drop, full_name: drop, team: 'CGY', positions: ['C'], games_played: 50, stats: {}, blendedFppg: 3 } : null,
    baseline: { projectedPoints: 100, usableStarts: 20 },
    result: { projectedPoints: 100 + points, usableStarts: 20 + starts },
    impact: { projectedPointsDelta: points, usableStartsDelta: starts, candidateGames: 4, candidateStarts: 4, candidateStartDates: [], candidateBlockedDates: [], dropStarts: 2, dropCost: 6 },
    transaction: { legal: true, effectiveDate: '2026-10-01', movesRequired: 1, assumptions: [] },
    availability: { status: 'unknown', evidence: 'none', freshness: 'unknown' },
    participation: { status: 'supported', reason: 'test' },
    dropProtection: { status: drop ? 'passed' : 'not-needed', reason: 'test' },
    materiality: { threshold: 1, outcome: 'recommend', reason: 'test' },
  };
}

describe('pickup candidate discovery', () => {
  it('uses market or NHL sample evidence and excludes unsupported prospects', () => {
    const result = discoverPickupCandidates([
      player('market', 'Market Rookie', ['C'], { yahooAdp: 150, games_played: 0 }),
      player('veteran', 'Veteran', ['LW'], { games_played: 80 }),
      player('unknown', 'Unknown Prospect', ['RW'], { games_played: 0 }),
      player('rostered', 'Rostered', ['D'], { yahooAdp: 50 }),
    ], { rosterPlayerIds: ['rostered'], existingCandidateIds: [], marketSource: 'yahoo' });

    expect(result.map(({ player: item }) => item.id)).toEqual(expect.arrayContaining(['market', 'veteran']));
    expect(result.map(({ player: item }) => item.id)).not.toContain('unknown');
    expect(result.map(({ player: item }) => item.id)).not.toContain('rostered');
  });

  it('caps each position so one role cannot consume the shortlist', () => {
    const result = discoverPickupCandidates([
      player('c1', 'C One', ['C'], { yahooAdp: 1 }),
      player('c2', 'C Two', ['C'], { yahooAdp: 2 }),
      player('c3', 'C Three', ['C'], { yahooAdp: 3 }),
      player('d1', 'D One', ['D'], { yahooAdp: 20 }),
    ], { rosterPlayerIds: [], existingCandidateIds: [], marketSource: 'yahoo', maxPerPosition: 2 });

    expect(result.map(({ player: item }) => item.id)).toEqual(['c1', 'c2', 'd1']);
  });

  it('excludes players already recorded by the draft or keeper workflow', () => {
    const result = discoverPickupCandidates([
      player('nhl:1', 'Already Drafted Star', ['C'], { yahooAdp: 1 }),
      player('2', 'Unavailable Keeper', ['LW'], { yahooAdp: 2 }),
      player('3', 'Available Player', ['RW'], { yahooAdp: 80 }),
    ], {
      rosterPlayerIds: [],
      existingCandidateIds: [],
      excludedPlayerIds: ['1', 'nhl:2'],
      marketSource: 'yahoo',
    });

    expect(result.map(({ player: item }) => item.id)).toEqual(['3']);
  });
});

describe('recommendation lanes', () => {
  it('returns distinct additions for explainable lanes', () => {
    const lanes = selectRecommendationLanes([
      scenario('points', 12, 1, 4),
      scenario('starts', 8, 4, 4),
      scenario('hold', 7, 2, 6),
      scenario('open', 6, 2, 4.5, null),
    ]);

    expect(lanes.map((lane) => lane.id)).toEqual(['best-gain', 'most-starts', 'add-and-hold', 'open-slot']);
    expect(new Set(lanes.map((lane) => lane.scenario.addition.id)).size).toBe(lanes.length);
  });

  it('omits non-positive moves', () => {
    expect(selectRecommendationLanes([scenario('bad', -2, 0, 5)])).toEqual([]);
  });
});
