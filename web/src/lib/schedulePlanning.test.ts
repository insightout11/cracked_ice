import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { buildFantasySeasonOpportunity, buildMatchupWeeks, calculateRangeStreamingValues, formatGameStartTime, invalidateSeasonScheduleCache, loadSeasonSchedule, resolveComparisonPlanningWindow, resolvePlanningWindow } from './schedulePlanning';

afterEach(() => {
  invalidateSeasonScheduleCache();
  vi.unstubAllGlobals();
});

describe('schedule planning', () => {
  const workspace = createDefaultLeagueWorkspace();

  it('resolves planning windows from the selected week', () => {
    expect(resolvePlanningWindow('week', '2026-10-05', workspace)).toMatchObject({ start: '2026-10-05', end: '2026-10-11' });
    // Opening week starts Monday Sep 28; the season opens Tuesday, so the window is Tue-Sun, not into next Monday.
    expect(resolvePlanningWindow('week', '2026-09-28', workspace)).toMatchObject({ start: '2026-09-29', end: '2026-10-04' });
    expect(resolvePlanningWindow('14d', '2026-09-28', workspace).end).toBe('2026-10-11');
    expect(resolvePlanningWindow('14d', '2026-10-05', workspace).end).toBe('2026-10-18');
    expect(resolvePlanningWindow('rest-of-season', '2026-10-05', workspace, '2026-10-05')).toMatchObject({ start: '2026-10-05', end: '2027-04-10' });
  });

  it('ignores a stale saved week when resolving rest of season', () => {
    expect(resolvePlanningWindow('rest-of-season', '2027-03-11', workspace, '2026-09-21')).toMatchObject({
      start: '2026-09-29',
      end: '2027-04-10',
    });
    expect(resolvePlanningWindow('rest-of-season', '2027-03-11', workspace, '2026-12-04')).toMatchObject({
      start: '2026-12-04',
      end: '2027-04-10',
    });
    expect(resolvePlanningWindow('week', '2027-03-11', workspace, '2026-09-21').start).toBe('2027-03-11');
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

  it('separates games before, during, and after the saved fantasy playoffs', () => {
    const configured = createDefaultLeagueWorkspace();
    configured.season = { ...configured.season, start: '2026-10-01', end: '2027-04-10' };
    configured.schedule.playoffs = { start: '2027-03-01', end: '2027-03-21' };
    const opportunity = buildFantasySeasonOpportunity({ games: {
      BOS: [
        { date: '2026-10-01', opponent: 'ANA', isHome: true },
        { date: '2027-03-05', opponent: 'ANA', isHome: true },
        { date: '2027-03-25', opponent: 'ANA', isHome: true },
      ],
    } }, configured);

    expect(opportunity.BOS).toEqual({
      team: 'BOS',
      beforePlayoffs: 1,
      fantasyPlayoffs: 1,
      afterFantasySeason: 1,
      fantasyRelevantGames: 2,
      fullSeasonGames: 3,
    });
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

  it('uses the full fantasy season for pre-draft rest-of-season comparisons', () => {
    const configured = createDefaultLeagueWorkspace();
    configured.season.start = '2026-10-01';
    configured.schedule.playoffs = { start: '2027-03-08', end: '2027-03-28' };

    expect(resolveComparisonPlanningWindow('rest-of-season', '2027-03-08', configured, 'draft', '2026-09-21')).toMatchObject({
      start: '2026-10-01',
      end: '2027-03-28',
      label: 'Rest of fantasy season',
    });
    expect(resolveComparisonPlanningWindow('rest-of-season', '2027-03-08', configured, 'league', '2026-09-21')).toMatchObject({
      start: '2026-09-29',
      end: '2027-04-10',
    });
  });

  it('does not retain a failed request and explicitly refreshes a fulfilled cache', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ games: { TOR: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ games: { MTL: [] } }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadSeasonSchedule()).rejects.toThrow('503');
    await expect(loadSeasonSchedule()).resolves.toEqual({ games: { TOR: [] } });
    await expect(loadSeasonSchedule(true)).resolves.toEqual({ games: { MTL: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
