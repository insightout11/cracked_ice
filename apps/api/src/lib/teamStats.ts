import { readFile } from 'node:fs/promises';
import { TEAM_STATS_PATH } from '../config/cachePaths';
import type { TeamStatsCache } from '../types/teamStats';

export async function readTeamStatsCache(): Promise<TeamStatsCache | null> {
  try {
    const raw = await readFile(TEAM_STATS_PATH, 'utf8');
    return JSON.parse(raw) as TeamStatsCache;
  } catch {
    return null;
  }
}
