import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GA4 analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    document.querySelectorAll('script[data-cracked-ice-analytics]').forEach((script) => script.remove());
    delete window.gtag;
    delete window.dataLayer;
    Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, value: '0' });
  });

  it('loads the configured tag once and queues typed events', async () => {
    const { track } = await import('./analytics');

    track('outbound_coffee', { placement: 'header' });
    track('outbound_coffee', { placement: 'footer' });

    expect(document.querySelectorAll('script[data-cracked-ice-analytics]')).toHaveLength(1);
    expect(document.querySelector<HTMLScriptElement>('script[data-cracked-ice-analytics]')?.src)
      .toBe('https://www.googletagmanager.com/gtag/js?id=G-RXL085H1N9');
    expect(window.dataLayer).toEqual(expect.arrayContaining([
      ['config', 'G-RXL085H1N9', {}],
      ['event', 'outbound_coffee', { placement: 'header' }],
      ['event', 'outbound_coffee', { placement: 'footer' }],
    ]));
  });

  it('does not load or queue analytics when Do Not Track is enabled', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, value: '1' });
    const { track } = await import('./analytics');

    track('outbound_coffee', { placement: 'header' });

    expect(document.querySelector('script[data-cracked-ice-analytics]')).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });
});
