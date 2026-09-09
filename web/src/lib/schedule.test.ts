import { describe, expect, it } from 'vitest';
import { getWeekIsoForDate } from './schedule';

describe('schedule date context', () => {
  it('opens the Monday week containing the requested briefing date', () => {
    expect(getWeekIsoForDate('2026-10-10')).toBe('2026-10-05');
  });

  it('rejects malformed context instead of changing the week', () => {
    expect(getWeekIsoForDate('not-a-date')).toBeNull();
  });
});
