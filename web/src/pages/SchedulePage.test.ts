import { describe, expect, it } from 'vitest';
import { weekFromRouteDate } from './SchedulePage';

describe('Schedule route handoff', () => {
  it('opens the Monday containing the requested homepage date', () => {
    expect(weekFromRouteDate('2026-10-10', '2026-09-28')).toBe('2026-10-05');
  });

  it('keeps the fallback for absent or malformed dates', () => {
    expect(weekFromRouteDate(null, '2026-09-28')).toBe('2026-09-28');
    expect(weekFromRouteDate('October 10', '2026-09-28')).toBe('2026-09-28');
    expect(weekFromRouteDate('2026-99-99', '2026-09-28')).toBe('2026-09-28');
  });
});
