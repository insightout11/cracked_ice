export interface TeamStat {
  teamId: string;
  gfPer60: number;
  gaPer60: number;
  ppPct?: number;
  pkPct?: number;
  pace?: number;
}

export interface TeamStatsCache {
  generatedAt: string;
  source: string;
  teams: Record<string, TeamStat>;
}
