import { describe, expect, it } from 'vitest';
import { buildHomeActionLink, parseHomeActionContext, parseRosterSetupIntent, replaceLeagueContext, resolveRecommendationHandoff } from './navigationContext';
import type { AcquisitionScenario } from './acquisitionScenarios';

describe('home action context', () => {
  it('round-trips internal context', () => {
    const link = buildHomeActionLink('/team', { leagueId: 'one', date: '2026-10-10', source: 'home-briefing', returnTo: '/' });
    expect(parseHomeActionContext(link.slice(link.indexOf('?')))).toMatchObject({ leagueId: 'one', date: '2026-10-10', source: 'home-briefing', returnTo: '/' });
  });

  it('preserves an exact recommendation and places the query before the board fragment', () => {
    const link = buildHomeActionLink('/team#pickup-board', {
      leagueId: 'league-1', source: 'home-recommendation', returnTo: '/', windowStart: '2026-10-10', windowEnd: '2026-10-16', timeWindowPreset: '7d',
      scenarioId: 'acq-one', calculationFingerprint: 'fingerprint-one', additionId: 'add-one', dropId: 'drop-one',
    });
    expect(link.indexOf('?')).toBeLessThan(link.indexOf('#'));
    expect(parseHomeActionContext(link.slice(link.indexOf('?'), link.indexOf('#')))).toMatchObject({
      source: 'home-recommendation', scenarioId: 'acq-one', calculationFingerprint: 'fingerprint-one', additionId: 'add-one', dropId: 'drop-one',
    });
  });

  it('distinguishes an exact handoff from a recalculated scenario', () => {
    const scenario = { id: 'acq-one', calculationFingerprint: 'new', addition: { id: 'add-one' }, drop: { id: 'drop-one' } } as AcquisitionScenario;
    const exact = parseHomeActionContext('?source=home-recommendation&scenario=acq-one&fingerprint=new&add=add-one&drop=drop-one');
    const stale = parseHomeActionContext('?source=home-recommendation&scenario=acq-one&fingerprint=old&add=add-one&drop=drop-one');
    expect(resolveRecommendationHandoff([scenario], exact).state).toBe('exact');
    expect(resolveRecommendationHandoff([scenario], stale).state).toBe('recalculated');
    expect(resolveRecommendationHandoff([], stale).state).toBe('missing');
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
