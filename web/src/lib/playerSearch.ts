export interface DraftPlayer {
  id: string;
  name: string;
  team: string;
  pos: string[];
  aliases: string[];
  blendedFppg: number | null;
  productionValue: number | null;
  productionLabel: 'FPPG' | 'PPG' | 'SV%';
}

export interface DraftPlayerDirectoryMeta {
  scoringKind: 'league-profile' | 'default-fallback';
  scoringLabel: string;
  statsSeason: string;
  updatedAt: string | null;
  playerCount: number;
  positionalAverages: Record<string, { avgFppg: number; sampleSize: number }>;
}

export function rankPlayerMatches(players: DraftPlayer[], rawQuery: string, limit = 12): DraftPlayer[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (query.length < 2) return [];

  return players
    .map((player) => {
      const name = player.name.toLocaleLowerCase();
      const aliases = player.aliases.map((alias) => alias.toLocaleLowerCase());
      const score = name === query
        ? 0
        : name.startsWith(query)
          ? 1
          : aliases.some((alias) => alias === query)
            ? 2
            : aliases.some((alias) => alias.startsWith(query))
              ? 3
              : name.includes(query)
                ? 4
                : aliases.some((alias) => alias.includes(query))
                  ? 5
                  : 99;
      return { player, score };
    })
    .filter(({ score }) => score < 99)
    .sort((a, b) =>
      a.score - b.score ||
      (b.player.productionValue ?? -1) - (a.player.productionValue ?? -1) ||
      a.player.name.localeCompare(b.player.name)
    )
    .slice(0, limit)
    .map(({ player }) => player);
}

export function inferDailySlots(players: DraftPlayer[]): 2 | 4 {
  if (players.length > 0 && players.every((player) => player.pos.every((position) => position === 'D'))) {
    return 4;
  }
  return 2;
}
