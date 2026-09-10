export interface HomeActionContext {
  leagueId?: string;
  date?: string;
  source: 'home-briefing' | 'home-tool';
  returnTo?: string;
}

function safeReturnPath(value?: string): string | undefined {
  return value?.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

export function buildHomeActionLink(path: string, context: HomeActionContext): string {
  const [pathname, existingSearch = ''] = path.split('?');
  const params = new URLSearchParams(existingSearch);
  if (context.leagueId) params.set('league', context.leagueId);
  if (context.date) params.set('date', context.date);
  params.set('source', context.source);
  const returnTo = safeReturnPath(context.returnTo);
  if (returnTo) params.set('return', returnTo);
  return `${pathname}?${params}`;
}

export function parseHomeActionContext(search: string): HomeActionContext | null {
  const params = new URLSearchParams(search);
  const source = params.get('source');
  if (source !== 'home-briefing' && source !== 'home-tool') return null;
  return { leagueId: params.get('league') ?? undefined, date: params.get('date') ?? undefined, source, returnTo: safeReturnPath(params.get('return') ?? undefined) };
}

export function replaceLeagueContext(search: string, leagueId: string): string {
  const params = new URLSearchParams(search);
  params.set('league', leagueId);
  return `?${params}`;
}

export function parseRosterSetupIntent(search: string): 'import' | 'review' | null {
  const setup = new URLSearchParams(search).get('setup');
  return setup === 'import' || setup === 'review' ? setup : null;
}
