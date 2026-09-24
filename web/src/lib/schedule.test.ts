import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentWeekIso, getNextWeekIso, getPrevWeekIso } from './schedule';

describe('fantasy weeks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on the Monday of opening week before the season starts, not on opening night', () => {
    // 2026-27 opens Tuesday Sep 29; fantasy weeks run Monday to Sunday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    expect(getCurrentWeekIso()).toBe('2026-09-28');
  });

  it('steps a whole week at a time from Monday to Monday', () => {
    expect(getNextWeekIso('2026-09-28')).toBe('2026-10-05');
    expect(getPrevWeekIso('2026-10-05')).toBe('2026-09-28');
  });
});
