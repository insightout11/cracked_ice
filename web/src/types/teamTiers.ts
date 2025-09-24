export type TeamTier = 'cyan' | 'blue' | 'green' | 'red';

export interface TeamTierData {
  teamCode: string;
  teamName: string;
  tier: TeamTier;
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

export interface TeamTierSettings {
  showScheduleColors: boolean;
  regularSeasonWeight: number;
  playoffWeight: number;
  offNightWeight: number;
  gameVolumeWeight: number;
}

export interface TeamTierCalculationResult {
  teams: TeamTierData[];
  settings: TeamTierSettings;
  dateRange: {
    start: string;
    end: string;
    playoffStart: string;
  };
  statistics: {
    regularSeasonMean: number;
    regularSeasonStdDev: number;
    playoffMean: number;
    playoffStdDev: number;
    tierCounts: {
      cyan: number;
      blue: number;
      green: number;
      red: number;
    };
  };
}

export interface TeamTierApiRequest {
  start?: string;
  end?: string;
  playoffStartWeek?: number;
  settings?: Partial<TeamTierSettings>;
}

export interface TeamScheduleData {
  teamCode: string;
  teamName: string;
  regularSeasonDates: string[];
  playoffDates: string[];
  regularSeasonOffNights: string[];
  playoffOffNights: string[];
}

export const DEFAULT_TIER_SETTINGS: TeamTierSettings = {
  showScheduleColors: true,
  regularSeasonWeight: 0.6,
  playoffWeight: 0.6,
  offNightWeight: 0.5,  // Increased from 0.4 to give off-nights more weight
  gameVolumeWeight: 0.5  // Decreased from 0.6 to balance with off-night weight
};

export const TIER_COLORS = {
  cyan: '#5EF5FF',
  blue: '#84a9ff',
  green: '#84F7A6',
  red: '#FF8D8D'
} as const;

export const TIER_DESCRIPTIONS = {
  cyan: 'Elite: Strong in both regular season and playoffs',
  blue: 'Playoff Specialists: Strong playoff schedule',
  green: 'Regular Season Strong: Good regular season schedule',
  red: 'Below Average: Weaker schedules overall'
} as const;