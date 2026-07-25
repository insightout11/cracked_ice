import type { PlayerProjection } from './coachSchemas';

export function getPlayerProjection(
  projections: Record<string, PlayerProjection> | undefined,
  playerId: string,
): PlayerProjection | undefined {
  if (!projections) return undefined;
  const numericId = playerId.replace(/^nhl:/, '');
  return projections[playerId] ?? projections[numericId] ?? projections[`nhl:${numericId}`];
}

export function getLeagueFppg(
  player: { seasonFppg?: number; blendedFppg?: number | null },
  projection?: PlayerProjection,
): number {
  // `projection.fppg` and `blendedFppg` both come from calculatePlayerFppg, which is
  // what the draft board shows. `seasonFppg` comes from buildFppgSplits and currently
  // disagrees with them by roughly 4x, so it is only a last resort.
  return projection?.fppg ?? player.blendedFppg ?? player.seasonFppg ?? 0;
}
