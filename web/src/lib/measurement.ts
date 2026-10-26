import { initializeAnalytics, track } from './analytics';
import { selectRosterReadiness } from './homeReadiness';
import type { LeagueWorkspace } from './leagueWorkspace';

const seen = new Set<string>();
const setupAttempts = new Map<string, 'initial' | 'refresh'>();

/** Session-only deduplication; workspace identifiers never leave this browser. */
export function measureOnce(key: string, record: () => void): void {
  if (!initializeAnalytics()) return;
  const storageKey = `cracked-ice-measurement:${key}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
  } catch { /* In-memory deduplication still works when storage is blocked. */ }
  if (seen.has(storageKey)) return;
  seen.add(storageKey);
  try { window.sessionStorage.setItem(storageKey, '1'); } catch { /* optional */ }
  record();
}

export function planMode(workspace: LeagueWorkspace): 'personalized' | 'demo' {
  return workspace.roster.some((entry) => entry.playerId.startsWith('demo-') || entry.team === 'TEST') ? 'demo' : 'personalized';
}

export function startSetupMeasurement(workspace: LeagueWorkspace, method: 'paste' | 'screenshots' | 'manual'): void {
  if (!initializeAnalytics() || setupAttempts.has(workspace.id)) return;
  const mode = selectRosterReadiness(workspace) === 'ready' && workspace.scoring.presetId !== 'default' ? 'refresh' : 'initial';
  setupAttempts.set(workspace.id, mode);
  track('setup_started', { import_method: method, setup_mode: mode });
}

/** Only user-started imports can complete setup; loading a saved account cannot. */
export function completeSetupMeasurement(workspace: LeagueWorkspace): void {
  const mode = setupAttempts.get(workspace.id);
  if (!mode || selectRosterReadiness(workspace) !== 'ready' || workspace.scoring.presetId === 'default' || planMode(workspace) === 'demo') return;
  setupAttempts.delete(workspace.id);
  track('setup_completed', { setup_mode: mode, roster_size: workspace.roster.length, platform: workspace.platform });
}

export function articleToolDestination(href: string, origin: string): 'optimizer' | 'compare' | 'season' | 'team' | 'draft' | 'card' | null {
  try {
    const url = new URL(href, origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.origin !== origin && !['www.crackedicehockey.com', 'crackedicehockey.com'].includes(url.hostname)) return null;
    const path = url.pathname.replace(/\/+$/, '');
    const destinations = { '/optimizer': 'optimizer', '/compare': 'compare', '/season': 'season', '/team': 'team', '/draft': 'draft', '/card': 'card' } as const;
    return destinations[path as keyof typeof destinations] ?? null;
  } catch { return null; }
}
