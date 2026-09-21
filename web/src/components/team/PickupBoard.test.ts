import { describe, expect, it } from 'vitest';
import type { TimeWindowState } from '../../types/timeWindow';
import { pickupProjectionWindow } from './PickupBoard';

describe('pickupProjectionWindow', () => {
  it('sends date-only values to the projections API', () => {
    const timeWindow: TimeWindowState = {
      mode: 'regular',
      preset: 'rest-of-season',
      config: {
        startUtc: '2026-09-29T00:00:00.000Z',
        endUtc: '2027-04-10T23:59:59.999Z',
        source: 'preset',
      },
    };

    expect(pickupProjectionWindow(timeWindow)).toEqual({
      start: '2026-09-29',
      end: '2027-04-10',
    });
  });
});
