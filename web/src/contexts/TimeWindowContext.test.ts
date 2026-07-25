import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from '../lib/leagueWorkspace';
import { buildInitialState } from './TimeWindowContext';

describe('TimeWindowContext League Workspace defaults', () => {
  beforeEach(() => localStorage.clear());

  it('uses the active league playoff dates instead of legacy week defaults', () => {
    const league = createDefaultLeagueWorkspace({ id: 'dates', timezone: 'UTC' });
    league.schedule.playoffs = { start: '2027-03-08', end: '2027-03-28' };

    const state = buildInitialState({ mode: 'playoff' }, league);

    expect(state.mode).toBe('playoff');
    expect(state.customRange).toEqual({ start: '2027-03-08', end: '2027-03-28' });
    expect(state.config.startUtc.slice(0, 10)).toBe('2027-03-08');
    expect(state.config.endUtc.slice(0, 10)).toBe('2027-03-28');
  });

  it('ends before-playoffs analysis the day before the configured league playoffs', () => {
    const league = createDefaultLeagueWorkspace({ id: 'before-dates', timezone: 'UTC' });
    league.schedule.playoffs = { start: '2027-03-08', end: '2027-03-28' };

    const state = buildInitialState({ mode: 'before-playoffs' }, league);

    expect(state.customRange).toEqual({ start: league.season.start, end: '2027-03-07' });
  });
});
