export const PRIMARY_NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/team', label: 'My Team', end: false },
  { to: '/season', label: 'Schedule', end: false },
] as const;

export const TOOL_NAV_ITEMS = [
  { to: '/optimizer', label: 'Schedule Fit' },
  { to: '/draft', label: 'Draft Board' },
  { to: '/compare', label: 'Compare Players' },
  { to: '/blog', label: 'Guides' },
] as const;

const FIT_SIGNATURES = ['draft', 'players', 'stack', 'teams', 'slots', 'customSlots', 'result'] as const;
const LEGACY_TIME_SIGNATURES = ['mode', 'tw', 'playoff', 'weeks', 'weekStart', 'start', 'end'] as const;

export type RootExperience = 'home' | 'draft' | 'fit';

export function resolveRootExperience(search: string): RootExperience {
  const params = new URLSearchParams(search);
  if (params.get('tool') === 'draft') return 'draft';
  if (params.get('tool') === 'fit') return 'fit';
  if (FIT_SIGNATURES.some((key) => params.has(key))) return 'fit';
  if (LEGACY_TIME_SIGNATURES.some((key) => params.has(key))) return 'fit';
  return 'home';
}

export function rootShowsHome(search: string): boolean {
  return resolveRootExperience(search) === 'home';
}
