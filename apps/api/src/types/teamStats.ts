export interface TeamStat {
  teamId: string;
  goalsForPerGame?: number;
  goalsAgainstPerGame?: number;
  /** @deprecated Legacy caches mislabeled per-game values as per-60. */
  gfPer60?: number;
  /** @deprecated Legacy caches mislabeled per-game values as per-60. */
  gaPer60?: number;
  ppPct?: number;
  pkPct?: number;
  pace?: number;
  ppTimeOnIcePerGame?: number;  // Team PP time per game in seconds
  last7PpTimeOnIcePerGame?: number;
  last7PpGamesPlayed?: number;
}

export interface TeamStatsCache {
  generatedAt: string;
  source: string;
  recentPpWindow?: { start: string; end: string };
  teams: Record<string, TeamStat>;
}
