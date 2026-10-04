import { describe, expect, it } from 'vitest';
import type { TimeWindowState } from '../../types/timeWindow';
import { pickupProjectionWindow } from '../../hooks/useAcquisitionRecommendations';

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

    expect(pickupProjectionWindow(timeWindow, '2026-09-29')).toEqual({
      start: '2026-09-29',
      end: '2027-04-10',
    });
  });
});

describe('pickup windows only look forward', () => {
  const week: TimeWindowState = {
    mode: 'regular',
    preset: 'custom',
    customRange: { start: '2026-09-28', end: '2026-10-04' },
    config: { startUtc: '2026-09-28T00:00:00.000Z', endUtc: '2026-10-04T23:59:59.999Z', source: 'custom' },
  } as TimeWindowState;

  it('drops the days already played', () => {
    expect(pickupProjectionWindow(week, '2026-10-03')).toEqual({ start: '2026-10-03', end: '2026-10-04' });
  });

  it('rolls a week that has passed over to the rest of the current week', () => {
    expect(pickupProjectionWindow(week, '2026-10-07')).toEqual({ start: '2026-10-07', end: '2026-10-11' });
  });
});
