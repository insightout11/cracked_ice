import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('local analytics isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PROD', true); // Even a production build on localhost stays isolated.
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    document.querySelectorAll('script[data-cracked-ice-analytics]').forEach((script) => script.remove());
    delete window.dataLayer;
    delete window.gtag;
  });

  it('collects nothing by default on localhost', async () => {
    const { track } = await import('./analytics');
    track('outbound_coffee', { placement: 'header' });
    expect(window.dataLayer).toBeUndefined();
    expect(document.querySelector('script[data-cracked-ice-analytics]')).toBeNull();
  });

  it('supports queue-only local QA without loading the Google tag', async () => {
    window.history.replaceState({}, '', '/?ga_debug=1');
    const { track } = await import('./analytics');
    track('schedule_week_view', { week: '2026-10-26' });
    expect(document.querySelector('script[data-cracked-ice-analytics]')).toBeNull();
    expect(window.dataLayer).toHaveLength(3);
  });
});
