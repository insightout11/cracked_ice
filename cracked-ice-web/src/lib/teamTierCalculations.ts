import {
  TeamTierData,
  TeamTierSettings,
  TeamTierCalculationResult,
  TeamScheduleData,
  DEFAULT_TIER_SETTINGS,
  TIER_DESCRIPTIONS
} from '../types/teamTiers';

export interface TeamScoreData {
  teamCode: string;
  teamName: string;
  regularSeasonGames: number;
  playoffGames: number;
  regularSeasonOffNights: number;
  playoffOffNights: number;
  regularSeasonScore: number;
  playoffScore: number;
}

/**
 * Calculate mean and standard deviation for a set of values
 */
export function calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Calculate z-score for a value given mean and standard deviation
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Normalize values to 0-1 range using min-max normalization
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return values.map(() => 0.5); // All values are the same

  return values.map(value => (value - min) / range);
}

/**
 * Calculate composite score for a team based on games and off-night percentage
 */
export function calculateCompositeScore(
  normalizedGames: number,
  offNightPct: number,
  settings: TeamTierSettings
): number {
  return (settings.gameVolumeWeight * normalizedGames) + (settings.offNightWeight * offNightPct);
}

/**
 * Get percentile value from sorted array
 */
export function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * Assign tier based on percentiles for regular season and playoff performance
 */
export function assignTierWithPercentiles(
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

/**
 * Legacy function for backward compatibility
 */
export function assignTier(zScoreRegular: number, zScorePlayoff: number): 'cyan' | 'blue' | 'green' | 'red' {
  const threshold = 0.5;

  if (zScoreRegular >= threshold && zScorePlayoff >= threshold) return 'cyan';
  if (zScorePlayoff >= threshold && zScoreRegular < threshold) return 'blue';
  if (zScoreRegular >= threshold && zScorePlayoff < threshold) return 'green';
  return 'red';
}

/**
 * Get tier explanation text
 */
export function getTierExplanation(tier: 'cyan' | 'blue' | 'green' | 'red'): string {
  return TIER_DESCRIPTIONS[tier];
}

/**
 * Calculate team tiers from schedule data
 */
export function calculateTeamTiers(
  scheduleData: TeamScheduleData[],
  settings: TeamTierSettings = DEFAULT_TIER_SETTINGS
): TeamTierCalculationResult {
  // Step 1: Calculate raw scores for each team
  const teamScores: TeamScoreData[] = scheduleData.map(team => {
    const regularSeasonOffNightPct = team.regularSeasonDates.length > 0
      ? team.regularSeasonOffNights.length / team.regularSeasonDates.length
      : 0;

    const playoffOffNightPct = team.playoffDates.length > 0
      ? team.playoffOffNights.length / team.playoffDates.length
      : 0;

    return {
      teamCode: team.teamCode,
      teamName: team.teamName,
      regularSeasonGames: team.regularSeasonDates.length,
      playoffGames: team.playoffDates.length,
      regularSeasonOffNights: team.regularSeasonOffNights.length,
      playoffOffNights: team.playoffOffNights.length,
      regularSeasonScore: 0, // Will calculate after normalization
      playoffScore: 0 // Will calculate after normalization
    };
  });

  // Step 2: Normalize game counts
  const regularGameCounts = teamScores.map(t => t.regularSeasonGames);
  const playoffGameCounts = teamScores.map(t => t.playoffGames);

  const normalizedRegularGames = normalizeValues(regularGameCounts);
  const normalizedPlayoffGames = normalizeValues(playoffGameCounts);

  // Step 3: Calculate composite scores
  teamScores.forEach((team, index) => {
    const regularOffNightPct = team.regularSeasonGames > 0
      ? team.regularSeasonOffNights / team.regularSeasonGames
      : 0;

    const playoffOffNightPct = team.playoffGames > 0
      ? team.playoffOffNights / team.playoffGames
      : 0;

    team.regularSeasonScore = calculateCompositeScore(
      normalizedRegularGames[index],
      regularOffNightPct,
      settings
    );

    team.playoffScore = calculateCompositeScore(
      normalizedPlayoffGames[index],
      playoffOffNightPct,
      settings
    );
  });

  // Step 4: Calculate z-scores for composite scores
  const regularScores = teamScores.map(t => t.regularSeasonScore);
  const playoffScores = teamScores.map(t => t.playoffScore);

  const regularStats = calculateMeanAndStdDev(regularScores);
  const playoffStats = calculateMeanAndStdDev(playoffScores);

  // Step 5: Create final team tier data
  const teams: TeamTierData[] = teamScores.map(team => {
    const zScoreRegular = calculateZScore(team.regularSeasonScore, regularStats.mean, regularStats.stdDev);
    const zScorePlayoff = calculateZScore(team.playoffScore, playoffStats.mean, playoffStats.stdDev);

    const tier = assignTierWithPercentiles(
      team.regularSeasonScore,
      team.playoffScore,
      regularScores,
      playoffScores
    );

    const regularOffNightPct = team.regularSeasonGames > 0
      ? team.regularSeasonOffNights / team.regularSeasonGames
      : 0;

    const playoffOffNightPct = team.playoffGames > 0
      ? team.playoffOffNights / team.playoffGames
      : 0;

    return {
      teamCode: team.teamCode,
      teamName: team.teamName,
      tier,
      regularSeasonScore: team.regularSeasonScore,
      playoffScore: team.playoffScore,
      regularSeasonGames: team.regularSeasonGames,
      playoffGames: team.playoffGames,
      regularSeasonOffNightPct: regularOffNightPct,
      playoffOffNightPct,
      tierExplanation: getTierExplanation(tier),
      zScoreRegular,
      zScorePlayoff
    };
  });

  // Step 6: Calculate tier distribution
  const tierCounts = {
    cyan: teams.filter(t => t.tier === 'cyan').length,
    blue: teams.filter(t => t.tier === 'blue').length,
    green: teams.filter(t => t.tier === 'green').length,
    red: teams.filter(t => t.tier === 'red').length
  };

  return {
    teams: teams.sort((a, b) => a.teamCode.localeCompare(b.teamCode)),
    settings,
    dateRange: {
      start: '', // Will be filled by caller
      end: '',   // Will be filled by caller
      playoffStart: '' // Will be filled by caller
    },
    statistics: {
      regularSeasonMean: regularStats.mean,
      regularSeasonStdDev: regularStats.stdDev,
      playoffMean: playoffStats.mean,
      playoffStdDev: playoffStats.stdDev,
      tierCounts
    }
  };
}

/**
 * Get team tier by team code
 */
export function getTeamTier(teams: TeamTierData[], teamCode: string): TeamTierData | undefined {
  return teams.find(team =>
    team.teamCode.toLowerCase() === teamCode.toLowerCase()
  );
}

/**
 * Filter teams by tier
 */
export function getTeamsByTier(teams: TeamTierData[], tier: 'cyan' | 'blue' | 'green' | 'red'): TeamTierData[] {
  return teams.filter(team => team.tier === tier);
}

/**
 * Get tier statistics
 */
export function getTierStatistics(teams: TeamTierData[]) {
  const totalTeams = teams.length;
  const tierCounts = {
    cyan: teams.filter(t => t.tier === 'cyan').length,
    blue: teams.filter(t => t.tier === 'blue').length,
    green: teams.filter(t => t.tier === 'green').length,
    red: teams.filter(t => t.tier === 'red').length
  };

  const tierPercentages = {
    cyan: totalTeams > 0 ? (tierCounts.cyan / totalTeams) * 100 : 0,
    blue: totalTeams > 0 ? (tierCounts.blue / totalTeams) * 100 : 0,
    green: totalTeams > 0 ? (tierCounts.green / totalTeams) * 100 : 0,
    red: totalTeams > 0 ? (tierCounts.red / totalTeams) * 100 : 0
  };

  return {
    totalTeams,
    tierCounts,
    tierPercentages
  };
}