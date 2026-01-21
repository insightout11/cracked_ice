import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';

/**
 * Calculate a basic ICE score for players without server projections
 *
 * This matches the desktop PlayerRow.tsx calculation exactly (lines 54-59).
 * Blended FPPG: (season * 0.5) + (last30 * 0.3) + (last7 * 0.2)
 *
 * The result is in FPPG scale (0-5 range for most players), matching server ICE scores.
 * For full ICE with Strength of Schedule, use server projections.
 */
export function calculateBasicIceScore(player: RosterPlayer): number {
  // Exact match to desktop PlayerRow.tsx lines 54-58
  const seasonFppg = player.seasonFppg ?? 0;
  const last30Fppg = player.last30Fppg ?? seasonFppg;
  const last7Fppg = player.last7Fppg ?? seasonFppg; // Falls back to season, not last30

  const calculatedIce = (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);

  return Math.round(calculatedIce * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate a basic projection for a player
 *
 * This creates a minimal projection object for players without server projections.
 * Used for free agents in the mobile player list.
 */
export function calculateBasicProjection(player: RosterPlayer): PlayerProjection {
  const iceScore = calculateBasicIceScore(player);
  const fppg = player.seasonFppg ?? 0; // Match desktop - uses seasonFppg

  return {
    fppg,
    starts: 0, // Unknown without schedule data
    gamesAvailable: 0, // Unknown without schedule data
    projectedPoints: 0, // Can't calculate without games
    offNightRate: 0,
    strengthOfSchedule: 5, // Neutral default
    iceScore,
  };
}

/**
 * Calculate projections for multiple players
 *
 * Returns a record keyed by player ID
 */
export function calculateProjectionsForPlayers(
  players: RosterPlayer[]
): Record<string, PlayerProjection> {
  const projections: Record<string, PlayerProjection> = {};

  for (const player of players) {
    projections[player.id] = calculateBasicProjection(player);
  }

  return projections;
}

/**
 * Merge additional projections into existing projections
 *
 * Existing projections take precedence (they have more accurate server data)
 */
export function mergeProjections(
  existing: Record<string, PlayerProjection>,
  additional: Record<string, PlayerProjection>
): Record<string, PlayerProjection> {
  const merged = { ...existing };

  for (const [playerId, projection] of Object.entries(additional)) {
    // Only add if not already present
    if (!merged[playerId]) {
      merged[playerId] = projection;
    }
  }

  return merged;
}
