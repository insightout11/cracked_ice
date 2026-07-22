import type { SkaterScoringWeights, GoalieScoringWeights } from './types';
// Default scoring weights live in a data-only module so non-TS consumers (the
// derived-data pipeline script) can read the exact same numbers.
import defaultScoring from './default-scoring.json';

export interface ScoringPreset {
  name: string;
  description: string;
  skater_scoring: SkaterScoringWeights;
  goalie_scoring: GoalieScoringWeights;
  default_roster?: Record<string, number>;
}

/**
 * KKUPFL Scoring Preset
 * Head-to-Head Points format, hosted on Yahoo
 * 14 teams per division
 * Scoring: G (4.5), A (3), SOG (0.5), SHP (2), BLK (0.5), HIT (0.25), W (3), SV (0.30), GA (-1.5), Shutout (3)
 * Roster: C, C, LW, LW, RW, RW, UTIL, UTIL, D, D, D, D, G, G, BN, BN, BN, BN (18 total)
 */
export const KKUPFL_PRESET: ScoringPreset = {
  name: 'KKUPFL',
  description: 'KKUPFL Scoring™ - Yahoo H2H Points, 14 teams/division',
  skater_scoring: {
    goals: 4.5,
    assists: 3,
    shots_on_goal: 0.5,
    shorthanded_goals: 2,
    shorthanded_assists: 2,
    blocks: 0.5,
    hits: 0.25
  },
  goalie_scoring: {
    wins: 3,
    saves: 0.30,
    goals_against: -1.5,
    shutouts: 3
  },
  default_roster: {
    C: 2,
    LW: 2,
    RW: 2,
    UTIL: 2,
    D: 4,
    G: 2,
    BN: 4
  }
};

/**
 * APL (Apple and Gino League) Preset
 * Head-to-Head Points format
 * 12 teams
 * Scoring: G (5), A (3.75), SOG (0.5), PPP (0.5), HIT (0.3), BLK (0.6), W (2.75), SV (0.35), GA (-1.5), Shutout (3)
 * Roster: C, C, C, LW, LW, LW, RW, RW, RW, D, D, D, D, UTIL, G, G, BN, BN, BN, BN, IR+, IR+, IR+, IR+, IR+ (25 total)
 */
export const APL_PRESET: ScoringPreset = {
  name: 'APL',
  description: 'Apple and Gino League - H2H Points, 12 teams',
  skater_scoring: {
    goals: 5,
    assists: 3.75,
    shots_on_goal: 0.5,
    powerplay_points: 0.5,
    hits: 0.3,
    blocks: 0.6
  },
  goalie_scoring: {
    wins: 2.75,
    saves: 0.35,
    goals_against: -1.5,
    shutouts: 3
  },
  default_roster: {
    C: 3,
    LW: 3,
    RW: 3,
    D: 4,
    UTIL: 1,
    G: 2,
    BN: 4,
    'IR+': 5
  }
};

/**
 * Yahoo Standard Preset
 * Common Yahoo Fantasy Hockey default scoring
 */
export const YAHOO_STANDARD_PRESET: ScoringPreset = {
  name: 'Yahoo Standard',
  description: 'Yahoo Fantasy Hockey standard scoring',
  skater_scoring: {
    goals: 3,
    assists: 2,
    plus_minus: 1,
    penalty_minutes: 0.5,
    powerplay_points: 1,
    shorthanded_points: 2,
    shots_on_goal: 0.5,
    hits: 0.3,
    blocks: 0.5
  },
  goalie_scoring: {
    wins: 5,
    goals_against: -3,
    saves: 0.6,
    shutouts: 5
  },
  default_roster: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    BN: 4
  }
};

/**
 * ESPN Standard Preset
 * Common ESPN Fantasy Hockey default scoring
 */
export const ESPN_STANDARD_PRESET: ScoringPreset = {
  name: 'ESPN Standard',
  description: 'ESPN Fantasy Hockey standard scoring',
  skater_scoring: {
    goals: 4,
    assists: 2.5,
    plus_minus: 0.5,
    penalty_minutes: -0.5,
    powerplay_goals: 1,
    powerplay_assists: 0.5,
    shorthanded_goals: 2,
    shorthanded_assists: 1,
    game_winning_goals: 1,
    shots_on_goal: 0.4,
    hits: 0.2,
    blocks: 0.5
  },
  goalie_scoring: {
    wins: 4,
    losses: -1,
    goals_against: -1,
    saves: 0.2,
    shutouts: 3
  },
  default_roster: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    UTIL: 2,
    G: 2,
    BN: 4
  }
};

/**
 * Default Preset
 * Simple balanced scoring - used as fallback
 */
export const DEFAULT_PRESET: ScoringPreset = {
  name: 'Default',
  description: 'Simple balanced scoring system',
  skater_scoring: defaultScoring.skater,
  goalie_scoring: defaultScoring.goalie,
  default_roster: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    BN: 4
  }
};

/**
 * Chesterfield League Preset
 * 10-team H2H Points format
 * Playoffs: Weeks 24-26 (starting Monday)
 * Scoring: Balanced goals/assists (1.3), bonus for SH points, light peripherals
 * Roster: C, C, LW, LW, RW, RW, D, D, D, D, G, G, BN, BN, BN, BN, IR, IR+ (18 total)
 */
export const CHESTERFIELD_PRESET: ScoringPreset = {
  name: 'Chesterfield League',
  description: 'Chesterfield League - 10 teams, H2H Points',
  skater_scoring: {
    goals: 1.3,
    assists: 1.3,
    powerplay_points: 1,
    shorthanded_goals: 3,
    shorthanded_assists: 2,
    game_winning_goals: 1,
    shots_on_goal: 0.1,
    hits: 0.1,
    blocks: 0.1
  },
  goalie_scoring: {
    wins: 2,
    saves: 0.1,
    goals_against: -0.5,
    shutouts: 2
  },
  default_roster: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    BN: 4,
    IR: 1,
    'IR+': 1
  }
};

/**
 * Custom Preset - Empty template for user customization
 * Includes all possible scoring categories with 0 values
 */
export const CUSTOM_PRESET: ScoringPreset = {
  name: 'Custom',
  description: 'Fully customizable scoring - configure all categories',
  skater_scoring: {
    // Offensive
    goals: 0,
    assists: 0,
    points: 0,
    plus_minus: 0,
    penalty_minutes: 0,
    // Power Play
    powerplay_goals: 0,
    powerplay_assists: 0,
    powerplay_points: 0,
    // Shorthanded
    shorthanded_goals: 0,
    shorthanded_assists: 0,
    shorthanded_points: 0,
    // Special
    game_winning_goals: 0,
    game_tying_goals: 0,
    hat_tricks: 0,
    // Shots & Shooting
    shots_on_goal: 0,
    shooting_percentage: 0,
    // Faceoffs
    faceoffs_won: 0,
    faceoffs_lost: 0,
    faceoff_wins: 0,
    faceoff_losses: 0,
    faceoff_percentage: 0,
    // Physical
    hits: 0,
    blocks: 0,
    // Defensive
    defensive_points: 0
  },
  goalie_scoring: {
    wins: 0,
    losses: 0,
    overtime_losses: 0,
    goals_against: 0,
    goals_against_average: 0,
    saves: 0,
    save_percentage: 0,
    shots_against: 0,
    shutouts: 0,
    games_started: 0,
    complete_games: 0,
    minutes: 0
  },
  default_roster: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    BN: 4
  }
};

/**
 * All available presets
 */
export const ALL_PRESETS: ScoringPreset[] = [
  KKUPFL_PRESET,
  APL_PRESET,
  YAHOO_STANDARD_PRESET,
  ESPN_STANDARD_PRESET,
  DEFAULT_PRESET,
  CHESTERFIELD_PRESET,
  CUSTOM_PRESET
];

/**
 * Get a preset by name (case-insensitive)
 */
export function getPresetByName(name: string): ScoringPreset | undefined {
  const normalized = name.toLowerCase().trim();
  return ALL_PRESETS.find(preset => preset.name.toLowerCase() === normalized);
}

/**
 * Get preset names for UI dropdowns
 */
export function getPresetNames(): string[] {
  return ALL_PRESETS.map(preset => preset.name);
}

/**
 * Check if a preset name is valid
 */
export function isValidPreset(name: string): boolean {
  return getPresetByName(name) !== undefined;
}
