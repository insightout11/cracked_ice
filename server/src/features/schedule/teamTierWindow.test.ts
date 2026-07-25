import { describe, expect, it } from 'vitest';
import { resolveTeamTierWindow, splitTeamTierDates } from './teamTierWindow';

describe('team tier window', () => {
  it('uses the exact configured fantasy playoff window', () => {
    const window = resolveTeamTierWindow(
      {
        start: '2026-10-06',
        end: '2027-04-15',
        playoffStart: '2027-03-01',
        playoffEnd: '2027-03-21',
      },
      '2026-10-06',
      '2027-04-15',
      '2027-03-15',
    );

    expect(window).toEqual({
      start: '2026-10-06',
      end: '2027-04-15',
      playoffStart: '2027-03-01',
      playoffEnd: '2027-03-21',
    });

    expect(splitTeamTierDates([
      '2026-10-05',
      '2026-10-06',
      '2027-02-28',
      '2027-03-01',
      '2027-03-21',
      '2027-03-22',
      '2027-04-16',
    ], window)).toEqual({
      regularSeasonDates: ['2026-10-06', '2027-02-28'],
      playoffDates: ['2027-03-01', '2027-03-21'],
    });
  });

  it('falls back safely when dates are invalid or reversed', () => {
    expect(resolveTeamTierWindow(
      { start: 'bad', end: 'also-bad', playoffStart: '2027-04-01', playoffEnd: '2027-03-01' },
      '2026-10-06',
      '2027-04-15',
      '2027-03-15',
    )).toEqual({
      start: '2026-10-06',
      end: '2027-04-15',
      playoffStart: '2027-04-01',
      playoffEnd: '2027-04-01',
    });
  });
});
