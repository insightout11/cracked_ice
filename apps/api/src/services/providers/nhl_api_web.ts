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

  // Only return goalie stats if this is actually a goalie
  // Check for goalie-specific fields that skaters won't have
  const hasSaves = totals.saves !== undefined && totals.saves !== null;
  const hasShotsAgainst = totals.shotsAgainst !== undefined && totals.shotsAgainst !== null;
  const hasGoalsAgainst = totals.goalsAgainst !== undefined && totals.goalsAgainst !== null;
  const hasSavePct = totals.savePct !== undefined || totals.savePctg !== undefined;

  // Must have at least one goalie-specific field to be considered a goalie
  // Note: we check for field existence, not the 'shots' fallback which could be skater shots
  if (!hasSaves && !hasShotsAgainst && !hasGoalsAgainst && !hasSavePct) {
    return undefined;
  }

  const saves = toNumber(totals.saves);
  const shotsAgainst = toNumber(totals.shotsAgainst);
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

    // Goalie stats - check for goalie-specific fields
    // The NHL API uses 'decision' (W/L/O) and 'gamesStarted' for goalies
    if (game.gamesStarted !== undefined || game.decision !== undefined || game.shotsAgainst !== undefined) {
      isGoalie = true;

      // Decision is "W", "L", or "O" (OT loss)
      const decision = game.decision;
      if (decision === 'W') wins++;
      else if (decision === 'L') losses++;
      else if (decision === 'O') losses++; // Count OT losses as losses

      const sa = toNumber(game.shotsAgainst);
      const ga = toNumber(game.goalsAgainst);

      shotsAgainst += sa;
      goalsAgainst += ga;
      saves += (sa - ga); // Calculate saves from shots against and goals against
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

  return { skater: skaterStats, goalie: goalieStats };
}

/**
 * Fetch full career history for a player from the landing endpoint
 * Returns career stats for all NHL regular season games
 */
export async function fetchPlayerCareerHistory(id: string): Promise<{
  careerHistory: Record<string, import('../stats_provider').CareerSeasonStats>;
  careerSummary: import('../stats_provider').CareerSummary;
} | null> {
  try {
    const landing = await j<Record<string, unknown>>(`https://api-web.nhle.com/v1/player/${id}/landing`);
    const seasonTotals: any[] = Array.isArray((landing as any)?.seasonTotals) ? (landing as any).seasonTotals : [];

    // Filter to NHL regular season games only (gameTypeId=2)
    const nhlSeasons = seasonTotals.filter(
      (season) => season.leagueAbbrev === 'NHL' && Number(season.gameTypeId ?? season.gameType ?? 0) === 2
    );

    if (nhlSeasons.length === 0) {
      return null; // Player has no NHL regular season history
    }

    // Detect if player is a goalie based on position code
    const positionCode = (landing as any)?.position;
    const isGoalie = positionCode === 'G';

    // Build career history object
    const careerHistory: Record<string, import('../stats_provider').CareerSeasonStats> = {};
    let totalGames = 0;
    let totalPoints = 0;
    let totalWins = 0;
    let totalGoalsAgainst = 0;
    let totalSaves = 0;
    let totalShotsAgainst = 0;
    let totalShutouts = 0;
    let bestSeason = '';
    let bestSeasonPPG = 0;
    let bestSeasonGAA = 999;
    let bestSeasonSavePct = 0;

    for (const season of nhlSeasons) {
      const seasonId = String(season.season); // e.g., "20242025"
      const gamesPlayed = toNumber(season.gamesPlayed ?? season.games);

      if (isGoalie) {
        // Goalie stats
        const wins = toNumber(season.wins);
        const losses = toNumber(season.losses);
        const otLosses = toNumber(season.otLosses);
        const goalsAgainst = toNumber(season.goalsAgainst);
        const gaa = toNumber(season.goalsAgainstAvg ?? season.gaa);
        const savePct = toNumber(season.savePct ?? season.savePctg);
        const shutouts = toNumber(season.shutouts);

        careerHistory[seasonId] = {
          gamesPlayed,
          wins,
          losses,
          overtimeLosses: otLosses,
          goalsAgainst,
          goalsAgainstAverage: gaa,
          savePct,
          shutouts,
          team: season.teamName?.default ?? season.teamAbbrev
        };

        totalGames += gamesPlayed;
        totalWins += wins;
        totalGoalsAgainst += goalsAgainst;
        totalShutouts += shutouts;

        // Track best season by GAA (lower is better)
        if (gamesPlayed >= 20 && gaa > 0 && gaa < bestSeasonGAA) {
          bestSeasonGAA = gaa;
          bestSeason = seasonId;
        }
        if (savePct > bestSeasonSavePct) {
          bestSeasonSavePct = savePct;
        }
      } else {
        // Skater stats
        const goals = toNumber(season.goals);
        const assists = toNumber(season.assists);
        const points = toNumber(season.points ?? (goals + assists));
        const ppg = gamesPlayed > 0 ? points / gamesPlayed : 0;

        careerHistory[seasonId] = {
          gamesPlayed,
          goals,
          assists,
          points,
          team: season.teamName?.default ?? season.teamAbbrev
        };

        totalGames += gamesPlayed;
        totalPoints += points;

        // Track best season
        if (ppg > bestSeasonPPG) {
          bestSeasonPPG = ppg;
          bestSeason = seasonId;
        }
      }
    }

    const careerSummary: import('../stats_provider').CareerSummary = {
      totalSeasons: nhlSeasons.length,
      totalGames,
      ...(isGoalie ? {
        totalWins,
        totalShutouts,
        careerWinPct: totalGames > 0 ? totalWins / totalGames : 0,
        careerGAA: totalGames > 0 ? totalGoalsAgainst / totalGames : 0,
        bestSeason,
        bestSeasonGAA,
        bestSeasonSavePct
      } : {
        careerAvgPPG: totalGames > 0 ? totalPoints / totalGames : 0,
        bestSeason,
        bestSeasonPPG
      })
    };

    return { careerHistory, careerSummary };
  } catch (error) {
    console.warn(`Failed to fetch career history for player ${id}:`, error);
    return null;
  }
}

/**
 * Fetch player biographical information from the landing endpoint
 * Returns birth info, physical stats, draft details, etc.
 */
export async function fetchPlayerBio(id: string): Promise<{
  birthDate?: string;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  heightInInches?: number;
  weightInPounds?: number;
  shootsCatches?: string;
  sweaterNumber?: number;
  draftYear?: number;
  draftTeam?: string;
  draftRound?: number;
  draftPickInRound?: number;
  draftOverallPick?: number;
} | null> {
  try {
    const landing = await j<Record<string, unknown>>(`https://api-web.nhle.com/v1/player/${id}/landing`);

    return {
      birthDate: (landing as any)?.birthDate,
      birthCity: (landing as any)?.birthCity?.default,
      birthStateProvince: (landing as any)?.birthStateProvince?.default,
      birthCountry: (landing as any)?.birthCountry,
      heightInInches: (landing as any)?.heightInInches,
      weightInPounds: (landing as any)?.weightInPounds,
      shootsCatches: (landing as any)?.shootsCatches,
      sweaterNumber: (landing as any)?.sweaterNumber,
      draftYear: (landing as any)?.draftDetails?.year,
      draftTeam: (landing as any)?.draftDetails?.teamAbbrev,
      draftRound: (landing as any)?.draftDetails?.round,
      draftPickInRound: (landing as any)?.draftDetails?.pickInRound,
      draftOverallPick: (landing as any)?.draftDetails?.overallPick
    };
  } catch (error) {
    console.warn(`Failed to fetch bio for player ${id}:`, error);
    return null;
  }
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