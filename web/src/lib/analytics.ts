const GA_MEASUREMENT_ID = 'G-RXL085H1N9';
const GA_SCRIPT_ATTRIBUTE = 'data-cracked-ice-analytics';
const GA_DEBUG_SESSION_KEY = 'cracked-ice-ga-debug';

type AnalyticsEvents = {
  complement_run: { mode: 'complement' | 'roster-aware'; anchors: number };
  team_locked: { team: string };
  pairing_shared: { format: 'png' | 'url' };
  schedule_week_view: { week: string };
  season_view: { source: 'season-page' };
  player_comparison_completed: { mode: 'draft' | 'keeper' | 'league'; window: string; projection_source: 'server' | 'schedule-fallback' };
  roster_created: { source: 'manual' | 'ocr' };
  roster_shared: { mode: 'roster' | 'tonight'; result: 'shared' | 'downloaded' };
  league_settings_saved: { platform: string; scoring_profile: string; team_count: number };
  account_sign_in: { method: 'magic_link' };
  workspace_sync_completed: { source: 'first_upload' | 'automatic_merge' | 'reviewed_merge' };
  draft_board_action: { action: 'drafted_mine' | 'drafted_other' | 'bulk_picks' | 'target_added' | 'target_removed' | 'rank_adjusted'; position: string };
  article_tool_click: { article_id: string; destination: 'optimizer' | 'compare' | 'season' };
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
let configuredForDebug = false;

function analyticsAllowed(debugEnabled: boolean): boolean {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && (navigator.doNotTrack !== '1' || debugEnabled);
}

function analyticsDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const debugParam = new URLSearchParams(window.location.search).get('ga_debug');
  try {
    if (debugParam === '1') window.sessionStorage.setItem(GA_DEBUG_SESSION_KEY, '1');
    if (debugParam === '0') window.sessionStorage.removeItem(GA_DEBUG_SESSION_KEY);
    return debugParam === '1' || (debugParam !== '0' && window.sessionStorage.getItem(GA_DEBUG_SESSION_KEY) === '1');
  } catch {
    return debugParam === '1';
  }
}

export function initializeAnalytics(): boolean {
  const debugEnabled = analyticsDebugEnabled();
  if (!analyticsAllowed(debugEnabled)) return false;
  if (initialized) {
    if (debugEnabled && !configuredForDebug) {
      window.gtag?.('config', GA_MEASUREMENT_ID, { debug_mode: true });
      configuredForDebug = true;
    }
    return true;
  }

  initialized = true;
  configuredForDebug = debugEnabled;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(..._args: GtagCommand) {
    window.dataLayer?.push(arguments);
  };

  if (!document.querySelector(`script[${GA_SCRIPT_ATTRIBUTE}]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.setAttribute(GA_SCRIPT_ATTRIBUTE, 'true');
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, debugEnabled ? { debug_mode: true } : {});

  return true;
}

export function track<Event extends keyof AnalyticsEvents>(
  event: Event,
  params: AnalyticsEvents[Event]
): void {
  if (!initializeAnalytics()) return;
  window.gtag?.('event', event, analyticsDebugEnabled() ? { ...params, debug_mode: true } : params);
}
