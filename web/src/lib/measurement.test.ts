import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { confirmRosterReadiness } from './homeReadiness';

const analytics = vi.hoisted(() => ({ track: vi.fn(), initializeAnalytics: vi.fn(() => true) }));
vi.mock('./analytics', () => analytics);

describe('measurement boundaries', () => {
  beforeEach(() => { vi.resetModules(); analytics.track.mockClear(); analytics.initializeAnalytics.mockReturnValue(true); window.sessionStorage.clear(); });

  it('recognizes tool links including dated grids, and excludes unrelated or external paths', async () => {
    const { articleToolDestination } = await import('./measurement');
    const origin = 'http://localhost:5174';
    expect(articleToolDestination('/season?start=2026-10-26#grid', origin)).toBe('season');
    expect(articleToolDestination('https://www.crackedicehockey.com/team#pickup-board', origin)).toBe('team');
    expect(articleToolDestination('/compare/', origin)).toBe('compare');
    expect(articleToolDestination('https://example.com/season', origin)).toBeNull();
    expect(articleToolDestination('/blog/weekly-guide', origin)).toBeNull();
    expect(articleToolDestination('javascript:alert(1)', origin)).toBeNull();
  });

  it('deduplicates a session without consuming impressions while tracking is excluded', async () => {
    const { measureOnce } = await import('./measurement');
    const record = vi.fn();
    analytics.initializeAnalytics.mockReturnValue(false);
    measureOnce('plan', record);
    analytics.initializeAnalytics.mockReturnValue(true);
    measureOnce('plan', record);
    measureOnce('plan', record);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('does not count saved-account loading as setup, and waits for a usable imported roster', async () => {
    const { startSetupMeasurement, completeSetupMeasurement } = await import('./measurement');
    const empty = createDefaultLeagueWorkspace({ id: 'private-league' });
    const ready = confirmRosterReadiness({ ...empty, scoring: { ...empty.scoring, presetId: 'yahoo' }, roster: [{ playerId: 'nhl:123', fullName: 'Private player', team: 'TOR', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }] });
    completeSetupMeasurement(ready);
    expect(analytics.track).not.toHaveBeenCalled();
    startSetupMeasurement(empty, 'paste');
    startSetupMeasurement(empty, 'paste');
    completeSetupMeasurement(empty);
    expect(analytics.track).toHaveBeenCalledTimes(1);
    completeSetupMeasurement(ready);
    completeSetupMeasurement(ready);
    expect(analytics.track.mock.calls).toEqual([
      ['setup_started', { import_method: 'paste', setup_mode: 'initial' }],
      ['setup_completed', { setup_mode: 'initial', roster_size: 1, platform: ready.platform }],
    ]);
    expect(JSON.stringify(analytics.track.mock.calls)).not.toMatch(/Private player|private-league|nhl:123/);
  });

  it('separates a returning manager refreshing a roster from first-time setup', async () => {
    const { startSetupMeasurement, completeSetupMeasurement } = await import('./measurement');
    const empty = createDefaultLeagueWorkspace({ id: 'refresh-only' });
    const ready = confirmRosterReadiness({ ...empty, scoring: { ...empty.scoring, presetId: 'yahoo' }, roster: [{ playerId: 'nhl:456', fullName: 'Private name', team: 'TOR', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }] });
    startSetupMeasurement(ready, 'paste');
    completeSetupMeasurement(ready);
    expect(analytics.track).toHaveBeenCalledWith('setup_started', { import_method: 'paste', setup_mode: 'refresh' });
    expect(analytics.track).toHaveBeenCalledWith('setup_completed', expect.objectContaining({ setup_mode: 'refresh' }));
  });
});
