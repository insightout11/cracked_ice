// @vitest-environment-options {"url":"https://www.crackedicehockey.com"}
import { beforeEach, describe, expect, it, vi } from 'vitest';

function queuedCommands(): unknown[][] {
  return (window.dataLayer ?? []).map((command) => Array.from(command as ArrayLike<unknown>));
}

describe('GA4 analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    window.localStorage.clear();
    document.querySelectorAll('script[data-cracked-ice-analytics]').forEach((script) => script.remove());
    delete window.gtag;
    delete window.dataLayer;
    Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, value: '0' });
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('loads the configured tag once and queues typed events', async () => {
    const { track } = await import('./analytics');

    track('outbound_coffee', { placement: 'header' });
    track('outbound_coffee', { placement: 'footer' });

    expect(document.querySelectorAll('script[data-cracked-ice-analytics]')).toHaveLength(1);
    expect(document.querySelector<HTMLScriptElement>('script[data-cracked-ice-analytics]')?.src)
      .toBe('https://www.googletagmanager.com/gtag/js?id=G-RXL085H1N9');
    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['config', 'G-RXL085H1N9', {}],
      ['event', 'outbound_coffee', { placement: 'header' }],
      ['event', 'outbound_coffee', { placement: 'footer' }],
    ]));
  });

  it('queues the focused funnel events with non-identifying parameters', async () => {
    const { track } = await import('./analytics');

    track('schedule_week_view', { week: '2026-10-12' });
    track('player_comparison_completed', { mode: 'draft', window: 'playoffs', projection_source: 'server' });
    track('league_settings_saved', { platform: 'yahoo', scoring_profile: 'yahoo-points', team_count: 12 });
    track('account_sign_in', { method: 'magic_link' });
    track('workspace_sync_completed', { source: 'automatic_merge' });
    track('draft_board_action', { action: 'target_added', position: 'RW' });
    track('article_tool_click', { article_id: 'schedule-math', destination: 'optimizer' });

    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['event', 'schedule_week_view', { week: '2026-10-12' }],
      ['event', 'player_comparison_completed', { mode: 'draft', window: 'playoffs', projection_source: 'server' }],
      ['event', 'league_settings_saved', { platform: 'yahoo', scoring_profile: 'yahoo-points', team_count: 12 }],
      ['event', 'account_sign_in', { method: 'magic_link' }],
      ['event', 'workspace_sync_completed', { event_origin: 'automatic_merge' }],
      ['event', 'draft_board_action', { action: 'target_added', position: 'RW' }],
      ['event', 'article_tool_click', { article_id: 'schedule-math', destination: 'optimizer' }],
    ]));
  });

  it('does not load or queue analytics when Do Not Track is enabled', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, value: '1' });
    const { track } = await import('./analytics');

    track('outbound_coffee', { placement: 'header' });

    expect(document.querySelector('script[data-cracked-ice-analytics]')).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it('allows an explicit debug session to override Do Not Track for owner QA', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, value: '1' });
    window.history.replaceState({}, '', '/?ga_debug=1');
    const { track } = await import('./analytics');

    track('schedule_week_view', { week: '2026-10-12' });

    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['config', 'G-RXL085H1N9', { debug_mode: true, traffic_type: 'internal' }],
      ['event', 'schedule_week_view', { week: '2026-10-12', debug_mode: true, traffic_type: 'internal' }],
    ]));
  });

  it('upgrades an initialized session when debug mode is enabled later', async () => {
    const { track } = await import('./analytics');
    track('schedule_week_view', { week: '2026-10-12' });

    window.history.replaceState({}, '', '/team?ga_debug=1');
    track('league_settings_saved', { platform: 'manual', scoring_profile: 'custom', team_count: 12 });

    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['config', 'G-RXL085H1N9', { debug_mode: true, traffic_type: 'internal', send_page_view: false }],
      ['event', 'league_settings_saved', { platform: 'manual', scoring_profile: 'custom', team_count: 12, debug_mode: true, traffic_type: 'internal' }],
    ]));
  });

  it('marks config and events for GA4 DebugView when requested in the URL', async () => {
    window.history.replaceState({}, '', '/?ga_debug=1');
    const { track } = await import('./analytics');

    track('schedule_week_view', { week: '2026-10-12' });

    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['config', 'G-RXL085H1N9', { debug_mode: true, traffic_type: 'internal' }],
      ['event', 'schedule_week_view', { week: '2026-10-12', debug_mode: true, traffic_type: 'internal' }],
    ]));

    window.history.replaceState({}, '', '/team');
    track('league_settings_saved', { platform: 'manual', scoring_profile: 'custom', team_count: 12 });
    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['event', 'league_settings_saved', { platform: 'manual', scoring_profile: 'custom', team_count: 12, debug_mode: true, traffic_type: 'internal' }],
    ]));
  });

  it('allows session debug mode to be explicitly disabled', async () => {
    window.history.replaceState({}, '', '/?ga_debug=1');
    const { track } = await import('./analytics');
    track('schedule_week_view', { week: '2026-10-12' });

    window.history.replaceState({}, '', '/team?ga_debug=0');
    track('league_settings_saved', { platform: 'manual', scoring_profile: 'custom', team_count: 12 });

    expect(queuedCommands()).toEqual(expect.arrayContaining([
      ['event', 'league_settings_saved', { platform: 'manual', scoring_profile: 'custom', team_count: 12 }],
      ['config', 'G-RXL085H1N9', { debug_mode: false, traffic_type: 'external', send_page_view: false }],
    ]));
  });

  it('keeps context sources out of GA acquisition parameters', async () => {
    const { track } = await import('./analytics');
    track('season_view', { source: 'season-page' });
    track('roster_created', { source: 'manual' });
    track('roster_card_created', { source: 'sample', players: 10, verdict: 'test', writer: 'local', level: 'friendly' });
    const events = queuedCommands().filter(([command]) => command === 'event');
    expect(events).toHaveLength(3);
    for (const [, , params] of events) expect(params).not.toHaveProperty('source');
    expect(events[0][2]).toEqual({ event_origin: 'season-page' });
  });

  it('persists owner exclusion, stops an existing tag, and allows explicit re-enabling', async () => {
    const { track } = await import('./analytics');
    track('outbound_coffee', { placement: 'header' });
    const count = queuedCommands().length;
    window.history.replaceState({}, '', '/?analytics=off');
    track('outbound_coffee', { placement: 'footer' });
    window.history.replaceState({}, '', '/team');
    track('outbound_coffee', { placement: 'footer' });
    expect(queuedCommands()).toHaveLength(count);
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-RXL085H1N9']).toBe(true);
    window.history.replaceState({}, '', '/?analytics=on');
    track('outbound_coffee', { placement: 'footer' });
    expect(queuedCommands()).toHaveLength(count + 1);
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-RXL085H1N9']).toBe(false);
  });
});
