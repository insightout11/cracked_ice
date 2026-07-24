import { addDays, format } from 'date-fns';
import type { DayId, TeamWeek, WeeklySchedule } from './schedule';

export interface TeamStreamingValue {
  team: string;
  extraUsableStarts: number;
  gapDatesCovered: string[];
  representedOnRoster: boolean;
}

export type ScheduleTeamScope = 'league' | 'roster';
export type ScheduleTeamOrder = 'schedule' | 'opportunity';

export function selectScheduleTeams(
  teams: TeamWeek[],
  scope: ScheduleTeamScope,
  order: ScheduleTeamOrder,
  rosterTeamCodes: Iterable<string>,
  streamingValues: Record<string, TeamStreamingValue>,
): TeamWeek[] {
  const ownedTeams = new Set(rosterTeamCodes);
  const scopedTeams = scope === 'roster' ? teams.filter((team) => ownedTeams.has(team.team)) : [...teams];
  if (order !== 'opportunity') return scopedTeams;

  return scopedTeams.sort((a, b) => {
    const opportunityDifference = (streamingValues[b.team]?.extraUsableStarts ?? 0) - (streamingValues[a.team]?.extraUsableStarts ?? 0);
    if (opportunityDifference !== 0) return opportunityDifference;
    const games = (team: TeamWeek) => Object.values(team.gamesByDay).reduce((total, dayGames) => total + dayGames.length, 0);
    return games(b) - games(a) || a.team.localeCompare(b.team);
  });
}

export function calculateTeamStreamingValues(
  schedule: WeeklySchedule,
  unusedSlotsByDate: Record<string, Record<string, number>>,
  rosterTeamCodes: Iterable<string>,
): Record<string, TeamStreamingValue> {
  const ownedTeams = new Set(rosterTeamCodes);
  return Object.fromEntries(schedule.teams.map((team) => {
    const gapDatesCovered = schedule.days.flatMap((day, index) => {
      if ((team.gamesByDay[day.id]?.length ?? 0) === 0) return [];
      const date = format(addDays(new Date(schedule.weekOf), index), 'yyyy-MM-dd');
      const hasRoom = Object.values(unusedSlotsByDate[date] ?? {}).some((count) => count > 0);
      return hasRoom ? [date] : [];
    });
    return [team.team, { team: team.team, extraUsableStarts: gapDatesCovered.length, gapDatesCovered, representedOnRoster: ownedTeams.has(team.team) }];
  }));
}

export function getGapDayLabels(
  schedule: WeeklySchedule,
  unusedSlotsByDate: Record<string, Record<string, number>>,
): DayId[] {
  return schedule.days.flatMap((day, index) => {
    const date = format(addDays(new Date(schedule.weekOf), index), 'yyyy-MM-dd');
    return Object.values(unusedSlotsByDate[date] ?? {}).some((count) => count > 0) ? [day.id] : [];
  });
}
