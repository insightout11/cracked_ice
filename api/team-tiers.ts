import fs from 'fs';
import path from 'path';

interface TeamTierData {
  teamCode: string;
  teamName: string;
  tier: 'cyan' | 'blue' | 'green' | 'red';
  regularSeasonScore: number;
  playoffScore: number;
  regularSeasonGames: number;
  playoffGames: number;
  regularSeasonOffNightPct: number;
  playoffOffNightPct: number;
  tierExplanation: string;
  zScoreRegular: number;
  zScorePlayoff: number;
}

interface TeamTierSettings {
  showScheduleColors: boolean;
  regularSeasonWeight: number;
  playoffWeight: number;
  offNightWeight: number;
  gameVolumeWeight: number;
}

const DEFAULT_TIER_SETTINGS: TeamTierSettings = {
  showScheduleColors: true,
  regularSeasonWeight: 0.6,
  playoffWeight: 0.6,
  offNightWeight: 0.5,
  gameVolumeWeight: 0.5
};

const TEAM_NAMES = {
  'ANA': 'Anaheim Ducks',
  'ARI': 'Arizona Coyotes',
  'BOS': 'Boston Bruins',
  'BUF': 'Buffalo Sabres',
  'CAR': 'Carolina Hurricanes',
  'CBJ': 'Columbus Blue Jackets',
  'CGY': 'Calgary Flames',
  'CHI': 'Chicago Blackhawks',
  'COL': 'Colorado Avalanche',
  'DAL': 'Dallas Stars',
  'DET': 'Detroit Red Wings',
  'EDM': 'Edmonton Oilers',
  'FLA': 'Florida Panthers',
  'LAK': 'Los Angeles Kings',
  'MIN': 'Minnesota Wild',
  'MTL': 'Montreal Canadiens',
  'NSH': 'Nashville Predators',
  'NJD': 'New Jersey Devils',
  'NYI': 'New York Islanders',
  'NYR': 'New York Rangers',
  'OTT': 'Ottawa Senators',
  'PHI': 'Philadelphia Flyers',
  'PIT': 'Pittsburgh Penguins',
  'SEA': 'Seattle Kraken',
  'SJS': 'San Jose Sharks',
  'STL': 'St. Louis Blues',
  'TBL': 'Tampa Bay Lightning',
  'TOR': 'Toronto Maple Leafs',
  'UTA': 'Utah Hockey Club',
  'VAN': 'Vancouver Canucks',
  'VGK': 'Vegas Golden Knights',
  'WSH': 'Washington Capitals',
  'WPG': 'Winnipeg Jets'
};

// Calculate end of Week 23 (before Week 24 starts) for fantasy playoffs
function calculatePlayoffStartDate(playoffStartWeek: number = 24): string {
  const seasonStart = new Date('2025-10-01');
  const firstMonday = new Date(seasonStart);
  const dayOfWeek = firstMonday.getDay();
  const daysToAdd = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
  firstMonday.setDate(firstMonday.getDate() + daysToAdd);

  const playoffStartDate = new Date(firstMonday);
  playoffStartDate.setDate(playoffStartDate.getDate() + ((playoffStartWeek - 1) * 7));

  return playoffStartDate.toISOString().split('T')[0];
}

// Utility functions
function calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

function assignTierWithPercentiles(
  regularScore: number,
  playoffScore: number,
  regularScores: number[],
  playoffScores: number[]
): 'cyan' | 'blue' | 'green' | 'red' {
  // Calculate percentiles - 65th for "high", 50th for "above-average"
  const sortedRegular = [...regularScores].sort((a, b) => a - b);
  const sortedPlayoff = [...playoffScores].sort((a, b) => a - b);

  const regularHighThreshold = getPercentile(sortedRegular, 65);
  const regularAboveAvgThreshold = getPercentile(sortedRegular, 50);
  const playoffHighThreshold = getPercentile(sortedPlayoff, 65);
  const playoffAboveAvgThreshold = getPercentile(sortedPlayoff, 50);

  const isHighRegular = regularScore >= regularHighThreshold;
  const isAboveAvgRegular = regularScore >= regularAboveAvgThreshold;
  const isHighPlayoff = playoffScore >= playoffHighThreshold;
  const isAboveAvgPlayoff = playoffScore >= playoffAboveAvgThreshold;

  // Cyan: High in one, Above-average in other
  if ((isHighRegular && isAboveAvgPlayoff) || (isHighPlayoff && isAboveAvgRegular)) return 'cyan';
  if (isHighPlayoff && !isHighRegular) return 'blue';
  if (isHighRegular && !isHighPlayoff) return 'green';
  return 'red';
}

function getTierExplanation(tier: 'cyan' | 'blue' | 'green' | 'red'): string {
  const explanations = {
    cyan: 'Elite: Strong in both regular season and playoffs',
    blue: 'Playoff Specialists: Strong playoff schedule',
    green: 'Regular Season Strong: Good regular season schedule',
    red: 'Below Average: Weaker schedules overall'
  };
  return explanations[tier];
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playoffStartWeek = 24 } = req.query;
    const settings = DEFAULT_TIER_SETTINGS;
    const playoffStart = calculatePlayoffStartDate(Number(playoffStartWeek));

    // Load schedule data
    const schedulePath = path.resolve(process.cwd(), 'data', 'schedules-20252026.json');

    if (!fs.existsSync(schedulePath)) {
      console.error('Schedule file not found at:', schedulePath);
      return res.status(500).json({ error: 'Schedule data not available' });
    }

    const scheduleData = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
    const teams = scheduleData.teams;

    // Step 1: Calculate which days are off-nights (≤ 8 total games)
    const gameCounts = new Map<string, number>();

    for (const [teamCode, teamDates] of Object.entries(teams)) {
      for (const date of teamDates as string[]) {
        gameCounts.set(date, (gameCounts.get(date) || 0) + 1);
      }
    }

    // Convert team counts to actual game counts (divide by 2)
    const actualGameCounts = new Map<string, number>();
    for (const [date, teamCount] of gameCounts.entries()) {
      actualGameCounts.set(date, Math.floor(teamCount / 2));
    }

    // Identify off-night dates (≤ 8 games total)
    const offNightDates = new Set<string>();
    for (const [date, gameCount] of actualGameCounts.entries()) {
      if (gameCount <= 8) {
        offNightDates.add(date);
      }
    }

    // Step 2: Calculate scores for each team
    const teamData: Array<{
      teamCode: string;
      teamName: string;
      regularSeasonGames: number;
      playoffGames: number;
      regularSeasonOffNights: number;
      playoffOffNights: number;
      regularSeasonScore: number;
      playoffScore: number;
    }> = [];

    for (const [teamCode, teamDates] of Object.entries(teams)) {
      const dates = teamDates as string[];
      const regularSeasonDates = dates.filter(date => date < playoffStart);
      const playoffDates = dates.filter(date => date >= playoffStart);

      // Calculate off-nights for each period
      const regularSeasonOffNights = regularSeasonDates.filter(date => offNightDates.has(date)).length;
      const playoffOffNights = playoffDates.filter(date => offNightDates.has(date)).length;

      teamData.push({
        teamCode,
        teamName: (TEAM_NAMES as any)[teamCode] || teamCode,
        regularSeasonGames: regularSeasonDates.length,
        playoffGames: playoffDates.length,
        regularSeasonOffNights,
        playoffOffNights,
        regularSeasonScore: 0, // Will calculate after normalization
        playoffScore: 0 // Will calculate after normalization
      });
    }

    // Step 3: Normalize game counts and calculate composite scores
    const regularGameCounts = teamData.map(t => t.regularSeasonGames);
    const playoffGameCounts = teamData.map(t => t.playoffGames);

    const regularStats = calculateMeanAndStdDev(regularGameCounts);
    const playoffStats = calculateMeanAndStdDev(playoffGameCounts);

    // Calculate composite scores
    const finalTeamData: TeamTierData[] = teamData.map(team => {
      // Normalize game counts
      const normalizedRegularGames = regularStats.stdDev > 0
        ? (team.regularSeasonGames - regularStats.mean) / regularStats.stdDev
        : 0;
      const normalizedPlayoffGames = playoffStats.stdDev > 0
        ? (team.playoffGames - playoffStats.mean) / playoffStats.stdDev
        : 0;

      // Calculate off-night percentages
      const regularOffNightPct = team.regularSeasonGames > 0 ? team.regularSeasonOffNights / team.regularSeasonGames : 0;
      const playoffOffNightPct = team.playoffGames > 0 ? team.playoffOffNights / team.playoffGames : 0;

      // Calculate composite scores
      const regularScore = (settings.gameVolumeWeight * normalizedRegularGames) + (settings.offNightWeight * regularOffNightPct);
      const playoffScore = (settings.gameVolumeWeight * normalizedPlayoffGames) + (settings.offNightWeight * playoffOffNightPct);

      return {
        ...team,
        regularSeasonScore: regularScore,
        playoffScore: playoffScore,
        regularSeasonOffNightPct: regularOffNightPct,
        playoffOffNightPct: playoffOffNightPct,
        zScoreRegular: 0, // Will calculate after getting all scores
        zScorePlayoff: 0,
        tier: 'red' as const,
        tierExplanation: ''
      };
    });

    // Step 4: Calculate z-scores for composite scores and assign tiers
    const regularScores = finalTeamData.map(t => t.regularSeasonScore);
    const playoffScores = finalTeamData.map(t => t.playoffScore);

    const regularScoreStats = calculateMeanAndStdDev(regularScores);
    const playoffScoreStats = calculateMeanAndStdDev(playoffScores);

    // Update with z-scores and tiers
    finalTeamData.forEach(team => {
      team.zScoreRegular = calculateZScore(team.regularSeasonScore, regularScoreStats.mean, regularScoreStats.stdDev);
      team.zScorePlayoff = calculateZScore(team.playoffScore, playoffScoreStats.mean, playoffScoreStats.stdDev);
      team.tier = assignTierWithPercentiles(
        team.regularSeasonScore,
        team.playoffScore,
        regularScores,
        playoffScores
      );
      team.tierExplanation = getTierExplanation(team.tier);
    });

    // Calculate tier distribution
    const tierCounts = {
      cyan: finalTeamData.filter(t => t.tier === 'cyan').length,
      blue: finalTeamData.filter(t => t.tier === 'blue').length,
      green: finalTeamData.filter(t => t.tier === 'green').length,
      red: finalTeamData.filter(t => t.tier === 'red').length
    };

    const result = {
      teams: finalTeamData.sort((a, b) => a.teamCode.localeCompare(b.teamCode)),
      settings,
      dateRange: {
        start: '2025-10-01',
        end: '2026-04-30',
        playoffStart
      },
      statistics: {
        regularSeasonMean: regularScoreStats.mean,
        regularSeasonStdDev: regularScoreStats.stdDev,
        playoffMean: playoffScoreStats.mean,
        playoffStdDev: playoffScoreStats.stdDev,
        tierCounts
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error in team-tiers API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}