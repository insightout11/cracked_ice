import { describe, it, expect } from 'vitest';
import { generateCoachRecommendations } from '../recommendations';
import type { DateWindow } from '../scoring';

describe('generateCoachRecommendations', () => {
  const window: DateWindow = { start: '2025-10-10', end: '2025-10-16' };

  it('uses player schedule dates when enriched schedule context is unavailable', async () => {
    const result = await generateCoachRecommendations('demo-user', window);

    expect(result.baseline_points).toBeGreaterThan(0);
    expect(result.recommendations).toEqual(expect.any(Array));
    expect(result.window).toEqual(window);
  });
});

