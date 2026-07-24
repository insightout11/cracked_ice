import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { buildMatchupWeeks, calculateRangeStreamingValues, formatGameStartTime, resolvePlanningWindow } from './schedulePlanning';

describe('schedule planning', () => {
  const workspace = createDefaultLeagueWorkspace();

  it('resolves planning windows from the selected week', () => {
    expect(resolvePlanningWindow('week', '2026-10-05', workspace)).toMatchObject({ start: '2026-10-05', end: '2026-10-11' });
    expect(resolvePlanningWindow('14d', '2026-10-05', workspace).end).toBe('2026-10-18');
    expect(resolvePlanningWindow('rest-of-season', '2026-10-05', workspace).end).toBe('2027-04-10');
  });

  it('uses saved fantasy playoff dates', () => {
    expect(resolvePlanningWindow('playoffs', '2026-10-05', workspace)).toMatchObject({
      start: workspace.schedule.playoffs.start,
      end: workspace.schedule.playoffs.end,
    });
  });

  it('segments fantasy playoffs into matchup weeks and identifies the championship window', () => {
    expect(buildMatchupWeeks('2027-03-01', '2027-03-21')).toEqual([
      { index: 1, start: '2027-03-01', end: '2027-03-07', label: 'Playoff 1', isChampionship: false },
      { index: 2, start: '2027-03-08', end: '2027-03-14', label: 'Playoff 2', isChampionship: false },
      { index: 3, start: '2027-03-15', end: '2027-03-21', label: 'Championship', isChampionship: true },
    ]);
    expect(buildMatchupWeeks('2027-03-01', '2027-03-10')[1]).toMatchObject({ start: '2027-03-08', end: '2027-03-10', label: 'Championship' });
  });

  it('counts only games that fit unused lineup dates', () => {
    const values = calculateRangeStreamingValues({ games: {
      ANA: [
        { date: '2026-10-05', opponent: 'LAK', isHome: true },
        { date: '2026-10-07', opponent: 'SJS', isHome: false },
      ],
    } }, { start: '2026-10-05', end: '2026-10-10' }, {
      '2026-10-05': { RW: 1 },
      '2026-10-07': { RW: 0 },
    }, ['ANA']);
    expect(values.ANA).toMatchObject({ extraUsableStarts: 1, gamesInWindow: 2, representedOnRoster: true });
  });

  it('safely ignores missing or invalid start times', () => {
    expect(formatGameStartTime()).toBeNull();
    expect(formatGameStartTime('not-a-date')).toBeNull();
  });
});
