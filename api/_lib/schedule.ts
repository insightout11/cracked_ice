import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { teamName } from './teams.js';
import { BEFORE_PLAYOFFS_END, SCHEDULE_FILE } from './season.js';

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

// Last day before the season's configured fantasy playoffs (config/season.json).
export function calculateBeforePlayoffsEndDate(): string {
  return BEFORE_PLAYOFFS_END;
}

export const SCHEDULES_NOT_LOADED = {
  error: 'schedules_not_loaded',
  message: `Missing data/${SCHEDULE_FILE} — please warm schedules.`
};
