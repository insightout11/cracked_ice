import { describe, expect, it } from 'vitest';
import { calculatePairings } from './pairings.js';
import type { ScheduleContext } from './schedule.js';

const context: ScheduleContext = {
  sets: new Map([
    ['EDM', new Set(['2026-10-05', '2026-10-07', '2026-10-10'])],
    ['NYI', new Set(['2026-10-05', '2026-10-08'])],
    ['ANA', new Set(['2026-10-06', '2026-10-07', '2026-10-09'])],
    ['BOS', new Set(['2026-10-05', '2026-10-08', '2026-10-11'])]
  ]),
  teamNameMap: new Map([
    ['EDM', 'Edmonton Oilers'],
    ['NYI', 'New York Islanders'],
    ['ANA', 'Anaheim Ducks'],
    ['BOS', 'Boston Bruins']
  ])
};

describe('calculatePairings', () => {
  it('returns baseline occupancy and ranks candidates by added starts', () => {
    const response = calculatePairings(context, ['EDM', 'NYI'], '2026-10-05', '2026-10-11', 2);

    expect(response.baseline).toEqual({ usableStarts: 5, teams: ['EDM', 'NYI'] });
    expect(response.mode).toBe('added-starts');
    expect(response.anchorsGamesByDate['2026-10-05']).toEqual(['EDM', 'NYI']);
    expect(response.results.map((result) => result.team)).toEqual(['ANA', 'BOS']);
    expect(response.results[0]).toMatchObject({
      team: 'ANA',
      addedStarts: 3,
      separateNights: 2,
      sharedNights: 1,
      blockedGames: 0,
      conflicts: 0,
      addedDates: ['2026-10-06', '2026-10-07', '2026-10-09']
    });
    expect(response.results[1]).toMatchObject({
      team: 'BOS',
      addedStarts: 2,
      blockedGames: 1,
      conflicts: 1
    });
  });

  it('ranks an open-slot partner by the fewest shared nights', () => {
    const response = calculatePairings(context, ['EDM'], '2026-10-05', '2026-10-11', 2);

    expect(response.mode).toBe('pair-building');
    expect(response.results.map((result) => result.team)).toEqual(['ANA', 'BOS', 'NYI']);
    expect(response.results[0]).toMatchObject({
      team: 'ANA',
      separateNights: 2,
      sharedNights: 1,
      blockedGames: 0,
    });
    expect(response.results[2]).toMatchObject({
      team: 'NYI',
      separateNights: 1,
      sharedNights: 1,
    });
  });

  it('counts duplicate anchor teams as separate occupied roster slots', () => {
    const response = calculatePairings(context, ['EDM', 'EDM'], '2026-10-05', '2026-10-11', 2);

    expect(response.baseline.usableStarts).toBe(6);
    expect(response.results.find((result) => result.team === 'NYI')).toMatchObject({
      addedStarts: 1,
      conflicts: 1
    });
  });
});
