import { describe, expect, it } from 'vitest';
import { getCanonicalOffNightDates } from './dates.js';

describe('canonical off-night dates', () => {
  it('uses eight or fewer games instead of weekday heuristics', () => {
    const sets = new Map<string, Set<string>>();
    for (let index = 0; index < 18; index += 1) {
      sets.set(`T${index}`, new Set(index < 16 ? ['2026-10-06', '2026-10-07'] : ['2026-10-07']));
    }
    expect(getCanonicalOffNightDates(sets)).toEqual(new Set(['2026-10-06']));
  });
});
