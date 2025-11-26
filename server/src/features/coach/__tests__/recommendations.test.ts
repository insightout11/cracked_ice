import { describe, it, expect } from 'vitest';
import { generateCoachRecommendations } from '../recommendations';
import type { DateWindow } from '../scoring';

describe('generateCoachRecommendations', () => {
  const window: DateWindow = { start: '2025-10-10', end: '2025-10-16' };

  it('computes delta points for top streamer move', () => {
    const result = generateCoachRecommendations('demo-user', window);
    const top = result.recommendations[0];

    expect(result.baseline_points).toBeCloseTo(86.02, 2);
    expect(top.add_player.base.id).toBe('shayne-gostisbehere');
    expect(top.drop_player.base.id).toBe('devon-toews');
    expect(top.delta_points).toBeCloseTo(3.87, 2);
    expect(top.delta_gp).toBe(1);
    expect(top.badge).toBe('off-night boost');
  });
});

