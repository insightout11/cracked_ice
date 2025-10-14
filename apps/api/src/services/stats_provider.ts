export interface PlayerFppg {
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  blendedFppg: number;
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
