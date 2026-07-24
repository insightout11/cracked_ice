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

  const explicitSaves = toNumber(totals.saves);
  const shotsAgainst = toNumber(totals.shotsAgainst);
  const goalsAgainst = toNumber(totals.goalsAgainst ?? totals.ga);
  const saves = explicitSaves > 0 ? explicitSaves : Math.max(0, shotsAgainst - goalsAgainst);

  const explicitSavePct = toNumber(totals.savePct ?? totals.savePctg);
  const savePct = explicitSavePct > 0
    ? explicitSavePct
    : shotsAgainst > 0 ? Number((saves / shotsAgainst).toFixed(5)) : 0;
  const toi = String(totals.timeOnIce ?? totals.toi ?? '0:00');
  const explicitGaa = toNumber(totals.goalsAgainstAverage ?? totals.goalsAgainstAvg ?? totals.gaa);
  const toiParts = toi.includes(':') ? toi.split(':').map(Number) : [];
  const toiSeconds = toiParts.length === 2
    ? (toiParts[0] * 60) + toiParts[1]
    : toNumber(totals.timeOnIce ?? totals.toi);
  const gaa = explicitGaa > 0
    ? explicitGaa
    : toiSeconds > 0 ? Number(((goalsAgainst * 3600) / toiSeconds).toFixed(5)) : Number((goalsAgainst / gamesPlayed).toFixed(5));

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
    toi
  };
}

// REMOVED: fantasyPoints() and goalieFantasyPoints() functions
// Fantasy points calculation now happens at runtime using league-specific scoring weights

interface GameLogResponse {
  gameLog?: Array<{
    gameDate: string;
    gameId?: number;
    teamAbbrev?: string;
    homeRoadFlag?: string; // "H" or "R"
    opponentAbbrev?: string;
    toi?: string; // Time on ice in "MM:SS" format
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
    plusMinus?: number;
    // For goalies
    gamesStarted?: number;
    savePctg?: number;
    decision?: string; // "W", "L", "O"
    saves?: number;
    savePct?: number;
    shotsAgainst?: number;
    goalsAgainst?: number;
    goalsAgainstAverage?: number;
    shutouts?: number;
  }>;
}

function calculateTimeWindowStats(gameLog: any[], daysAgo: number): { skater: SkaterStats | undefined; goalie: GoalieStats | undefined } {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  let goals = 0, assists = 0, points = 0, shots = 0, blocks = 0, hits = 0;
  let ppGoals = 0, ppPoints = 0, shGoals = 0, shPoints = 0, gwg = 0, pim = 0;
  let wins = 0, losses = 0, overtimeLosses = 0, gamesStarted = 0;
  let saves = 0, shotsAgainst = 0, goalsAgainst = 0, shutouts = 0, goalieToiSeconds = 0;
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
      else if (decision === 'O') overtimeLosses++;

      gamesStarted += toNumber(game.gamesStarted);
      if (typeof game.toi === 'string' && game.toi.includes(':')) {
        const [minutes, seconds] = game.toi.split(':').map(Number);
        goalieToiSeconds += (minutes * 60) + (seconds || 0);
      }

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
    overtimeLosses,
    gamesPlayed,
    gamesStarted,
    saves,
    shotsAgainst,
    goalsAgainst,
    savePct: shotsAgainst > 0 ? Number((saves / shotsAgainst).toFixed(3)) : 0,
    gaa: goalieToiSeconds > 0 ? Number(((goalsAgainst * 3600) / goalieToiSeconds).toFixed(5)) : 0,
    shutouts,
    toi: `${Math.floor(goalieToiSeconds / 60)}:${String(goalieToiSeconds % 60).padStart(2, '0')}`
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

export async function fetchPlayerInjuryStatus(id: string): Promise<{
  injuryStatus?: string;
  isActive: boolean;
} | null> {
  try {
    const landing = await j<Record<string, unknown>>(`https://api-web.nhle.com/v1/player/${id}/landing`);

    const isActive = Boolean((landing as any)?.isActive);

    // Map isActive to injury status
    const injuryStatus = isActive ? undefined : 'INACTIVE';

    return {
      isActive,
      injuryStatus
    };
  } catch (error) {
    console.warn(`Failed to fetch injury status for player ${id}:`, error);
    return null;
  }
}

export interface AdvancedStats {
  // Power play
  ppTimeOnIcePerGame?: number;
  ppGoalsForPer60?: number;
  ppIndividualSatFor?: number;

  // Penalty kill
  shTimeOnIcePerGame?: number;
  ppGoalsAgainstPer60?: number;
  shIndividualSatFor?: number;

  // Realtime
  giveaways?: number;
  giveawaysPer60?: number;
  takeaways?: number;
  takeawaysPer60?: number;
  hitsPer60?: number;
  blockedShotsPer60?: number;

  // Faceoffs by zone
  defensiveZoneFaceoffPct?: number;
  offensiveZoneFaceoffPct?: number;
  neutralZoneFaceoffPct?: number;

  // Average TOI tracking (for role trend analysis)
  avgToiPerGame?: number;  // Overall average TOI in seconds
  gamesPlayed?: number;    // Games played in window (for validation)
}

export async function fetchPlayerAdvancedStats(id: string, season: string): Promise<AdvancedStats | null> {
  try {
    const seasonNumber = Number(season);
    const cayenneExp = `playerId=${id}%20and%20seasonId%3C=${seasonNumber}%20and%20seasonId%3E=${seasonNumber}%20and%20gameTypeId=2`;

    // Fetch PP, PK, realtime, faceoff, and summary stats in parallel
    const [ppData, pkData, realtimeData, faceoffData, summaryData] = await Promise.all([
      j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`).catch(() => ({ data: undefined })),
      j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/penaltykill?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`).catch(() => ({ data: undefined })),
      j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&start=0&limit=1&factCayenneExp=gamesPlayed%3E=1&cayenneExp=${cayenneExp}`).catch(() => ({ data: undefined })),
      j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/faceoffpercentages?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`).catch(() => ({ data: undefined })),
      j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`).catch(() => ({ data: undefined }))
    ]);

    const result: AdvancedStats = {};

    // Power play stats
    if (ppData.data && ppData.data.length > 0) {
      const pp = ppData.data[0];
      result.ppTimeOnIcePerGame = toNumber(pp.ppTimeOnIcePerGame);
      result.ppGoalsForPer60 = toNumber(pp.ppGoalsForPer60);
      result.ppIndividualSatFor = toNumber(pp.ppIndividualSatFor);
    }

    // Penalty kill stats
    if (pkData.data && pkData.data.length > 0) {
      const pk = pkData.data[0];
      result.shTimeOnIcePerGame = toNumber(pk.shTimeOnIcePerGame);
      result.ppGoalsAgainstPer60 = toNumber(pk.ppGoalsAgainstPer60);
      result.shIndividualSatFor = toNumber(pk.shIndividualSatFor);
    }

    // Realtime stats (giveaways, takeaways, etc.)
    if (realtimeData.data && realtimeData.data.length > 0) {
      const rt = realtimeData.data[0];
      result.giveaways = toNumber(rt.giveaways);
      result.giveawaysPer60 = toNumber(rt.giveawaysPer60);
      result.takeaways = toNumber(rt.takeaways);
      result.takeawaysPer60 = toNumber(rt.takeawaysPer60);
      result.hitsPer60 = toNumber(rt.hitsPer60);
      result.blockedShotsPer60 = toNumber(rt.blockedShotsPer60);
    }

    // Faceoff stats by zone
    if (faceoffData.data && faceoffData.data.length > 0) {
      const fo = faceoffData.data[0];
      result.defensiveZoneFaceoffPct = toNumber(fo.defensiveZoneFaceoffPct);
      result.offensiveZoneFaceoffPct = toNumber(fo.offensiveZoneFaceoffPct);
      result.neutralZoneFaceoffPct = toNumber(fo.neutralZoneFaceoffPct);
    }

    // Summary stats (avgToi, gamesPlayed)
    if (summaryData.data && summaryData.data.length > 0) {
      const summary = summaryData.data[0];
      // timeOnIcePerGame is returned as a numeric value in seconds
      result.avgToiPerGame = toNumber(summary.timeOnIcePerGame);
      result.gamesPlayed = toNumber(summary.gamesPlayed);
    }

    return result;
  } catch (error) {
    console.warn(`Failed to fetch advanced stats for player ${id}:`, error);
    return null;
  }
}

/**
 * Fetch advanced stats for a player within a specific date window
 * Used for role trend analysis (comparing last 7 days to season average)
 */
export async function fetchPlayerAdvancedStatsWindow(
  id: string,
  season: string,
  startDate?: string, // Format: YYYY-MM-DD
  endDate?: string    // Format: YYYY-MM-DD
): Promise<AdvancedStats | null> {
  try {
    const seasonNumber = Number(season);
    let cayenneExp = `playerId=${id}%20and%20seasonId%3C=${seasonNumber}%20and%20seasonId%3E=${seasonNumber}%20and%20gameTypeId=2`;

    // Add date filters if provided (for last 7 days calculation)
    if (startDate && endDate) {
      cayenneExp += `%20and%20gameDate%3E=%22${startDate}%22%20and%20gameDate%3C=%22${endDate}%22`;
    }

    // Fetch summary stats for overall TOI and PP stats in parallel
    const [summaryData, ppData] = await Promise.all([
      j<{ data?: any[] }>(
        `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`
      ).catch(() => ({ data: undefined })),
      j<{ data?: any[] }>(
        `https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`
      ).catch(() => ({ data: undefined }))
    ]);

    const result: AdvancedStats = {};

    // Extract average TOI and games played from summary endpoint
    if (summaryData.data && summaryData.data.length > 0) {
      const summary = summaryData.data[0];
      result.avgToiPerGame = toNumber(summary.timeOnIcePerGame); // in seconds
      result.gamesPlayed = toNumber(summary.gamesPlayed);
    }

    // Extract PP TOI
    if (ppData.data && ppData.data.length > 0) {
      const pp = ppData.data[0];
      result.ppTimeOnIcePerGame = toNumber(pp.ppTimeOnIcePerGame); // in seconds
    }

    return result;
  } catch (error) {
    console.warn(`Failed to fetch advanced stats window for player ${id}:`, error);
    return null;
  }
}

/**
 * Game log entry for displaying game-by-game performance
 */
export interface GameLogEntry {
  gameDate: string;
  opponent?: string;
  isHome?: boolean;
  teamResult?: 'W' | 'L' | 'OTL' | 'SOL';
  teamScore?: string; // e.g., "4-3" or "3-2 (OT)"
  teamGoalsFor?: number;
  teamGoalsAgainst?: number;
  // Ice time
  toi?: string; // Time on ice in "MM:SS" format (e.g., "18:45")
  toiSeconds?: number; // TOI in seconds for sorting/calculations
  // Skater stats
  goals: number;
  assists: number;
  points: number;
  plusMinus?: number;
  shots: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shorthandedPoints: number;
  hits?: number;
  blocks?: number;
  pim?: number;
  // Goalie stats
  decision?: 'W' | 'L' | 'O';
  saves?: number;
  shotsAgainst?: number;
  goalsAgainst?: number;
  savePct?: number;
  gaa?: number;
  shutout?: boolean;
}

/**
 * Fetch game-by-game log for a player
 * Returns all games from the season (sorted most recent first)
 * Note: Opponent/home-away/result data will be enriched later using schedule context
 */
export async function fetchPlayerGameLog(
  id: string,
  season: string
): Promise<GameLogEntry[]> {
  try {
    const seasonNumber = Number(season);
    const cayenneExp = `playerId=${id}%20and%20seasonId%3C=${seasonNumber}%20and%20seasonId%3E=${seasonNumber}%20and%20gameTypeId=2`;

    // Fetch both game log and game-by-game realtime stats in parallel
    const [gameLogData, realtimeData] = await Promise.all([
      j<GameLogResponse>(`https://api-web.nhle.com/v1/player/${id}/game-log/${seasonNumber}/2`),
      j<{ data?: any[] }>(`https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=true&start=0&limit=100&cayenneExp=${cayenneExp}`)
        .catch(() => ({ data: undefined }))
    ]);

    if (!gameLogData.gameLog || gameLogData.gameLog.length === 0) {
      return [];
    }

    // Create a map of realtime stats by gameId for quick lookup
    const realtimeByGameId = new Map();
    if (realtimeData.data) {
      realtimeData.data.forEach((game: any) => {
        if (game.gameId) {
          realtimeByGameId.set(game.gameId, {
            hits: game.hits,
            blockedShots: game.blockedShots,
            timeOnIcePerGame: game.timeOnIcePerGame
          });
        }
      });
    }

    // Sort by date (most recent first)
    const sortedGames = gameLogData.gameLog
      .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime());

    // Transform to GameLogEntry format, merging with realtime data
    return sortedGames.map(game => {
      // Get realtime stats for this game (if available)
      const realtimeStats = game.gameId ? realtimeByGameId.get(game.gameId) : null;

      // Extract TOI - prefer game log's toi field, fallback to realtime timeOnIcePerGame
      let toi = game.toi;
      let toiSeconds: number | undefined;

      if (toi && typeof toi === 'string') {
        const [mins, secs] = toi.split(':').map(Number);
        toiSeconds = (mins * 60) + (secs || 0);
      } else if (realtimeStats?.timeOnIcePerGame) {
        // Realtime provides TOI in seconds
        const toiSecs = realtimeStats.timeOnIcePerGame;
        toiSeconds = toiSecs;
        const mins = Math.floor(toiSecs / 60);
        const secs = Math.floor(toiSecs % 60);
        toi = `${mins}:${secs.toString().padStart(2, '0')}`;
      }

      // Extract opponent and game context
      const opponent = game.opponentAbbrev;
      const isHome = game.homeRoadFlag === 'H';

      // Note: NHL API game log does not provide team scores or game outcome
      // These will be enriched during hydration using schedule data

      return {
        gameDate: game.gameDate,
        // Game context (opponent from API, result enriched during hydration)
        opponent,
        isHome,
        teamResult: undefined, // Will be enriched during hydration
        teamScore: undefined, // Will be enriched during hydration
        teamGoalsFor: undefined,
        teamGoalsAgainst: undefined,
        // Ice time
        toi,
        toiSeconds,
        // Skater stats
        goals: game.goals || 0,
        assists: game.assists || 0,
        points: game.points || 0,
        plusMinus: game.plusMinus,
        shots: game.shots || 0,
        powerPlayGoals: game.powerPlayGoals || 0,
        powerPlayPoints: game.powerPlayPoints || 0,
        shorthandedGoals: game.shorthandedGoals || 0,
        shorthandedPoints: game.shorthandedPoints || 0,
        hits: realtimeStats?.hits, // From realtime stats
        blocks: realtimeStats?.blockedShots, // From realtime stats
        pim: game.pim,
        // Goalie stats
        gamesStarted: game.gamesStarted,
        decision: game.decision as 'W' | 'L' | 'O',
        saves: game.saves ?? (game.shotsAgainst !== undefined && game.goalsAgainst !== undefined
          ? Math.max(0, game.shotsAgainst - game.goalsAgainst)
          : undefined),
        shotsAgainst: game.shotsAgainst,
        goalsAgainst: game.goalsAgainst,
        savePct: game.savePct ?? game.savePctg,
        gaa: game.goalsAgainstAverage ?? (game.goalsAgainst !== undefined && toiSeconds
          ? Number(((game.goalsAgainst * 3600) / toiSeconds).toFixed(5))
          : undefined),
        shutout: game.shutouts === 1,
      };
    });
  } catch (error) {
    console.warn(`Failed to fetch game log for player ${id}:`, error);
    return [];
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
