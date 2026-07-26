import { SEASON_END, SEASON_START, SCHEDULE_URL } from './season';
import type { LeagueWorkspace } from './leagueWorkspace';

export type PlanningIntent = 'week' | '14d' | '30d' | 'playoffs' | 'rest-of-season';

export interface PlanningWindow {
  intent: PlanningIntent;
  start: string;
  end: string;
  label: string;
}

export interface SeasonScheduleGame {
  date: string;
  opponent: string;
  isHome: boolean;
  startTime?: string;
  isOffNight?: boolean;
}

export interface SeasonScheduleData {
  games: Record<string, SeasonScheduleGame[]>;
}

export interface MatchupWeek {
  index: number;
  start: string;
  end: string;
  label: string;
  isChampionship: boolean;
}

export interface TeamFantasySeasonOpportunity {
  team: string;
  beforePlayoffs: number;
  fantasyPlayoffs: number;
  afterFantasySeason: number;
  fantasyRelevantGames: number;
  fullSeasonGames: number;
}

const DAY_MS = 86_400_000;
let schedulePromise: Promise<SeasonScheduleData> | null = null;

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function addDateDays(date: string, days: number): string {
  return new Date(utcDate(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function buildMatchupWeeks(start: string, end: string): MatchupWeek[] {
  if (end < start) return [];
  const ranges: Array<Omit<MatchupWeek, 'label' | 'isChampionship'>> = [];
  let cursor = start;
  while (cursor <= end) {
    const index = ranges.length + 1;
    const weekEnd = addDateDays(cursor, 6);
    ranges.push({ index, start: cursor, end: weekEnd > end ? end : weekEnd });
    cursor = addDateDays(cursor, 7);
  }
  return ranges.map((range, index) => ({
    ...range,
    label: index === ranges.length - 1 ? 'Championship' : `Playoff ${range.index}`,
    isChampionship: index === ranges.length - 1,
  }));
}

export function buildFantasySeasonOpportunity(
  schedule: SeasonScheduleData,
  workspace: LeagueWorkspace,
): Record<string, TeamFantasySeasonOpportunity> {
  const playoffStart = workspace.schedule.playoffs.start;
  const fantasySeasonEnd = workspace.schedule.playoffs.end;
  return Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => {
    const seasonGames = games.filter((game) => game.date >= workspace.season.start && game.date <= workspace.season.end);
    const beforePlayoffs = seasonGames.filter((game) => game.date < playoffStart).length;
    const fantasyPlayoffs = seasonGames.filter((game) => game.date >= playoffStart && game.date <= fantasySeasonEnd).length;
    const afterFantasySeason = seasonGames.filter((game) => game.date > fantasySeasonEnd).length;
    return [team, {
      team,
      beforePlayoffs,
      fantasyPlayoffs,
      afterFantasySeason,
      fantasyRelevantGames: beforePlayoffs + fantasyPlayoffs,
      fullSeasonGames: seasonGames.length,
    }];
  }));
}

function clamp(date: string): string {
  return date < SEASON_START ? SEASON_START : date > SEASON_END ? SEASON_END : date;
}

export function planningIntentFromWorkspace(workspace: LeagueWorkspace): PlanningIntent {
  const saved = workspace.schedule.defaultWindow;
  if (saved.preset === '14d') return '14d';
  if (saved.preset === '30d') return '30d';
  if (saved.preset === 'rest-of-season' || saved.preset === 'season') return 'rest-of-season';
  if (saved.start === workspace.schedule.playoffs.start && saved.end === workspace.schedule.playoffs.end) return 'playoffs';
  return 'week';
}

export function resolvePlanningWindow(intent: PlanningIntent, selectedWeekStart: string, workspace: LeagueWorkspace): PlanningWindow {
  const start = clamp(intent === 'playoffs' ? workspace.schedule.playoffs.start : selectedWeekStart);
  const end = clamp(intent === 'week'
    ? addDateDays(start, 6)
    : intent === '14d'
      ? addDateDays(start, 13)
      : intent === '30d'
        ? addDateDays(start, 29)
        : intent === 'playoffs'
          ? workspace.schedule.playoffs.end
          : SEASON_END);
  const label = intent === 'week' ? 'Selected week'
    : intent === '14d' ? 'Next 14 days'
      : intent === '30d' ? 'Next 30 days'
        : intent === 'playoffs' ? 'Fantasy playoffs'
          : 'Rest of season';
  return { intent, start, end: end < start ? start : end, label };
}

export function workspaceWindowPreset(window: PlanningWindow): LeagueWorkspace['schedule']['defaultWindow'] {
  const preset = window.intent === '14d' ? '14d'
    : window.intent === '30d' ? '30d'
      : window.intent === 'rest-of-season' ? 'rest-of-season'
        : 'custom';
  return { preset, start: window.start, end: window.end };
}

export function formatGameStartTime(start?: string): string | null {
  if (!start) return null;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
}

export function loadSeasonSchedule(): Promise<SeasonScheduleData> {
  schedulePromise ??= fetch(SCHEDULE_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
    return response.json() as Promise<SeasonScheduleData>;
  });
  return schedulePromise;
}

export function calculateRangeStreamingValues(
  schedule: SeasonScheduleData,
  window: Pick<PlanningWindow, 'start' | 'end'>,
  unusedSlotsByDate: Record<string, Record<string, number>>,
  rosterTeamCodes: Iterable<string>,
) {
  const ownedTeams = new Set(rosterTeamCodes);
  return Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => {
    const rangeGames = games.filter((game) => game.date >= window.start && game.date <= window.end);
    const gapDatesCovered = rangeGames
      .filter((game) => Object.values(unusedSlotsByDate[game.date] ?? {}).some((count) => count > 0))
      .map((game) => game.date);
    return [team, {
      team,
      extraUsableStarts: gapDatesCovered.length,
      gapDatesCovered,
      representedOnRoster: ownedTeams.has(team),
      gamesInWindow: rangeGames.length,
    }];
  }));
}
