/**
 * Role Trend Analysis
 *
 * Identifies players with increased or decreased ice time roles by comparing
 * recent performance (last 7 days) to season averages.
 */

export interface RoleTrend {
  type: 'increased' | 'decreased' | 'stable';
  toiChange: number;        // Percentage change in TOI
  ppToiChange: number;      // Percentage change in PP TOI
  last7Games: number;       // Games played in last 7 days
  meetsThreshold: boolean;  // Does this meet display threshold?
  season: {
    avgToi: number;         // Season avg TOI (seconds)
    avgPpToi: number;       // Season avg PP TOI (seconds)
  };
  last7: {
    avgToi: number;         // Last 7 days avg TOI (seconds)
    avgPpToi: number;       // Last 7 days avg PP TOI (seconds)
  };
}

const MIN_GAMES_THRESHOLD = 3;  // Minimum games in last 7 days to show trend
const ROLE_CHANGE_THRESHOLD = 15; // 15% change to trigger indicator

/**
 * Calculate role trend for a player by comparing season stats to last 7 days
 *
 * @param seasonStats - Season-long advanced stats including avgToiPerGame and ppTimeOnIcePerGame
 * @param last7Stats - Last 7 days advanced stats with same fields plus gamesPlayed
 * @returns RoleTrend object or null if insufficient data
 */
export function calculateRoleTrend(
  seasonStats: { avgToiPerGame?: number; ppTimeOnIcePerGame?: number } | null,
  last7Stats: { avgToiPerGame?: number; ppTimeOnIcePerGame?: number; gamesPlayed?: number } | null
): RoleTrend | null {
  // Return null if we don't have both season and last 7 day stats
  if (!seasonStats || !last7Stats) return null;

  const last7Games = last7Stats.gamesPlayed || 0;

  // Require minimum games in last 7 days for reliable trend
  if (last7Games < MIN_GAMES_THRESHOLD) return null;

  const seasonToi = seasonStats.avgToiPerGame || 0;
  const seasonPpToi = seasonStats.ppTimeOnIcePerGame || 0;
  const last7Toi = last7Stats.avgToiPerGame || 0;
  const last7PpToi = last7Stats.ppTimeOnIcePerGame || 0;

  // Need at least some TOI data to calculate trend
  if (seasonToi === 0 && seasonPpToi === 0) return null;

  // Calculate percentage changes
  const toiChange = seasonToi > 0
    ? ((last7Toi - seasonToi) / seasonToi) * 100
    : 0;
  const ppToiChange = seasonPpToi > 0
    ? ((last7PpToi - seasonPpToi) / seasonPpToi) * 100
    : 0;

  // Determine trend type (either metric can trigger)
  let type: 'increased' | 'decreased' | 'stable' = 'stable';
  let meetsThreshold = false;

  if (toiChange >= ROLE_CHANGE_THRESHOLD || ppToiChange >= ROLE_CHANGE_THRESHOLD) {
    type = 'increased';
    meetsThreshold = true;
  } else if (toiChange <= -ROLE_CHANGE_THRESHOLD || ppToiChange <= -ROLE_CHANGE_THRESHOLD) {
    type = 'decreased';
    meetsThreshold = true;
  }

  return {
    type,
    toiChange,
    ppToiChange,
    last7Games,
    meetsThreshold,
    season: { avgToi: seasonToi, avgPpToi: seasonPpToi },
    last7: { avgToi: last7Toi, avgPpToi: last7PpToi },
  };
}
