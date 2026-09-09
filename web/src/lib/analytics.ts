type AnalyticsEvents = {
  complement_run: { mode: 'complement' | 'roster-aware'; anchors: number };
  team_locked: { team: string };
  pairing_shared: { format: 'png' | 'url' };
  schedule_week_view: { source: 'season-page' };
  season_view: { source: 'season-page' };
  home_view: { state: 'none' | 'incomplete' | 'ready' | 'needs-review' | 'schedule-error'; phase: 'preseason' | 'regular-season' | 'outside-coverage' };
  home_tool_action: { action: 'compare' | 'draft' | 'schedule-fit'; state: 'public' | 'personalized' };
  home_setup_action: { action: 'confirm-roster' | 'open-import' | 'review'; state: 'none' | 'incomplete' | 'ready' | 'needs-review' };
  home_setup_complete: { method: 'manual-confirmation' | 'provider-sync' };
};

declare global {
  interface Window {
    gtag?: (command: 'event', event: string, params?: Record<string, unknown>) => void;
  }
}

export function track<Event extends keyof AnalyticsEvents>(
  event: Event,
  params: AnalyticsEvents[Event]
): void {
  if (navigator.doNotTrack === '1') return;
  window.gtag?.('event', event, params);
}
