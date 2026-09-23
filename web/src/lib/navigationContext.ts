export interface HomeActionContext {
  leagueId?: string;
  date?: string;
  source: 'home-briefing' | 'home-tool' | 'home-recommendation';
  returnTo?: string;
  windowStart?: string;
  windowEnd?: string;
  timeWindowPreset?: string;
  scenarioId?: string;
  calculationFingerprint?: string;
  additionId?: string;
  dropId?: string;
}

function safeReturnPath(value?: string): string | undefined {
  return value?.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

export function buildHomeActionLink(path: string, context: HomeActionContext): string {
  const [pathAndSearch, hash = ''] = path.split('#');
  const [pathname, existingSearch = ''] = pathAndSearch.split('?');
  const params = new URLSearchParams(existingSearch);
  if (context.leagueId) params.set('league', context.leagueId);
  if (context.date) params.set('date', context.date);
  params.set('source', context.source);
  const returnTo = safeReturnPath(context.returnTo);
  if (returnTo) params.set('return', returnTo);
  if (context.windowStart) params.set('start', context.windowStart);
  if (context.windowEnd) params.set('end', context.windowEnd);
  if (context.timeWindowPreset) params.set('tw', context.timeWindowPreset);
  if (context.scenarioId) params.set('scenario', context.scenarioId);
  if (context.calculationFingerprint) params.set('fingerprint', context.calculationFingerprint);
  if (context.additionId) params.set('add', context.additionId);
  if (context.dropId) params.set('drop', context.dropId);
  return `${pathname}?${params}${hash ? `#${hash}` : ''}`;
}

export function parseHomeActionContext(search: string): HomeActionContext | null {
  const params = new URLSearchParams(search);
  const source = params.get('source');
  if (source !== 'home-briefing' && source !== 'home-tool' && source !== 'home-recommendation') return null;
  return {
    leagueId: params.get('league') ?? undefined,
    date: params.get('date') ?? undefined,
    source,
    returnTo: safeReturnPath(params.get('return') ?? undefined),
    windowStart: params.get('start') ?? undefined,
    windowEnd: params.get('end') ?? undefined,
    timeWindowPreset: params.get('tw') ?? undefined,
    scenarioId: params.get('scenario') ?? undefined,
    calculationFingerprint: params.get('fingerprint') ?? undefined,
    additionId: params.get('add') ?? undefined,
    dropId: params.get('drop') ?? undefined,
  };
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

export function resolveRecommendationHandoff(scenarios: AcquisitionScenario[], context: HomeActionContext | null): { scenario: AcquisitionScenario | null; state: 'none' | 'exact' | 'recalculated' | 'missing' } {
  if (context?.source !== 'home-recommendation' || !context.scenarioId) return { scenario: null, state: 'none' };
  const normalize = (id?: string | null) => id?.replace(/^nhl:/, '');
  const scenario = scenarios.find((item) => item.id === context.scenarioId)
    ?? scenarios.find((item) => normalize(item.addition.id) === normalize(context.additionId) && normalize(item.drop?.id) === normalize(context.dropId))
    ?? null;
  if (!scenario) return { scenario: null, state: 'missing' };
  return { scenario, state: !context.calculationFingerprint || scenario.calculationFingerprint === context.calculationFingerprint ? 'exact' : 'recalculated' };
}
import type { AcquisitionScenario } from './acquisitionScenarios';
