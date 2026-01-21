import type { RosterPlayer } from '../../lib/coachSchemas';

/**
 * Normalize player data to consistent RosterPlayer format
 *
 * Free agents from getAllPlayers() API have different field names:
 * - `name` instead of `full_name`
 * - `position` (string) instead of `positions` (array)
 * - Stats may be at top level instead of nested in `stats`
 *
 * This function normalizes both formats to match RosterPlayer schema
 */
export function normalizePlayer(player: any): RosterPlayer {
  // Handle name field
  const full_name = player.full_name || player.name || 'Unknown Player';

  // Handle positions - can be string, array, or missing
  let positions: string[] = [];
  if (Array.isArray(player.positions)) {
    positions = player.positions;
  } else if (typeof player.position === 'string') {
    positions = [player.position];
  } else if (typeof player.positions === 'string') {
    positions = [player.positions];
  }

  // Normalize stats - may be nested in stats object or at top level
  const stats = {
    goals: player.stats?.goals ?? player.goals ?? 0,
    assists: player.stats?.assists ?? player.assists ?? 0,
    shots_on_goal: player.stats?.shots_on_goal ?? player.shots_on_goal ?? 0,
    power_play_points: player.stats?.power_play_points ?? player.power_play_points ?? 0,
    blocks: player.stats?.blocks ?? player.blocks ?? 0,
    hits: player.stats?.hits ?? player.hits ?? 0,
    shorthanded_goals: player.stats?.shorthanded_goals ?? player.shorthanded_goals ?? 0,
    shorthanded_assists: player.stats?.shorthanded_assists ?? player.shorthanded_assists ?? 0,
    game_winning_goals: player.stats?.game_winning_goals ?? player.game_winning_goals ?? 0,
  };

  return {
    id: player.id || '',
    full_name,
    team: player.team || '',
    positions,
    current_slot: player.current_slot,
    games_played: player.games_played ?? player.gamesPlayed ?? 0,
    stats,
    blendedFppg: player.blendedFppg ?? null,
    seasonFppg: player.seasonFppg ?? player.fppg ?? 0,
    last30Fppg: player.last30Fppg ?? 0,
    last7Fppg: player.last7Fppg ?? 0,
    injuryStatus: player.injuryStatus,
    isActive: player.isActive,
    careerHistory: player.careerHistory,
    careerSummary: player.careerSummary,
    bio: player.bio,
    advancedStats: player.advancedStats,
    roleTrend: player.roleTrend,
    gameLog: player.gameLog,
  };
}

/**
 * Normalize an array of players
 */
export function normalizePlayers(players: any[]): RosterPlayer[] {
  return players.map(normalizePlayer);
}

/**
 * Check if a player object needs normalization
 * (i.e., has old field names)
 */
export function needsNormalization(player: any): boolean {
  return (
    player.name !== undefined && player.full_name === undefined ||
    typeof player.position === 'string' && player.positions === undefined
  );
}
