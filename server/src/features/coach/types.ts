import { z } from 'zod';

export const ScoringWeightsSchema = z.object({
  goals: z.number(),
  assists: z.number(),
  shots_on_goal: z.number(),
  blocks: z.number(),
  power_play_points: z.number(),
  shorthanded_goals: z.number().optional(),
  shorthanded_assists: z.number().optional(),
  hits: z.number().optional(),
  game_winning_goals: z.number().optional()
});

// Comprehensive Yahoo Fantasy Hockey Stats
export const SkaterScoringWeightsSchema = z.object({
  // Offensive
  goals: z.number().optional(),
  assists: z.number().optional(),
  points: z.number().optional(),
  plus_minus: z.number().optional(),
  penalty_minutes: z.number().optional(),

  // Power Play
  powerplay_goals: z.number().optional(),
  powerplay_assists: z.number().optional(),
  powerplay_points: z.number().optional(),
  power_play_points: z.number().optional(),

  // Shorthanded
  shorthanded_goals: z.number().optional(),
  shorthanded_assists: z.number().optional(),
  shorthanded_points: z.number().optional(),

  // Special
  game_winning_goals: z.number().optional(),
  game_tying_goals: z.number().optional(),
  hat_tricks: z.number().optional(),

  // Shots & Shooting
  shots_on_goal: z.number().optional(),
  shooting_percentage: z.number().optional(),

  // Faceoffs
  faceoffs_won: z.number().optional(),
  faceoffs_lost: z.number().optional(),
  faceoff_wins: z.number().optional(),
  faceoff_losses: z.number().optional(),
  faceoff_percentage: z.number().optional(),

  // Physical
  hits: z.number().optional(),
  blocks: z.number().optional(),

  // Defensive
  defensive_points: z.number().optional()
}).optional();

export const GoalieScoringWeightsSchema = z.object({
  wins: z.number().optional(),
  losses: z.number().optional(),
  overtime_losses: z.number().optional(),
  goals_against: z.number().optional(),
  goals_against_average: z.number().optional(),
  saves: z.number().optional(),
  save_percentage: z.number().optional(),
  shots_against: z.number().optional(),
  shutouts: z.number().optional(),
  games_started: z.number().optional(),
  complete_games: z.number().optional(),
  minutes: z.number().optional()
}).optional();

export const LineupSlotsSchema = z.record(z.string(), z.number().int().nonnegative());

export const LeagueProfileSchema = z.object({
  league_name: z.string(),
  scoring_type: z.enum(['points', 'categories']),
  preset_name: z.string().optional(),

  // For Points Leagues - point values for each stat
  skater_scoring: SkaterScoringWeightsSchema,
  goalie_scoring: GoalieScoringWeightsSchema,

  // For Category Leagues - which categories to track
  skater_categories: z.array(z.string()).optional(),
  goalie_categories: z.array(z.string()).optional(),

  lineup_slots: LineupSlotsSchema,
  notes: z.string().optional(),

  // League configuration
  num_teams: z.number().int().min(4).max(32).optional(),
  playoff_start_date: z.string().optional(),

  // Legacy support (will be migrated)
  scoring_weights: ScoringWeightsSchema.optional()
});

// Goalie-specific stats
export const GoalieStatsSchema = z.object({
  wins: z.number().optional(),
  losses: z.number().optional(),
  overtime_losses: z.number().optional(),
  goals_against: z.number().optional(),
  goals_against_average: z.number().optional(),
  saves: z.number().optional(),
  save_percentage: z.number().optional(),
  shots_against: z.number().optional(),
  shutouts: z.number().optional(),
  games_started: z.number().optional(),
  complete_games: z.number().optional(),
  minutes: z.number().optional()
});

export const PlayerStatsSchema = z.object({
  goals: z.number(),
  assists: z.number(),
  shots_on_goal: z.number(),
  blocks: z.number(),
  power_play_points: z.number(),
  shorthanded_goals: z.number().optional(),
  shorthanded_assists: z.number().optional(),
  hits: z.number().optional(),
  game_winning_goals: z.number().optional()
});

export const PlayerSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  team: z.string(),
  position: z.string(),
  games_played: z.number().int().positive(),
  stats: PlayerStatsSchema,
  upcoming_games: z.array(z.string()),
  is_drop_eligible: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  current_slot: z.string().optional() // Player's current roster slot (e.g., "C", "LW", "BN", "IR", "IR+")
});

export const FreeAgentSchema = PlayerSchema.extend({
  recent_form: z
    .object({
      last5_points: z.number(),
      last5_games: z.number().int().positive()
    })
    .optional()
});

export const UserContextSchema = z.object({
  user_id: z.string(),
  league_profile: LeagueProfileSchema,
  roster: z.array(PlayerSchema),
  free_agents: z.array(FreeAgentSchema)
});

export const LeagueSettingsSchema = LeagueProfileSchema;
export const RosterUploadSchema = z.object({
  roster: z.array(PlayerSchema)
});
export const FreeAgentsUploadSchema = z.object({
  free_agents: z.array(FreeAgentSchema)
});

export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type SkaterScoringWeights = z.infer<typeof SkaterScoringWeightsSchema>;
export type GoalieScoringWeights = z.infer<typeof GoalieScoringWeightsSchema>;
export type LeagueProfile = z.infer<typeof LeagueProfileSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
export type GoalieStats = z.infer<typeof GoalieStatsSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type FreeAgent = z.infer<typeof FreeAgentSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
export type LeagueSettings = z.infer<typeof LeagueSettingsSchema>;
export type RosterUpload = z.infer<typeof RosterUploadSchema>;
export type FreeAgentsUpload = z.infer<typeof FreeAgentsUploadSchema>;

export const DateRangeSchema = z.object({
  start: z.string(),
  end: z.string()
});

export const CoachRequestSchema = z.object({
  window: DateRangeSchema
});

export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export interface GameDetail {
  date: string;
  opponent: string;
  isHome: boolean;
  isOffNight: boolean;
  startTime: string;
}

export interface PlayerProjection {
  base: Player;
  fppg: number;
  last30Fppg?: number;
  last7Fppg?: number;
  projectedPoints: number;
  upcomingGamesInWindow: string[];
  gameDetails?: GameDetail[]; // Full game metadata for calendar views
  offNightRate: number;
  strengthOfSchedule: number; // 1-10 scale, higher = easier
  iceScore: number; // Impact • Context • Expectation - personalized 0-10 rating
  iceBreakdown?: import('./iceRating').IceRatingBreakdown;
}

export interface SimulationStartRecord {
  playerId: string;
  playerName: string;
  position: string;
  date: string;
  fppg: number;
}

export interface SimulationBenchRecord {
  playerId: string;
  playerName: string;
  position: string;
  date: string;
  fppg: number;
  reason: 'slot_filled';
}

export interface SimulationResult {
  totalPoints: number;
  startsByPlayer: Map<string, number>;
  startRecords: SimulationStartRecord[];
  benchRecords: SimulationBenchRecord[];
  unusedSlotsByDate: Map<string, Record<string, number>>;
}

export interface Recommendation {
  add_player: PlayerProjection & { source: 'free_agent' };
  drop_player: PlayerProjection & { source: 'roster' };
  delta_points: number;
  delta_gp: number;
  badge: string;
  add_player_start_dates?: string[];
  add_player_points?: number;
  add_player_start_count?: number;
  add_player_blocked_dates?: string[];
  add_player_slots_by_date?: Record<string, string>; // Maps date -> slot type filled (e.g., "C", "RW")
  drop_player_start_dates?: string[];
  drop_player_points?: number;
  drop_player_start_count?: number;
  unused_slots_by_date?: Record<string, Record<string, number>>;
}

export interface CoachResponse {
  baseline_points: number;
  baseline_unused_slots?: Record<string, Record<string, number>>;
  recommendations: Recommendation[];
  window: { start: string; end: string };
}



export interface NormalizedLeagueProfile extends LeagueProfile {
  preset_name: string;
  skater_scoring: Record<string, number>;
  goalie_scoring: Record<string, number>;
  lineup_slots: Record<string, number>;
}

// Position Override Types
export const PositionOverrideSchema = z.object({
  player_id: z.string(), // e.g., "nhl:8480800" for Quinton Byfield
  positions: z.array(z.string()), // e.g., ["C", "LW"] for multi-position eligibility
  updated_at: z.string(), // ISO timestamp
  updated_by: z.string().optional(), // Username or "system"
  notes: z.string().optional(), // e.g., "Yahoo granted LW eligibility 2024-12-05"
});

export type PositionOverride = z.infer<typeof PositionOverrideSchema>;

export const PositionOverridesSchema = z.object({
  overrides: z.array(PositionOverrideSchema),
  version: z.string().optional(), // Schema version for migrations
});

export type PositionOverrides = z.infer<typeof PositionOverridesSchema>;

