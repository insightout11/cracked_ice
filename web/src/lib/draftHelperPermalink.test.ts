import { describe, expect, it } from 'vitest';
import { buildDraftHelperPermalink, parseDraftHelperPermalink } from './draftHelperPermalink';
import type { TimeWindowState } from '../types/timeWindow';

const seasonWindow: TimeWindowState = {
  mode: 'regular',
  preset: 'season',
  config: {
    startUtc: '2026-09-29T00:00:00.000Z',
    endUtc: '2027-04-10T23:59:59.999Z',
    source: 'preset',
    preset: 'season',
  },
};

describe('Draft Helper permalinks', () => {
  it('round-trips player anchors, stack, slots, result, and time window', () => {
    const url = buildDraftHelperPermalink('https://example.com/?utm_source=test#old', {
      inputMode: 'players',
      playerIds: ['nhl:8476453', '8478402'],
      stackedTeams: ['ANA'],
      teamAnchors: [],
      slots: 3,
      customSlots: true,
      selectedTeam: 'UTA',
    }, seasonWindow);

    const parsedUrl = new URL(url);
    expect(parsedUrl.searchParams.get('utm_source')).toBe('test');
    expect(parsedUrl.searchParams.get('mode')).toBe('regular');
    expect(parsedUrl.searchParams.get('tw')).toBe('season');
    expect(parsedUrl.hash).toBe('');
    expect(parseDraftHelperPermalink(parsedUrl.search)).toEqual({
      inputMode: 'players',
      playerIds: ['nhl:8476453', '8478402'],
      stackedTeams: ['ANA'],
      teamAnchors: [],
      slots: 3,
      customSlots: true,
      selectedTeam: 'UTA',
    });
  });

  it('serializes team anchors and playoff league weeks', () => {
    const playoffWindow: TimeWindowState = {
      mode: 'playoff',
      preset: 'custom',
      config: {
        startUtc: '2027-03-15T00:00:00.000Z',
        endUtc: '2027-04-04T23:59:59.999Z',
        source: 'preset',
      },
      playoffMode: {
        isEnabled: true,
        preset: 'league-weeks',
        leagueWeekConfig: { weekStartDay: 'monday', selectedWeeks: [24, 25, 26] },
      },
    };
    const url = new URL(buildDraftHelperPermalink('https://example.com/', {
      inputMode: 'teams',
      playerIds: [],
      stackedTeams: [],
      teamAnchors: ['TBL', 'ANA'],
      slots: 2,
      customSlots: false,
      selectedTeam: 'NYR',
    }, playoffWindow));

    expect(url.searchParams.get('teams')).toBe('TBL,ANA');
    expect(url.searchParams.get('mode')).toBe('playoff');
    expect(url.searchParams.get('playoff')).toBe('league-weeks');
    expect(url.searchParams.get('weeks')).toBe('24,25,26');
    expect(url.searchParams.get('weekStart')).toBe('mon');
  });

  it('ignores invalid and unrelated query strings', () => {
    expect(parseDraftHelperPermalink('?utm_source=test')).toBeNull();
    expect(parseDraftHelperPermalink('?draft=players&players=ok,%3Cscript%3E&slots=99&result=toolongteam')).toMatchObject({
      playerIds: ['ok'],
      slots: 2,
      selectedTeam: null,
    });
  });
});
