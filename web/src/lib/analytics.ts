const GA_MEASUREMENT_ID = 'G-RXL085H1N9';
const GA_SCRIPT_ATTRIBUTE = 'data-cracked-ice-analytics';
const GA_DEBUG_SESSION_KEY = 'cracked-ice-ga-debug';
const GA_EXCLUDED_KEY = 'cracked-ice-analytics-excluded';
const PRODUCTION_HOSTS = new Set(['crackedicehockey.com', 'www.crackedicehockey.com']);

type AnalyticsEvents = {
  complement_run: { mode: 'complement' | 'roster-aware'; anchors: number };
  team_locked: { team: string };
  pairing_shared: { format: 'png' | 'url' };
  schedule_week_view: { week: string };
  season_view: { source: 'season-page' };
  player_comparison_completed: { mode: 'draft' | 'keeper' | 'league'; window: string; projection_source: 'server' | 'schedule-fallback'; production_basis?: 'last-season' | 'projection' };
  roster_created: { source: 'manual' | 'ocr' };
  roster_shared: { mode: 'roster' | 'teamcard' | 'startsit' | 'week' | 'startsit-text'; result: 'shared' | 'downloaded' | 'copied' };
  league_settings_saved: { platform: string; scoring_profile: string; team_count: number };
  account_sign_in: { method: 'magic_link' };
  workspace_sync_completed: { source: 'first_upload' | 'automatic_merge' | 'reviewed_merge' | 'account_cache_refresh' };
  draft_board_action: { action: 'drafted_mine' | 'drafted_other' | 'bulk_picks' | 'target_added' | 'target_removed' | 'rank_adjusted'; position: string };
  article_tool_click: { article_id: string; destination: 'optimizer' | 'compare' | 'season' | 'team' | 'draft' | 'card'; placement?: 'body' | 'footer' };
  setup_started: { import_method: 'paste' | 'screenshots' | 'manual'; setup_mode: 'initial' | 'refresh' };
  setup_completed: { setup_mode: 'initial' | 'refresh'; roster_size: number; platform: string };
  weekly_plan_viewed: { week: string; surface: 'home' | 'team'; plan_mode: 'personalized' | 'demo'; roster_size: number; recommended_adds: number; recommendation: 'add' | 'hold' | 'limit-reached' };
  weekly_plan_action: { week: string; action: 'inspect_player' | 'mark_taken' | 'change_range'; plan_mode: 'personalized' | 'demo' };
  article_related_click: { article_id: string; destination: string };
  outbound_coffee: { placement: 'header' | 'footer' | 'blog' };
  roster_card_created: { source: 'paste' | 'saved' | 'sample' | 'league'; players: number; verdict: string; writer: 'ai' | 'local'; level: 'friendly' | 'savage' };
  roster_card_shared: { format: 'shared' | 'downloaded' | 'link' | 'text'; side?: 'front' | 'back' };
  roster_card_saved: { destination: 'active' | 'new-league' };
  roster_card_next: { destination: 'season' | 'team' };
  roster_card_promo_click: { placement: 'home' };
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
    && !analyticsExcluded()
    && (isProductionAnalytics() || debugEnabled)
    && (navigator.doNotTrack !== '1' || debugEnabled);
}

function isProductionAnalytics(): boolean {
  return import.meta.env.PROD && PRODUCTION_HOSTS.has(window.location.hostname);
}

function analyticsExcluded(): boolean {
  const choice = new URLSearchParams(window.location.search).get('analytics');
  try {
    if (choice === 'off') window.localStorage.setItem(GA_EXCLUDED_KEY, '1');
    if (choice === 'on') window.localStorage.removeItem(GA_EXCLUDED_KEY);
    return choice === 'off' || (choice !== 'on' && window.localStorage.getItem(GA_EXCLUDED_KEY) === '1');
  } catch {
    return choice === 'off';
  }
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
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const debugEnabled = analyticsDebugEnabled();
  const allowed = analyticsAllowed(debugEnabled);
  // Also stops an already-loaded tag's automatic history/page-view collection.
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = !allowed;
  if (!allowed) return false;
  if (initialized) {
    if (debugEnabled !== configuredForDebug) {
      window.gtag?.('config', GA_MEASUREMENT_ID, { debug_mode: debugEnabled, traffic_type: debugEnabled ? 'internal' : 'external', send_page_view: false });
      configuredForDebug = debugEnabled;
    }
    return true;
  }

  initialized = true;
  configuredForDebug = debugEnabled;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(..._args: GtagCommand) {
    window.dataLayer?.push(arguments);
  };

  // Local and preview QA queue inspectable events but never contact Google.
  if (isProductionAnalytics() && !document.querySelector(`script[${GA_SCRIPT_ATTRIBUTE}]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.setAttribute(GA_SCRIPT_ATTRIBUTE, 'true');
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, debugEnabled ? { debug_mode: true, traffic_type: 'internal' } : {});

  return true;
}

export function track<Event extends keyof AnalyticsEvents>(
  event: Event,
  params: AnalyticsEvents[Event]
): void {
  if (!initializeAnalytics()) return;
  const payload: Record<string, unknown> = { ...params };
  // GA interprets `source` as acquisition data. Existing callers keep their
  // typed context; only the wire parameter changes, preserving event names.
  if ('source' in payload) {
    payload.event_origin = payload.source;
    delete payload.source;
  }
  window.gtag?.('event', event, analyticsDebugEnabled() ? { ...payload, debug_mode: true, traffic_type: 'internal' } : payload);
}
