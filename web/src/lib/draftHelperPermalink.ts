import type { TimeWindowState } from '../types/timeWindow';

export interface DraftHelperPermalinkState {
  inputMode: 'players' | 'teams';
  playerIds: string[];
  stackedTeams: string[];
  teamAnchors: string[];
  slots: number;
  customSlots: boolean;
  selectedTeam: string | null;
}

const DRAFT_PARAMS = [
  'draft',
  'players',
  'stack',
  'teams',
  'slots',
  'customSlots',
  'result',
] as const;

const TIME_PARAMS = ['mode', 'tw', 'playoff', 'weeks', 'weekStart', 'start', 'end'] as const;

function parseList(value: string | null, pattern: RegExp, limit: number): string[] {
  if (!value) return [];
  return [...new Set(value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => pattern.test(item)))]
    .slice(0, limit);
}

function parseTeamList(value: string | null): string[] {
  return parseList(value?.toUpperCase() ?? null, /^[A-Z]{2,4}$/, 10);
}

export function parseDraftHelperPermalink(search: string): DraftHelperPermalinkState | null {
  const params = new URLSearchParams(search);
  if (!DRAFT_PARAMS.some((param) => params.has(param))) return null;

  const inputMode = params.get('draft') === 'teams' ? 'teams' : 'players';
  const parsedSlots = Number(params.get('slots'));
  const slots = Number.isInteger(parsedSlots) && parsedSlots >= 1 && parsedSlots <= 10
    ? parsedSlots
    : 2;
  const selectedTeam = parseTeamList(params.get('result'))[0] ?? null;

  return {
    inputMode,
    playerIds: parseList(params.get('players'), /^[A-Za-z0-9:_-]{1,40}$/, 10),
    stackedTeams: parseTeamList(params.get('stack')),
    teamAnchors: parseTeamList(params.get('teams')),
    slots,
    customSlots: params.get('customSlots') === '1',
    selectedTeam,
  };
}

function setTimeWindowParams(params: URLSearchParams, state: TimeWindowState): void {
  params.set('mode', state.mode);
  if (state.mode === 'regular') {
    params.set('tw', state.preset);
    if (state.preset === 'custom' && state.customRange) {
      params.set('start', state.customRange.start);
      params.set('end', state.customRange.end);
    }
    return;
  }

  if (state.mode !== 'playoff' || !state.playoffMode) return;
  params.set('playoff', state.playoffMode.preset);
  if (state.playoffMode.preset === 'league-weeks' && state.playoffMode.leagueWeekConfig) {
    params.set('weeks', state.playoffMode.leagueWeekConfig.selectedWeeks.join(','));
    const weekStart = state.playoffMode.leagueWeekConfig.weekStartDay;
    params.set('weekStart', weekStart === 'sunday' ? 'sun' : weekStart === 'saturday' ? 'sat' : 'mon');
  }
  if (state.playoffMode.preset === 'custom' && state.customRange) {
    params.set('start', state.customRange.start);
    params.set('end', state.customRange.end);
  }
}

export function buildDraftHelperPermalink(
  baseUrl: string,
  draftState: DraftHelperPermalinkState,
  timeWindowState: TimeWindowState
): string {
  const url = new URL(baseUrl);
  for (const param of [...DRAFT_PARAMS, ...TIME_PARAMS]) url.searchParams.delete(param);

  url.searchParams.set('draft', draftState.inputMode);
  if (draftState.inputMode === 'players') {
    if (draftState.playerIds.length) url.searchParams.set('players', draftState.playerIds.join(','));
    if (draftState.stackedTeams.length) url.searchParams.set('stack', draftState.stackedTeams.join(','));
  } else if (draftState.teamAnchors.length) {
    url.searchParams.set('teams', draftState.teamAnchors.join(','));
  }
  url.searchParams.set('slots', String(draftState.slots));
  if (draftState.customSlots) url.searchParams.set('customSlots', '1');
  if (draftState.selectedTeam) url.searchParams.set('result', draftState.selectedTeam);
  setTimeWindowParams(url.searchParams, timeWindowState);
  url.hash = '';
  return url.toString();
}
