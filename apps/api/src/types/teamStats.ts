export interface TeamStat {
  teamId: string;
  gfPer60: number;
  gaPer60: number;
  ppPct?: number;
  pkPct?: number;
  pace?: number;
  ppTimeOnIcePerGame?: number;  // Team PP time per game in seconds
}

export interface TeamStatsCache {
  generatedAt: string;
  source: string;
  teams: Record<string, TeamStat>;
}
