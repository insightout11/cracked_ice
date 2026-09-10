import { describe, expect, it } from 'vitest';
import { buildHomeActionLink, parseHomeActionContext, parseRosterSetupIntent, replaceLeagueContext } from './navigationContext';

describe('home action context', () => {
  it('round-trips internal context', () => {
    const link = buildHomeActionLink('/team', { leagueId: 'one', date: '2026-10-10', source: 'home-briefing', returnTo: '/' });
    expect(parseHomeActionContext(link.slice(link.indexOf('?')))).toEqual({ leagueId: 'one', date: '2026-10-10', source: 'home-briefing', returnTo: '/' });
  });

  it('rejects an external return destination', () => {
    expect(parseHomeActionContext('?source=home-tool&return=//evil.example')?.returnTo).toBeUndefined();
  });

  it('replaces a league while preserving action context', () => {
    expect(replaceLeagueContext('?league=missing&date=2026-10-10&source=home-tool&return=%2F', 'saved')).toBe('?league=saved&date=2026-10-10&source=home-tool&return=%2F');
  });

  it('accepts only supported My Team setup handoffs', () => {
    expect(parseRosterSetupIntent('?setup=import')).toBe('import');
    expect(parseRosterSetupIntent('?setup=review')).toBe('review');
    expect(parseRosterSetupIntent('?setup=unknown')).toBeNull();
  });
});
