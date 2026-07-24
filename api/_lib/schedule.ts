import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { teamName } from './teams';
import { SCHEDULE_FILE, SEASON_START } from './season';

// Schedule data file consumed by the analysis endpoints, sourced from
// config/season.json via ./season.
export { SCHEDULE_FILE };

export interface ScheduleContext {
  sets: Map<string, Set<string>>;      // triCode -> set of game dates (YYYY-MM-DD)
  teamNameMap: Map<string, string>;    // triCode -> full team name
}

export function loadScheduleContext(): ScheduleContext | null {
  try {
    const dataPath = join(process.cwd(), 'data', SCHEDULE_FILE);

    if (!existsSync(dataPath)) {
      console.error('Schedule data not found:', dataPath);
      return null;
    }

    const data = JSON.parse(readFileSync(dataPath, 'utf8'));

    const sets = new Map<string, Set<string>>();
    const teamNameMap = new Map<string, string>();

    for (const [teamCode, dates] of Object.entries(data.teams)) {
      sets.set(teamCode, new Set(dates as string[]));
      teamNameMap.set(teamCode, teamName(teamCode));
    }

    return { sets, teamNameMap };
  } catch (error) {
    console.error('Error loading schedule context:', error);
    return null;
  }
}

// End of fantasy week 21 (last week before typical fantasy playoffs).
// Season start comes from config/season.json via ./season.
export function calculateBeforePlayoffsEndDate(): string {
  const seasonStart = new Date(SEASON_START);

  // Week 1 starts on the first Monday on or after the season start.
  const firstMonday = new Date(seasonStart);
  const dayOfWeek = firstMonday.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysToAdd = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
  firstMonday.setDate(firstMonday.getDate() + daysToAdd);

  // Week 21 ends on the Sunday 20 weeks after Week 1 starts.
  const week21End = new Date(firstMonday);
  week21End.setDate(week21End.getDate() + (20 * 7) + 6);

  return week21End.toISOString().split('T')[0];
}

export const SCHEDULES_NOT_LOADED = {
  error: 'schedules_not_loaded',
  message: `Missing data/${SCHEDULE_FILE} — please warm schedules.`
};
