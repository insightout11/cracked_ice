export interface SkaterStats {
  goals: number;
  assists: number;
  points: number;
  gamesPlayed: number;
  shots: number;
  shootingPct: number;
  blocks: number;
  plusMinus: number;
  ppGoals: number;
  ppAssists: number;
  ppPoints: number;
  shGoals: number;
  shAssists: number;
  shPoints: number;
  toi: string;
  hits: number;
  gameWinningGoals: number;
  faceoffWinPct?: number;
}

export interface GoalieStats {
  wins: number;
  losses: number;
  overtimeLosses: number;
  gamesPlayed: number;
  gamesStarted: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number;
  gaa: number;
  shutouts: number;
  toi: string;
}

export interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  fppg?: number;  // Calculate if league scoring available
  team?: string;  // Track team changes
}

export interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  careerAvgPPG: number;
  bestSeason: string;  // Which season was best (e.g., "20242025")
  bestSeasonPPG: number;
}

export interface PlayerFppg {
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  blendedFppg: number;
  skaterStats?: SkaterStats;
  goalieStats?: GoalieStats;
  last30SkaterStats?: SkaterStats;
  last7SkaterStats?: SkaterStats;
  last30GoalieStats?: GoalieStats;
  last7GoalieStats?: GoalieStats;
  careerHistory?: Record<string, CareerSeasonStats>;  // season string -> stats
  careerSummary?: CareerSummary;
}

export interface StatsProvider {
  name: string;
  fetchPlayerFppg(numericId: string, season: string): Promise<PlayerFppg | null>;
}

export const chain = (providers: StatsProvider[]): StatsProvider => ({
  name: providers.map((p) => p.name).join('->'),
  async fetchPlayerFppg(id, season) {
    for (const provider of providers) {
      try {
        const result = await provider.fetchPlayerFppg(id, season);
        if (result) {
          return result;
        }
      } catch {
        // swallow and try next provider
      }
    }
    return null;
  }
});
