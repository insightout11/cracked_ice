import { z } from 'zod';

// =============================================================================
// Backend Contract Schemas (exact match to server responses)
// =============================================================================


// Scoring weights (used in league_profile)
export const SkaterScoringSchema = z.record(z.string(), z.number()).optional();
export const GoalieScoringSchema = z.record(z.string(), z.number()).optional();

// League Profile (from GET /context)
export const LeagueProfileSchema = z.object({
  league_name: z.string(),
  scoring_type: z.enum(['points', 'categories']),
  preset_name: z.string().optional(),
  lineup_slots: z.record(z.string(), z.number()),
  skater_scoring: SkaterScoringSchema,
  goalie_scoring: GoalieScoringSchema,
  // Legacy support
  scoring_weights: z.record(z.string(), z.number()).optional(),
  skater_categories: z.array(z.string()).optional(),
  goalie_categories: z.array(z.string()).optional(),
  num_teams: z.number().optional(),
  playoff_start_date: z.string().optional(),
  notes: z.string().optional(),
});

// Player stats (from GET /roster)
export const PlayerStatsSchema = z.object({
  goals: z.number(),
  assists: z.number(),
  shots_on_goal: z.number(),
  power_play_points: z.number(),
  blocks: z.number(),
  hits: z.number().optional(),
  shorthanded_goals: z.number().optional(),
  shorthanded_assists: z.number().optional(),
  game_winning_goals: z.number().optional(),
}).passthrough(); // Allow additional fields

// Roster Player (from GET /roster)
export const RosterPlayerSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  team: z.string(),
  positions: z.array(z.string()),
  current_slot: z.string().optional(),
  games_played: z.number(),
  stats: PlayerStatsSchema,
  blendedFppg: z.number().nullable().optional(),
  seasonFppg: z.number().optional(),
  last30Fppg: z.number().optional(),
  last7Fppg: z.number().optional(),
  injury_status: z.string().optional(),
});

// GET /api/coach/users/:userId/context
export const ContextResponseSchema = z.object({
  league_profile: LeagueProfileSchema.nullable(),
  note: z.string().optional(),
});

// GET /api/coach/users/:userId/roster
export const RosterResponseSchema = z.object({
  roster: z.array(RosterPlayerSchema),
});

// Game detail for calendar view
export const GameDetailSchema = z.object({
  opponent: z.string(),
  isHome: z.boolean(),
  isOffNight: z.boolean(),
  startTime: z.string(),
  opponentGaPer60: z.number().optional(),
});

// Player Projection (from POST /projections)
export const PlayerProjectionSchema = z.object({
  fppg: z.number(),
  starts: z.number(),
  gamesAvailable: z.number(),
  projectedPoints: z.number(),
  offNightRate: z.number(),
  strengthOfSchedule: z.number(),
  iceScore: z.number().optional(), // SoS-adjusted ICE score (may not be present in older data)
  startsByDate: z.record(z.string(), z.number()).optional(),
  gamesByDate: z.record(z.string(), GameDetailSchema).optional(), // Full game details with opponent, home/away, GAA
});

// POST /api/coach/users/:userId/projections response
export const ProjectionsResponseSchema = z.object({
  projections: z.record(z.string(), PlayerProjectionSchema),
  meta: z.object({
    weightsSource: z.string().optional(),
  }).optional(),
});

// GET /api/coach/health
export const HealthResponseSchema = z.object({
  version: z.string(),
  capabilities: z.object({
    projections: z.boolean().optional(),
    weights: z.boolean().optional(),
    presets: z.boolean().optional(),
  }).optional(),
  dataCache: z.object({
    loaded: z.boolean(),
    version: z.string().nullable(),
    generatedAt: z.string().nullable(),
    sourcePaths: z.array(z.string()).optional(),
    files: z.record(z.string(), z.object({
      path: z.string(),
      exists: z.boolean(),
      bytes: z.number(),
      mtime: z.string().nullable(),
    })).optional(),
  }).optional(),
}).passthrough(); // Allow additional fields

// =============================================================================
// Type exports from schemas
// =============================================================================

export type LeagueProfile = z.infer<typeof LeagueProfileSchema>;
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;
export type ContextResponse = z.infer<typeof ContextResponseSchema>;
export type RosterResponse = z.infer<typeof RosterResponseSchema>;
export type GameDetail = z.infer<typeof GameDetailSchema>;
export type PlayerProjection = z.infer<typeof PlayerProjectionSchema>;
export type ProjectionsResponse = z.infer<typeof ProjectionsResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// =============================================================================
// Request schemas
// =============================================================================

export const ProjectionsRequestSchema = z.object({
  league: LeagueProfileSchema,
  window: z.object({
    start: z.string(), // YYYY-MM-DD
    end: z.string(),   // YYYY-MM-DD
  }),
  roster: z.array(z.object({
    playerId: z.string(),
    slot: z.string(),
  })),
});

export type ProjectionsRequest = z.infer<typeof ProjectionsRequestSchema>;

// =============================================================================
// Contract validation helpers
// =============================================================================

export function validateWithContractBreakLogging<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.warn(`🚨 CONTRACT-BREAK in ${context}:`, {
      issues: result.error.issues,
      rawPayload: data,
      timestamp: new Date().toISOString()
    });
    return null;
  }

  console.log(`✅ Schema validation passed for ${context}`);
  return result.data;
}

export function parsePlayerIdToNumeric(id: string): string {
  // Handle both "8478402" and "nhl:8478402" formats
  if (id.startsWith('nhl:')) {
    return id.slice(4);
  }
  return id;
}
