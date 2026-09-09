import { describe, expect, it } from 'vitest';
import { buildHomeActionLink, parseHomeActionContext, replaceLeagueContext } from './navigationContext';

describe('home action context', () => {
  it('round-trips internal context', () => {
    const link = buildHomeActionLink('/team', { leagueId: 'one', date: '2026-10-10', source: 'home-briefing', returnTo: '/' });
    expect(parseHomeActionContext(link.slice(link.indexOf('?')))).toEqual({ leagueId: 'one', date: '2026-10-10', source: 'home-briefing', returnTo: '/' });
  });
  it('rejects an external return destination', () => {
    expect(parseHomeActionContext('?source=home-tool&return=//evil.example')?.returnTo).toBeUndefined();
  });
  it('replaces an unavailable league while preserving the rest of the action context', () => {
    expect(replaceLeagueContext('?league=missing&date=2026-10-10&source=home-tool&return=%2F', 'saved')).toBe('?league=saved&date=2026-10-10&source=home-tool&return=%2F');
  });
});
