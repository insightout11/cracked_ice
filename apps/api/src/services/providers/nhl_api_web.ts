import type { PlayerFppg, StatsProvider, SkaterStats, GoalieStats } from '../stats_provider';

const UA = 'cracked-ice/1.0 (+https://crackedicehockey.com)';

async function j<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return (await response.json()) as T;
}

// REMOVED: Hardcoded scoring weights
// FPPG values are now set to 0 and should be calculated at runtime using user's league settings
// See server/src/features/coach/presets.ts for league-specific scoring configurations

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function extractSkaterStats(totals: any): SkaterStats | undefined {
  const gamesPlayed = toNumber(totals.gamesPlayed ?? totals.games);
  if (gamesPlayed === 0) return undefined;

  const goals = toNumber(totals.goals);
  const assists = toNumber(totals.assists);
  const points = toNumber(totals.points ?? goals + assists);
  const shots = toNumber(totals.shots ?? totals.shotsOnGoal);
  const shootingPct = shots > 0 ? Number(((goals / shots) * 100).toFixed(1)) : 0;

  return {
    goals,
    assists,
    points,
    gamesPlayed,
    shots,
    shootingPct,
    blocks: toNumber(totals.blockedShots ?? totals.blocks),
    plusMinus: toNumber(totals.plusMinus ?? totals.plusMinusRating),
    ppGoals: toNumber(totals.powerPlayGoals ?? totals.ppGoals),
    ppAssists: toNumber(totals.powerPlayAssists ?? totals.ppAssists),
    ppPoints: toNumber(totals.powerPlayPoints ?? totals.ppPoints),
    shGoals: toNumber(totals.shorthandedGoals ?? totals.shGoals),
    shAssists: toNumber(totals.shorthandedAssists ?? totals.shAssists),
    shPoints: toNumber(totals.shorthandedPoints ?? totals.shPoints),
    hits: toNumber(totals.hits),
    gameWinningGoals: toNumber(totals.gameWinningGoals ?? totals.gwg),
    toi: String(totals.avgToi ?? totals.timeOnIcePerGame ?? totals.toi ?? '0:00'),
    faceoffWinPct: totals.faceoffWinPct !== undefined ? toNumber(totals.faceoffWinPct) : undefined
  };
}

function extractGoalieStats(totals: any): GoalieStats | undefined {
  const gamesPlayed = toNumber(totals.gamesPlayed ?? totals.games);
  if (gamesPlayed === 0) return undefined;

  const saves = toNumber(totals.saves);
  const shotsAgainst = toNumber(totals.shotsAgainst ?? totals.shots);
  const goalsAgainst = toNumber(totals.goalsAgainst ?? totals.ga);
  const savePct = shotsAgainst > 0 ? Number((saves / shotsAgainst).toFixed(3)) : 0;
  const gaa = gamesPlayed > 0 ? toNumber(totals.goalsAgainstAverage ?? totals.gaa) : 0;

  return {
    wins: toNumber(totals.wins),
    losses: toNumber(totals.losses),
    overtimeLosses: toNumber(totals.otLosses ?? totals.overtimeLosses),
    gamesPlayed,
    gamesStarted: toNumber(totals.gamesStarted ?? totals.starts ?? gamesPlayed),
    saves,
    shotsAgainst,
    goalsAgainst,
    savePct,
    gaa,
    shutouts: toNumber(totals.shutouts ?? totals.so),
    toi: String(totals.timeOnIce ?? totals.toi ?? '0:00')
  };
}

// REMOVED: fantasyPoints() and goalieFantasyPoints() functions
// Fantasy points calculation now happens at runtime using league-specific scoring weights

interface GameLogResponse {
  gameLog?: Array<{
    gameDate: string;
    goals: number;
    assists: number;
    points: number;
    shots: number;
    powerPlayGoals: number;
    powerPlayPoints: number;
    shorthandedGoals: number;
    shorthandedPoints: number;
    shifts?: number;
    pim?: number;
    // For goalies
    wins?: number;
    losses?: number;
    saves?: number;
    shotsAgainst?: number;
    goalsAgainst?: number;
    shutouts?: number;
  }>;
}

function calculateTimeWindowStats(gameLog: any[], daysAgo: number): { skater: SkaterStats | undefined; goalie: GoalieStats | undefined } {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  let goals = 0, assists = 0, points = 0, shots = 0, blocks = 0, hits = 0;
  let ppGoals = 0, ppPoints = 0, shGoals = 0, shPoints = 0, gwg = 0, pim = 0;
  let wins = 0, losses = 0, saves = 0, shotsAgainst = 0, goalsAgainst = 0, shutouts = 0;
  let gamesPlayed = 0;
  let isGoalie = false;

  for (const game of gameLog) {
    const gameDate = new Date(game.gameDate);
    if (gameDate < cutoffDate) continue;

    gamesPlayed++;
    goals += toNumber(game.goals);
    assists += toNumber(game.assists);
    points += toNumber(game.points);
    shots += toNumber(game.shots);
    ppGoals += toNumber(game.powerPlayGoals);
    ppPoints += toNumber(game.powerPlayPoints);
    shGoals += toNumber(game.shorthandedGoals);
    shPoints += toNumber(game.shorthandedPoints);
    pim += toNumber(game.pim);
    gwg += toNumber(game.gameWinningGoals);
    hits += toNumber(game.hits);
    blocks += toNumber(game.blockedShots ?? game.blocks);

    // Goalie stats
    if (game.saves !== undefined || game.wins !== undefined) {
      isGoalie = true;
      wins += toNumber(game.wins);
      losses += toNumber(game.losses ?? game.overtimeLosses);
      saves += toNumber(game.saves);
      shotsAgainst += toNumber(game.shotsAgainst);
      goalsAgainst += toNumber(game.goalsAgainst);
      shutouts += toNumber(game.shutouts);
    }
  }

  if (gamesPlayed === 0) {
    return { skater: undefined, goalie: undefined };
  }

  const skaterStats: SkaterStats = {
    goals,
    assists,
    points,
    gamesPlayed,
    shots,
    shootingPct: shots > 0 ? Number(((goals / shots) * 100).toFixed(1)) : 0,
    blocks,
    plusMinus: 0, // Not available in game logs
    ppGoals,
    ppAssists: 0, // Calculate from ppPoints - ppGoals
    ppPoints,
    shGoals,
    shAssists: 0, // Calculate from shPoints - shGoals
    shPoints,
    hits,
    gameWinningGoals: gwg,
    toi: '0:00', // Not easily available in game logs
    faceoffWinPct: undefined
  };

  const goalieStats: GoalieStats | undefined = isGoalie ? {
    wins,
    losses,
    overtimeLosses: 0,
    gamesPlayed,
    gamesStarted: gamesPlayed,
    saves,
    shotsAgainst,
    goalsAgainst,
    savePct: shotsAgainst > 0 ? Number((saves / shotsAgainst).toFixed(3)) : 0,
    gaa: gamesPlayed > 0 ? Number((goalsAgainst / gamesPlayed).toFixed(2)) : 0,
    shutouts,
    toi: '0:00'
  } : undefined;

  // Debug: log when we have goalie stats
  if (goalieStats && goalieStats.gamesPlayed > 0) {
    console.log(`[calculateTimeWindowStats] Goalie detected: ${gamesPlayed} games, ${wins} wins`);
  }

  return { skater: skaterStats, goalie: goalieStats };
}

export const nhlApiWebProvider: StatsProvider = {
  name: 'api-web.nhle.com',
  async fetchPlayerFppg(id: string, season: string) {
    const seasonNumber = Number(season);

    // Fetch from stats REST API for comprehensive stats including hits/blocks
    try {
      // Fetch skater stats, realtime stats, and goalie stats in parallel
      const [summaryData, realtimeData, goalieData] = await Promise.all([
        j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D%5D&start=0&limit=1&factCayenneExp=gamesPlayed%3E=1&cayenneExp=playerId=${id}%20and%20seasonId%3C=${seasonNumber}%20and%20seasonId%3E=${seasonNumber}%20and%20gameTypeId=2`),
        j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&start=0&limit=1&factCayenneExp=gamesPlayed%3E=1&cayenneExp=playerId=${id}%20and%20seasonId%3C=${seasonNumber}%20and%20seasonId%3E=${seasonNumber}%20and%20gameTypeId=2`),
        j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/goalie/summary?isAggregate=false&isGame=false&start=0&limit=1&factCayenneExp=gamesPlayed%3E=1&cayenneExp=playerId=${id}%20and%20seasonId%3C=${seasonNumber}%20and%20seasonId%3E=${seasonNumber}%20and%20gameTypeId=2`).catch(() => ({ data: undefined }))
      ]);

      // Check if this is a goalie
      const isGoalie = goalieData.data && goalieData.data.length > 0;
      console.log(`[nhlApiWebProvider] Player ${id}: goalie fetch returned`, goalieData.data?.length ?? 0, 'records');

      if (summaryData.data && summaryData.data.length > 0) {
        const stats = summaryData.data[0];
        const realtime = realtimeData.data?.[0];

        // Build skater stats combining summary stats (scoring) with realtime stats (hits/blocks)
        const skaterStats: SkaterStats = {
          goals: toNumber(stats.goals),
          assists: toNumber(stats.assists),
          points: toNumber(stats.points),
          gamesPlayed: toNumber(stats.gamesPlayed),
          shots: toNumber(stats.shots),
          shootingPct: toNumber(stats.shootingPct) * 100,
          blocks: realtime ? toNumber(realtime.blockedShots) : 0,
          plusMinus: toNumber(stats.plusMinus),
          ppGoals: toNumber(stats.ppGoals),
          ppAssists: toNumber(stats.ppAssists ?? 0),
          ppPoints: toNumber(stats.ppPoints),
          shGoals: toNumber(stats.shGoals),
          shAssists: toNumber(stats.shAssists ?? 0),
          shPoints: toNumber(stats.shPoints),
          hits: realtime ? toNumber(realtime.hits) : 0,
          gameWinningGoals: toNumber(stats.gameWinningGoals),
          toi: String(stats.timeOnIcePerGame ?? '0:00'),
          faceoffWinPct: stats.faceoffWinPct !== undefined ? toNumber(stats.faceoffWinPct) : undefined
        };

        // Build goalie stats if this player is a goalie
        // If goalie endpoint didn't return data, try landing endpoint
        let goalieStats: GoalieStats | undefined;
        if (isGoalie) {
          const gStats = goalieData.data![0];
          goalieStats = {
            wins: toNumber(gStats.wins),
            losses: toNumber(gStats.losses),
            overtimeLosses: toNumber(gStats.otLosses ?? gStats.overtimeLosses),
            gamesPlayed: toNumber(gStats.gamesPlayed),
            gamesStarted: toNumber(gStats.gamesStarted),
            saves: toNumber(gStats.saves),
            shotsAgainst: toNumber(gStats.shotsAgainst),
            goalsAgainst: toNumber(gStats.goalsAgainst),
            savePct: toNumber(gStats.savePct ?? gStats.savePctg),
            gaa: toNumber(gStats.goalsAgainstAverage ?? gStats.gaa),
            shutouts: toNumber(gStats.shutouts),
            toi: String(gStats.timeOnIce ?? '0:00')
          };
        } else {
          // Try to detect goalie from landing endpoint as fallback
          try {
            const landing = (await j<Record<string, unknown>>(`https://api-web.nhle.com/v1/player/${id}/landing`)) as any;
            const seasonTotals: any[] = Array.isArray(landing?.seasonTotals) ? landing.seasonTotals : [];
            const totals = seasonTotals.find((entry) => Number(entry?.season) === seasonNumber && Number(entry?.gameTypeId ?? entry?.gameType) === 2);
            if (totals) {
              goalieStats = extractGoalieStats(totals);
            }
          } catch {
            // Ignore landing endpoint errors
          }
        }

        // Fetch game logs for time-windowed stats
        let last30SkaterStats: SkaterStats | undefined;
        let last7SkaterStats: SkaterStats | undefined;
        let last30GoalieStats: GoalieStats | undefined;
        let last7GoalieStats: GoalieStats | undefined;

        try {
          const gameLogData = await j<GameLogResponse>(`https://api-web.nhle.com/v1/player/${id}/game-log/${seasonNumber}/2`);
          if (gameLogData.gameLog && gameLogData.gameLog.length > 0) {
            const last30 = calculateTimeWindowStats(gameLogData.gameLog, 30);
            const last7 = calculateTimeWindowStats(gameLogData.gameLog, 7);
            last30SkaterStats = last30.skater;
            last7SkaterStats = last7.skater;
            last30GoalieStats = last30.goalie;
            last7GoalieStats = last7.goalie;
          }
        } catch (gameLogErr) {
          console.warn(`Game log fetch failed for player ${id}, time-windowed stats will be unavailable`);
        }

        return {
          seasonFppg: 0,
          last30Fppg: 0,
          last7Fppg: 0,
          blendedFppg: 0,
          skaterStats,
          goalieStats,
          last30SkaterStats,
          last7SkaterStats,
          last30GoalieStats,
          last7GoalieStats
        } satisfies PlayerFppg;
      }
    } catch (err) {
      // Stats REST API failed, fall back to landing endpoint
      console.warn(`Stats REST API failed for player ${id}, falling back to landing endpoint`);
    }

    // Fallback to landing endpoint (no hits/blocks but has basic stats)
    const landing = (await j<Record<string, unknown>>(`https://api-web.nhle.com/v1/player/${id}/landing`)) as any;
    const seasonTotals: any[] = Array.isArray(landing?.seasonTotals) ? landing.seasonTotals : [];
    const totals = seasonTotals.find((entry) => Number(entry?.season) === seasonNumber && Number(entry?.gameTypeId ?? entry?.gameType) === 2);
    if (!totals) {
      return null;
    }

    // Detect if player is a goalie by checking for goalie-specific stats
    const isGoalie = toNumber(totals.saves) > 0 || toNumber(totals.wins) > 0 || toNumber(totals.shotsAgainst ?? totals.shots) > toNumber(totals.gamesPlayed ?? totals.games);

    // Extract comprehensive stats based on player type
    const skaterStats = extractSkaterStats(totals);
    const goalieStats = extractGoalieStats(totals);

    // Fetch game logs for time-windowed stats
    let last30SkaterStats: SkaterStats | undefined;
    let last7SkaterStats: SkaterStats | undefined;
    let last30GoalieStats: GoalieStats | undefined;
    let last7GoalieStats: GoalieStats | undefined;

    try {
      const gameLogData = await j<GameLogResponse>(`https://api-web.nhle.com/v1/player/${id}/game-log/${seasonNumber}/2`);
      if (gameLogData.gameLog && gameLogData.gameLog.length > 0) {
        const last30 = calculateTimeWindowStats(gameLogData.gameLog, 30);
        const last7 = calculateTimeWindowStats(gameLogData.gameLog, 7);
        last30SkaterStats = last30.skater;
        last7SkaterStats = last7.skater;
        last30GoalieStats = last30.goalie;
        last7GoalieStats = last7.goalie;
      }
    } catch (gameLogErr) {
      console.warn(`Game log fetch failed for player ${id}, time-windowed stats will be unavailable`);
    }

    const result = {
      seasonFppg: 0,
      last30Fppg: 0,
      last7Fppg: 0,
      blendedFppg: 0,
      skaterStats,
      goalieStats,
      last30SkaterStats,
      last7SkaterStats,
      last30GoalieStats,
      last7GoalieStats
    } satisfies PlayerFppg;

    // Debug: log goalie window stats
    if (goalieStats && goalieStats.gamesPlayed > 0) {
      console.log(`[nhlApiWebProvider] Player ${id} goalie stats:`, {
        season: !!goalieStats,
        last30: !!last30GoalieStats,
        last7: !!last7GoalieStats
      });
    }

    return result;
  }
};