type AnalyticsEvents = {
  complement_run: { mode: 'complement' | 'roster-aware'; anchors: number };
  team_locked: { team: string };
  pairing_shared: { format: 'png' | 'url' };
  schedule_week_view: { source: 'season-page' };
  season_view: { source: 'season-page' };
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
