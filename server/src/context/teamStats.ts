import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TEAM_STATS_PATH } from '../../../apps/api/src/config/cachePaths';
import type { TeamStatsCache } from '../../../apps/api/src/types/teamStats';

export interface TeamDefenseStat {
  teamCode: string;
  goalsAgainstPerGame?: number;
  goalsForPerGame?: number;
  ppTimeOnIcePerGame?: number;  // Team PP time per game in seconds
  last7PpTimeOnIcePerGame?: number;
  last7PpGamesPlayed?: number;
}

export interface TeamStatsContext {
  byTeam: Map<string, TeamDefenseStat>;
  loaded: boolean;
}

const TEAM_STATS_PATH_CANDIDATES = [
  TEAM_STATS_PATH,
  join(process.cwd(), 'apps', 'api', 'data-cache', 'team_stats.json'),
  join(process.cwd(), 'data', 'team_stats.json')
].filter(Boolean);

function resolveTeamStatsPath(): string | null {
  for (const candidate of TEAM_STATS_PATH_CANDIDATES) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function loadTeamStatsContext(pathOverride?: string): Promise<TeamStatsContext> {
  const path = pathOverride ?? resolveTeamStatsPath();
  if (!path) {
    return { byTeam: new Map(), loaded: false };
  }

  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as TeamStatsCache;
    const entries = Object.entries(parsed.teams ?? {});
    const byTeam = new Map<string, TeamDefenseStat>();

    for (const [teamCode, stat] of entries) {
      const code = teamCode.toUpperCase();
      byTeam.set(code, {
        teamCode: code,
        goalsAgainstPerGame: typeof stat.goalsAgainstPerGame === 'number'
          ? stat.goalsAgainstPerGame
          : typeof stat.gaPer60 === 'number' ? stat.gaPer60 : undefined,
        goalsForPerGame: typeof stat.goalsForPerGame === 'number'
          ? stat.goalsForPerGame
          : typeof stat.gfPer60 === 'number' ? stat.gfPer60 : undefined,
        ppTimeOnIcePerGame: typeof stat.ppTimeOnIcePerGame === 'number' ? stat.ppTimeOnIcePerGame : undefined,
        last7PpTimeOnIcePerGame: typeof stat.last7PpTimeOnIcePerGame === 'number' ? stat.last7PpTimeOnIcePerGame : undefined,
        last7PpGamesPlayed: typeof stat.last7PpGamesPlayed === 'number' ? stat.last7PpGamesPlayed : undefined
      });
    }

    return {
      byTeam,
      loaded: byTeam.size > 0
    };
  } catch (error) {
    console.warn('[team-stats] Failed to load team stats cache:', (error as Error).message);
    return { byTeam: new Map(), loaded: false };
  }
}
