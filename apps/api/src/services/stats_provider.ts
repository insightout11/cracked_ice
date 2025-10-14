export interface PlayerFppg {
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  blendedFppg: number;
}

export interface StatsProvider {
  name: string;
  fetchPlayer(id: string, season: string): Promise<PlayerFppg | null>;
}

export const disabledProvider: StatsProvider = {
  name: 'disabled',
  async fetchPlayer() {
    return null;
  }
};

