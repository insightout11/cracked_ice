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
  player: { seasonFppg?: number },
  projection?: PlayerProjection,
): number {
  return projection?.fppg ?? player.seasonFppg ?? 0;
}
