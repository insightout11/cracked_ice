import { describe, it, expect, beforeAll } from 'vitest';
import { rankStreamers } from '../src/services/rank';

beforeAll(() => {
  process.env.NEXT_PUBLIC_ENV = 'staging';
  process.env.DISABLE_PROD = 'true';
  process.env.FEATURE_OCR = 'false';
  process.env.FEATURE_MULTI_MOVE = 'false';
  process.env.FEATURE_CUSTOM_SCORING = 'false';
});

describe('rankStreamers', () => {
  it('caps outputs and includes badges for each recommendation', () => {
    const result = rankStreamers('demo', { start: '2025-10-13', end: '2025-10-20' });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);

    const deltas = result.recommendations.map((rec) => rec.deltaPoints);
    const sorted = [...deltas].sort((a, b) => b - a);
    expect(deltas).toEqual(sorted);

    for (const rec of result.recommendations) {
      expect(Array.isArray(rec.badges)).toBe(true);
      expect(rec.badges.length).toBeGreaterThan(0);
      expect(rec.bestDrop.player).toHaveProperty('id');
    }

    expect(result.recommendations[0].badges).toContain('MattPick');
  });
});