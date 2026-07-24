import { describe, expect, it } from 'vitest';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { buildFallbackIceRating, iceRatingTier, personalizeIceForOpenRosterSlot } from './iceRating';

const player = {
  id: 'nhl:1',
  full_name: 'Test Player',
  team: 'TBL',
  positions: ['RW'],
  seasonFppg: 4,
  last30Fppg: 4.4,
  last7Fppg: 4.8,
  roleTrend: {
    last7Games: 7,
    season: { avgToi: 18 * 60, avgPpToi: 3 * 60 },
    last7: { avgToi: 19 * 60, avgPpToi: 3.5 * 60 },
  },
} as RosterPlayer;

const projection = {
  fppg: 4,
  starts: 8,
  gamesAvailable: 10,
  projectedPoints: 32,
  offNightRate: 0.5,
  strengthOfSchedule: 6,
} as PlayerProjection;

describe('ICE rating client fallback', () => {
  it('returns an explainable 0-10 rating with confidence', () => {
    const rating = buildFallbackIceRating(player, projection);

    expect(rating.total).toBeGreaterThanOrEqual(0);
    expect(rating.total).toBeLessThanOrEqual(10);
    expect(rating.impact.detail).toContain('league FPPG');
    expect(rating.context.detail).toContain('usable starts');
    expect(rating.confidence.level).toBe('high');
  });

  it('penalizes roster congestion without changing player impact', () => {
    const openRoster = buildFallbackIceRating(player, projection);
    const crowdedRoster = buildFallbackIceRating(player, { ...projection, starts: 3 });

    expect(crowdedRoster.impact.score).toBe(openRoster.impact.score);
    expect(crowdedRoster.context.score).toBeLessThan(openRoster.context.score);
    expect(crowdedRoster.total).toBeLessThan(openRoster.total);
  });

  it('maps the visible score to a semantic tier', () => {
    expect(iceRatingTier(8.5)).toBe('elite');
    expect(iceRatingTier(5)).toBe('useful');
    expect(iceRatingTier(2.9)).toBe('low');
  });
});

describe('personalizeIceForOpenRosterSlot', () => {
  it('uses the open slot for every candidate game without changing player components', () => {
    const projection = {
      fppg: 3.5,
      starts: 0,
      gamesAvailable: 4,
      projectedPoints: 0,
      offNightRate: 0.5,
      strengthOfSchedule: 6,
      iceScore: 3,
      iceBreakdown: {
        version: '2.0' as const,
        total: 3,
        impact: { score: 6, label: 'Useful', detail: '3.50 league FPPG' },
        context: { score: 1, label: 'Low', detail: '0/4 usable starts' },
        expectation: { score: 7, label: 'Strong', detail: 'TOI 18:00 · PP 2:00' },
        confidence: { score: 0.8, level: 'high' as const, detail: 'Complete' },
      },
    };

    const result = personalizeIceForOpenRosterSlot(projection);

    expect(result.starts).toBe(4);
    expect(result.iceBreakdown?.impact).toEqual(projection.iceBreakdown.impact);
    expect(result.iceBreakdown?.expectation).toEqual(projection.iceBreakdown.expectation);
    expect(result.iceBreakdown?.context.detail).toContain('4/4 usable starts');
    expect(result.iceScore).toBe(result.iceBreakdown?.total);
  });
});
