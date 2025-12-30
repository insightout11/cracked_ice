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
  // Skater stats
  goals?: number;
  assists?: number;
  points?: number;
  // Goalie stats
  wins?: number;
  losses?: number;
  overtimeLosses?: number;
  goalsAgainst?: number;
  goalsAgainstAverage?: number;
  savePct?: number;
  shutouts?: number;
  // Common
  fppg?: number;
  team?: string;
}

export interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  // Skater summary
  careerAvgPPG?: number;
  bestSeason?: string;
  bestSeasonPPG?: number;
  // Goalie summary
  careerWinPct?: number;
  careerGAA?: number;
  careerSavePct?: number;
  totalWins?: number;
  totalShutouts?: number;
  bestSeasonGAA?: number;
  bestSeasonSavePct?: number;
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
