import type { LeagueWorkspace } from './leagueWorkspace';
import type { DraftPlayer } from './playerSearch';

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function applyDraftProjectionSources(
  players: DraftPlayer[],
  importedSources: LeagueWorkspace['draftProjectionSources'],
): DraftPlayer[] {
  return players.map((player) => {
    const nativeFppg = player.nativeFppg ?? player.blendedFppg;
    const sources: NonNullable<DraftPlayer['projectionSources']> = nativeFppg == null ? [] : [
      { id: 'cracked-ice', label: 'Cracked Ice', kind: 'native', fppg: nativeFppg },
    ];
    importedSources.forEach((source) => {
      const fppg = source.projections[normalizeId(player.id)] ?? source.projections[player.id];
      if (Number.isFinite(fppg) && fppg > 0) sources.push({ id: source.id, label: source.label, kind: 'imported', fppg });
    });
    const importedCount = sources.filter((source) => source.kind === 'imported').length;
    const blendedFppg = sources.length ? sources.reduce((sum, source) => sum + source.fppg, 0) / sources.length : null;
    const games = player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0;
    const marketOnly = blendedFppg === null && (player.yahooAdp != null || player.yahooDraftedPercentage != null);
    return {
      ...player,
      nativeFppg,
      blendedFppg,
      productionValue: blendedFppg ?? player.yahooAdp ?? player.productionValue,
      productionLabel: blendedFppg === null ? player.productionLabel : 'FPPG',
      projectionSources: sources,
      missingProjectionSources: [
        ...(nativeFppg == null ? ['Cracked Ice'] : []),
        ...importedSources.filter((source) => !sources.some((covered) => covered.id === source.id)).map((source) => source.label),
      ],
      projectionStatus: importedCount > 0
        ? (nativeFppg == null ? 'imported-only' : 'consensus')
        : nativeFppg != null
          ? (games < (player.pos.includes('G') ? 25 : 20) ? 'rookie-low-confidence' : 'native')
          : marketOnly ? 'market-only' : 'unprojected',
    };
  });
}

export function hasDraftProjection(player: DraftPlayer): boolean {
  return player.blendedFppg !== null && Number.isFinite(player.blendedFppg);
}

export function isDraftRelevant(player: DraftPlayer): boolean {
  return hasDraftProjection(player) || player.yahooAdp != null || player.yahooDraftedPercentage != null;
}

export function projectionStateLabel(player: DraftPlayer): string {
  switch (player.projectionStatus) {
    case 'imported-only': return 'Imported projection only';
    case 'consensus': return `Consensus · ${player.projectionSources?.length ?? 0} sources`;
    case 'rookie-low-confidence': return 'Rookie estimate · low confidence';
    case 'market-only': return 'Market signal · no FPPG projection';
    case 'unprojected': return 'No CI projection';
    default: return 'Cracked Ice projection';
  }
}
