import { describe, expect, it } from 'vitest';
import { scheduleEntriesMatchSeason } from './schedules';

describe('schedule cache season guard', () => {
  it('rejects an enriched cache from a prior season', () => {
    const expected = new Set(['2026-10-01', '2026-10-03']);
    expect(scheduleEntriesMatchSeason({
      ANA: [
        { date: '2025-10-01' },
        { date: '2025-10-03' },
      ],
    }, expected)).toBe(false);
  });

  it('accepts records that belong to the active schedule', () => {
    const expected = new Set(['2026-10-01', '2026-10-03', '2026-10-05']);
    expect(scheduleEntriesMatchSeason({
      ANA: [
        { date: '2026-10-01' },
        { date: '2026-10-03' },
        { date: '2026-10-05' },
      ],
    }, expected)).toBe(true);
  });
});
