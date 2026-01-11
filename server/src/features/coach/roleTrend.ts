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
  ppPctChange: number;      // Percentage point change in PP share
  last7Games: number;       // Games played in last 7 days
  meetsThreshold: boolean;  // Does this meet display threshold?
  season: {
    avgToi: number;         // Season avg TOI (seconds)
    avgPpToi: number;       // Season avg PP TOI (seconds)
    ppPct: number;          // Season PP time % of team
  };
  last7: {
    avgToi: number;         // Last 7 days avg TOI (seconds)
    avgPpToi: number;       // Last 7 days avg PP TOI (seconds)
    ppPct: number;          // Last 7 days PP time % of team
  };
}

const MIN_GAMES_THRESHOLD = 3;  // Minimum games in last 7 days to show trend
const ROLE_CHANGE_THRESHOLD = 15; // 15% change to trigger indicator
const PP_PCT_THRESHOLD = 10;      // 10 percentage points change to trigger PP indicator

/**
 * Calculate total PP TOI for all players on a team
 *
 * @param players - Array of all players with team and stats data
 * @param targetTeam - The team to calculate total PP time for
 * @param useWindow - If true, use advancedStatsWindow (last 7 days), otherwise use advancedStats (season)
 * @returns Total PP TOI per game (seconds) for the team
 */
function calculateTeamTotalPpToi(
  players: Array<{ team?: string; advancedStats?: { ppTimeOnIcePerGame?: number }; advancedStatsWindow?: { ppTimeOnIcePerGame?: number } }>,
  targetTeam: string,
  useWindow: boolean = false
): number {
  return players
    .filter(p => p.team === targetTeam)
    .reduce((total, p) => {
      const ppToi = useWindow
        ? (p.advancedStatsWindow?.ppTimeOnIcePerGame || 0)
        : (p.advancedStats?.ppTimeOnIcePerGame || 0);
      return total + ppToi;
    }, 0);
}

/**
 * Calculate role trend for a player by comparing season stats to last 7 days
 *
 * @param seasonStats - Season-long advanced stats including avgToiPerGame and ppTimeOnIcePerGame
 * @param last7Stats - Last 7 days advanced stats with same fields plus gamesPlayed
 * @param allPlayers - Array of all players (needed to calculate team PP totals)
 * @param playerTeam - The player's team
 * @returns RoleTrend object or null if insufficient data
 */
export function calculateRoleTrend(
  seasonStats: { avgToiPerGame?: number; ppTimeOnIcePerGame?: number } | null,
  last7Stats: { avgToiPerGame?: number; ppTimeOnIcePerGame?: number; gamesPlayed?: number } | null,
  allPlayers?: Array<{ team?: string; advancedStats?: { ppTimeOnIcePerGame?: number }; advancedStatsWindow?: { ppTimeOnIcePerGame?: number } }>,
  playerTeam?: string
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

  // Calculate PP time as percentage of team total
  let seasonPpPct = 0;
  let last7PpPct = 0;
  let ppPctChange = 0;

  if (allPlayers && playerTeam) {
    // Calculate team total PP time
    const seasonTeamTotalPpToi = calculateTeamTotalPpToi(allPlayers, playerTeam, false);
    const last7TeamTotalPpToi = calculateTeamTotalPpToi(allPlayers, playerTeam, true);

    // Calculate player's percentage of team PP time
    seasonPpPct = seasonTeamTotalPpToi > 0
      ? (seasonPpToi / seasonTeamTotalPpToi) * 100
      : 0;
    last7PpPct = last7TeamTotalPpToi > 0
      ? (last7PpToi / last7TeamTotalPpToi) * 100
      : 0;

    // Calculate percentage point change (not percentage of percentage)
    // Works for all cases: 0% → 15% = +15pp, 60% → 45% = -15pp, etc.
    ppPctChange = last7PpPct - seasonPpPct;
  }

  // Determine trend type (either metric can trigger)
  let type: 'increased' | 'decreased' | 'stable' = 'stable';
  let meetsThreshold = false;

  // Check if total TOI changed significantly OR if PP share changed significantly
  const isIncreased =
    toiChange >= ROLE_CHANGE_THRESHOLD ||                           // 15% total TOI increase
    (Math.abs(ppPctChange) >= PP_PCT_THRESHOLD && ppPctChange > 0); // OR 10pp PP% increase

  const isDecreased =
    toiChange <= -ROLE_CHANGE_THRESHOLD ||                          // 15% total TOI decrease
    (Math.abs(ppPctChange) >= PP_PCT_THRESHOLD && ppPctChange < 0); // OR 10pp PP% decrease

  if (isIncreased) {
    type = 'increased';
    meetsThreshold = true;
  } else if (isDecreased) {
    type = 'decreased';
    meetsThreshold = true;
  }

  return {
    type,
    toiChange,
    ppToiChange,
    ppPctChange,
    last7Games,
    meetsThreshold,
    season: { avgToi: seasonToi, avgPpToi: seasonPpToi, ppPct: seasonPpPct },
    last7: { avgToi: last7Toi, avgPpToi: last7PpToi, ppPct: last7PpPct },
  };
}
