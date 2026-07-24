import { describe, expect, it } from 'vitest';
import { calculateIceRating, personalizeIceRating } from '../iceRating';

const baseInput = {
  seasonFppg: 4,
  last30Fppg: 4.5,
  last7Fppg: 5,
  hasSeasonSample: true,
  hasLast30Sample: true,
  hasLast7Sample: true,
  impactPercentile: 0.8,
  isGoalie: false,
  gamesAvailable: 4,
  windowDays: 7,
  offNightRate: 0.5,
  strengthOfSchedule: 7,
  seasonToiSeconds: 18 * 60,
  recentToiSeconds: 19 * 60,
  seasonPpToiSeconds: 120,
  recentPpToiSeconds: 150,
} as const;

describe('ICE rating V2', () => {
  it('returns an explainable 0-10 Impact, Context, Expectation breakdown', () => {
    const rating = calculateIceRating(baseInput);

    expect(rating.version).toBe('2.0');
    expect(rating.total).toBeGreaterThanOrEqual(0);
    expect(rating.total).toBeLessThanOrEqual(10);
    expect(rating.impact.score).toBeGreaterThan(rating.context.score);
    expect(rating.impact.detail).toContain('percentile');
    expect(rating.expectation.detail).toContain('TOI');
    expect(rating.confidence.level).toBe('high');
  });

  it('lowers personalized Context when roster congestion blocks games', () => {
    const rating = calculateIceRating(baseInput);
    const openLineup = personalizeIceRating(rating, {
      gamesAvailable: 4,
      starts: 4,
      windowDays: 7,
      offNightRate: 0.5,
      strengthOfSchedule: 7,
    });
    const congestedLineup = personalizeIceRating(rating, {
      gamesAvailable: 4,
      starts: 1,
      windowDays: 7,
      offNightRate: 0.5,
      strengthOfSchedule: 7,
    });

    expect(openLineup.context.score).toBeGreaterThan(congestedLineup.context.score);
    expect(openLineup.total).toBeGreaterThan(congestedLineup.total);
    expect(congestedLineup.context.detail).toContain('1/4 usable starts');
  });

  it('reports low confidence without season, recent, role, or schedule samples', () => {
    const rating = calculateIceRating({
      seasonFppg: 0,
      hasSeasonSample: false,
      hasLast30Sample: false,
      hasLast7Sample: false,
      isGoalie: false,
      gamesAvailable: 0,
      windowDays: 7,
      offNightRate: 0,
      strengthOfSchedule: 5,
    });

    expect(rating.confidence.level).toBe('low');
    expect(rating.context.detail).toBe('No games in the selected window');
  });
});
