import type { RosterPlayer, PlayerProjection } from './coachSchemas';

export interface WorkingLineupItem {
  slot: string;
  player: RosterPlayer | null;
}

export interface TeamMetrics {
  totalICE: number;
  totalStarts: number;
  totalGames: number;
}

export interface SwapImpact {
  iceChange: number;
  startsChange: number;
  gamesChange: number;
}

/**
 * Calculate total team ICE score for current lineup
 * Only counts active roster slots (excludes bench and IR)
 */
export function calculateTotalTeamICE(
  lineup: WorkingLineupItem[],
  projections: Record<string, PlayerProjection>
): number {
  return lineup
    .filter(item => item.player && !item.slot.startsWith('BN') && !item.slot.startsWith('IR'))
    .reduce((sum, item) => {
      const projection = projections[item.player!.id];
      return sum + (projection?.iceScore || 0);
    }, 0);
}

/**
 * Calculate total team starts in window
 * Only counts active roster slots (excludes bench and IR)
 */
export function calculateTotalTeamStarts(
  lineup: WorkingLineupItem[],
  projections: Record<string, PlayerProjection>
): number {
  return lineup
    .filter(item => item.player && !item.slot.startsWith('BN') && !item.slot.startsWith('IR'))
    .reduce((sum, item) => {
      const projection = projections[item.player!.id];
      return sum + (projection?.starts || 0);
    }, 0);
}

/**
 * Calculate total team games in window
 * Only counts active roster slots (excludes bench and IR)
 */
export function calculateTotalTeamGames(
  lineup: WorkingLineupItem[],
  projections: Record<string, PlayerProjection>
): number {
  return lineup
    .filter(item => item.player && !item.slot.startsWith('BN') && !item.slot.startsWith('IR'))
    .reduce((sum, item) => {
      const projection = projections[item.player!.id];
      return sum + (projection?.gamesAvailable || 0);
    }, 0);
}

/**
 * Calculate all team metrics at once
 */
export function calculateTeamMetrics(
  lineup: WorkingLineupItem[],
  projections: Record<string, PlayerProjection>
): TeamMetrics {
  return {
    totalICE: calculateTotalTeamICE(lineup, projections),
    totalStarts: calculateTotalTeamStarts(lineup, projections),
    totalGames: calculateTotalTeamGames(lineup, projections),
  };
}

/**
 * Calculate impact delta when swapping players
 * Determines how team metrics change when replacing one player with another
 */
export function calculateSwapImpact(
  currentLineup: WorkingLineupItem[],
  playerToReplace: RosterPlayer,
  replacementPlayer: RosterPlayer,
  projections: Record<string, PlayerProjection>
): SwapImpact {
  const currentProjection = projections[playerToReplace.id];
  const replacementProjection = projections[replacementPlayer.id];

  return {
    iceChange: (replacementProjection?.iceScore || 0) - (currentProjection?.iceScore || 0),
    startsChange: (replacementProjection?.starts || 0) - (currentProjection?.starts || 0),
    gamesChange: (replacementProjection?.gamesAvailable || 0) - (currentProjection?.gamesAvailable || 0),
  };
}

/**
 * Find which lineup slot a player currently occupies
 * Returns null if player is not in the lineup
 */
export function findPlayerSlot(
  lineup: WorkingLineupItem[],
  playerId: string
): string | null {
  const item = lineup.find(item => item.player?.id === playerId);
  return item?.slot || null;
}

/**
 * Check if a player is in an active slot (not bench/IR)
 */
export function isPlayerActive(
  lineup: WorkingLineupItem[],
  playerId: string
): boolean {
  const slot = findPlayerSlot(lineup, playerId);
  return slot !== null && !slot.startsWith('BN') && !slot.startsWith('IR');
}
