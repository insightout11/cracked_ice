const GA_MEASUREMENT_ID = 'G-RXL085H1N9';
const GA_SCRIPT_ATTRIBUTE = 'data-cracked-ice-analytics';

type AnalyticsEvents = {
  complement_run: { mode: 'complement' | 'roster-aware'; anchors: number };
  team_locked: { team: string };
  pairing_shared: { format: 'png' | 'url' };
  schedule_week_view: { source: 'season-page' };
  season_view: { source: 'season-page' };
  coach_reco_run: { mode: 'draft' | 'keeper' | 'league'; window: string; projection_source: 'server' | 'schedule-fallback' };
  roster_created: { source: 'manual' | 'ocr' };
  roster_shared: { mode: 'roster' | 'tonight'; result: 'shared' | 'downloaded' };
  outbound_coffee: { placement: 'header' | 'footer' | 'blog' };
};

type GtagCommand =
  | ['js', Date]
  | ['config', string, Record<string, unknown>]
  | ['event', string, Record<string, unknown>];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagCommand) => void;
  }
}

let initialized = false;

function analyticsAllowed(): boolean {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && navigator.doNotTrack !== '1';
}

export function initializeAnalytics(): boolean {
  if (!analyticsAllowed()) return false;
  if (initialized) return true;

  initialized = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? ((...args: GtagCommand) => {
    window.dataLayer?.push(args);
  });

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {});

  if (!document.querySelector(`script[${GA_SCRIPT_ATTRIBUTE}]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.setAttribute(GA_SCRIPT_ATTRIBUTE, 'true');
    document.head.appendChild(script);
  }

  return true;
}

export function track<Event extends keyof AnalyticsEvents>(
  event: Event,
  params: AnalyticsEvents[Event]
): void {
  if (!initializeAnalytics()) return;
  window.gtag?.('event', event, params);
}
