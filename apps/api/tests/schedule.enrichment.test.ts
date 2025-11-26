import { describe, it, expect } from 'vitest';
import { normaliseTeamDates } from '../scripts/hydrate';


describe('schedule hydration enrichment', () => {
  it('copies home/away/start metadata into schedule entries', () => {
    const offNights = new Set(['2025-10-04']);
    const gameLookup = {
      ANA: new Map([
        [
          '2025-10-04',
          {
            date: '2025-10-04',
            opponent: 'LAK',
            isHome: true,
            gameId: 12345,
            startTime: '2025-10-04T23:00:00Z'
          }
        ]
      ])
    } as Record<string, Map<string, any>>;

    const result = normaliseTeamDates({ ANA: ['2025-10-04'] }, offNights, gameLookup);
    const entry = result.ANA[0];

    expect(entry).toMatchObject({
      date: '2025-10-04',
      isOffNight: true,
      homeTeam: 'ANA',
      awayTeam: 'LAK',
      startTime: '2025-10-04T23:00:00Z',
      gameId: '12345'
    });
  });
});
