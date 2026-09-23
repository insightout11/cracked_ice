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

/**
 * Starts that fall on off-nights (≤8 NHL games). Counts the simulated lineup's
 * per-date starts against each game's off-night flag. Falls back to
 * `starts × offNightRate` only when the per-date data is missing; that rate is a
 * share of all team games, so it undercounts bench players, whose starts cluster
 * on off-nights.
 */
export function offNightStarts(projection: PlayerProjection | undefined): number {
  if (!projection) return 0;
  const { gamesByDate, startsByDate } = projection;
  if (gamesByDate && startsByDate) {
    return Object.entries(startsByDate).reduce(
      (total, [date, starts]) => total + (gamesByDate[date]?.isOffNight ? starts : 0),
      0,
    );
  }
  return projection.starts * projection.offNightRate;
}

/**
 * Projected points from the games a player is actually started in this window.
 * `projectedPoints` from the API is fppg × every team game, including bench and
 * IR games, so it overstates what a roster will score.
 */
export function startedPoints(projection: PlayerProjection | undefined): number {
  return projection ? projection.fppg * projection.starts : 0;
}
