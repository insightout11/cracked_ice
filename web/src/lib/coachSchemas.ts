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

// Career stats schemas
export const CareerSeasonStatsSchema = z.object({
  gamesPlayed: z.number(),
  goals: z.number(),
  assists: z.number(),
  points: z.number(),
  fppg: z.number().optional(),
  team: z.string().optional(),
});

export const CareerSummarySchema = z.object({
  totalSeasons: z.number(),
  totalGames: z.number(),
  careerAvgPPG: z.number(),
  bestSeason: z.string(),
  bestSeasonPPG: z.number(),
});

export const PlayerBioSchema = z.object({
  birthDate: z.string().optional(),
  birthCity: z.string().optional(),
  birthStateProvince: z.string().optional(),
  birthCountry: z.string().optional(),
  heightInInches: z.number().optional(),
  weightInPounds: z.number().optional(),
  shootsCatches: z.string().optional(),
  sweaterNumber: z.number().optional(),
  draftYear: z.number().optional(),
  draftTeam: z.string().optional(),
  draftRound: z.number().optional(),
  draftPickInRound: z.number().optional(),
  draftOverallPick: z.number().optional(),
});

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
  careerHistory: z.record(z.string(), CareerSeasonStatsSchema).optional(),
  careerSummary: CareerSummarySchema.optional(),
  bio: PlayerBioSchema.optional(),
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
    totalNHLGamesInWindow: z.number().optional(),
    simulation: z.object({
      totalPoints: z.number(),
      startsByPlayer: z.record(z.string(), z.number()),
      unusedSlotsByDate: z.record(z.string(), z.record(z.string(), z.number())),
    }).optional(),
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

// POST /api/coach/users/:userId/compare-swap
export const CompareSwapRequestSchema = z.object({
  candidateId: z.string(),
  replaceId: z.string(),
  window: z.object({
    start: z.string(), // YYYY-MM-DD
    end: z.string(),   // YYYY-MM-DD
  }),
});

export const CompareSwapResponseSchema = z.object({
  candidate: z.object({
    player: PlayerProjectionSchema.extend({
      base: z.object({
        id: z.string(),
        full_name: z.string(),
        team: z.string(),
        position: z.union([z.string(), z.array(z.string())]),
        current_slot: z.string().optional(),
      }),
    }),
    teamImpact: z.object({
      iceChange: z.number(),
      startsChange: z.number(),
      gamesChange: z.number(),
    }),
  }),
  replaced: z.object({
    player: PlayerProjectionSchema.extend({
      base: z.object({
        id: z.string(),
        full_name: z.string(),
        team: z.string(),
        position: z.union([z.string(), z.array(z.string())]),
        current_slot: z.string().optional(),
      }),
    }),
    currentContribution: z.object({
      ice: z.number(),
      starts: z.number(),
      games: z.number(),
    }),
  }),
  currentTeamMetrics: z.object({
    totalICE: z.number(),
    totalStarts: z.number(),
  }),
  newTeamMetrics: z.object({
    totalICE: z.number(),
    totalStarts: z.number(),
  }),
});

export type CompareSwapRequest = z.infer<typeof CompareSwapRequestSchema>;
export type CompareSwapResponse = z.infer<typeof CompareSwapResponseSchema>;

// POST /api/coach/users/:userId/smart-suggestions
export const SmartSuggestionsRequestSchema = z.object({
  window: z.object({
    start: z.string(), // YYYY-MM-DD
    end: z.string(),   // YYYY-MM-DD
  }),
  position: z.string().optional(),
  limit: z.number().optional(),
  minIceScore: z.number().optional(),
});

export const SmartSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.object({
    player: PlayerProjectionSchema.extend({
      base: z.object({
        id: z.string(),
        full_name: z.string(),
        team: z.string(),
        position: z.union([z.string(), z.array(z.string())]),
        current_slot: z.string().optional(),
      }),
    }),
    estimatedImpact: z.number(),
    bestReplacement: z.object({
      playerId: z.string(),
      playerName: z.string(),
      slot: z.string(),
      currentICE: z.number().optional(),
    }).nullable(),
    quickStats: z.object({
      iceScore: z.number(),
      gamesAvailable: z.number(),
      starts: z.number(),
      positionFit: z.enum(['perfect', 'partial']),
    }),
  })),
});

export type SmartSuggestionsRequest = z.infer<typeof SmartSuggestionsRequestSchema>;
export type SmartSuggestionsResponse = z.infer<typeof SmartSuggestionsResponseSchema>;

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
