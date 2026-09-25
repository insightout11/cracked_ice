import { z } from 'zod';
import type { LeagueProfile, RosterPlayer } from './coachSchemas';
import { SEASON, SEASON_GAMES_PER_TEAM } from './season';
import scoringPresets from '../../../config/scoring-presets.json';

export const LEAGUE_WORKSPACE_VERSION = 2 as const;
export const YAHOO_DEFAULT_PLAYOFFS = {
  start: SEASON.defaultFantasyPlayoffsStart,
  end: SEASON.defaultFantasyPlayoffsEnd,
} as const;
export const EARLY_FINISH_PLAYOFFS = {
  start: '2027-03-15',
  end: '2027-04-04',
} as const;
export const KKUPFL_PLAYOFFS = {
  start: '2027-03-08',
  end: '2027-03-28',
} as const;
export const KKUPFL_DRAFT_DATES = {
  roomsOpen: '2026-09-04',
  joinDeadline: '2026-09-06',
  lottery: '2026-09-06',
  draftStart: '2026-09-10',
} as const;
export const DEFAULT_IR_ELIGIBLE_STATUSES = ['IR', 'IR-LT'] as const;
export const KKUPFL_IR_ELIGIBLE_STATUSES = ['IR', 'IR-LT', 'O', 'DTD'] as const;
export const PLAYOFF_DEFAULT_MIGRATION = '2026-27-yahoo-calendar-correction' as const;
export const SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION = '2026-27-retire-schedule-maximizer' as const;
export const DRAFT_TARGET_PICK_MIGRATION = '2026-27-rebuild-target-overall-picks' as const;
export const KKUPFL_2026_27_PRESET_MIGRATION = '2026-27-kkupfl-rules-correction' as const;
export const CANDIDATE_EVIDENCE_MIGRATION = '2026-27-candidate-evidence-model' as const;

export const SCORING_PRESETS = scoringPresets;

export type ScoringPresetId = keyof typeof SCORING_PRESETS | 'custom';

export const DRAFT_STRATEGY_PRESETS = {
  balanced: { label: 'Balanced', description: 'Standardized projected production leads; schedules and value over replacement break close calls.', weights: { production: 55, regularSeason: 20, playoffs: 15, positionValue: 10 } },
  'playoff-edge': { label: 'Playoff edge', description: 'Accepts some regular-season schedule cost for a stronger fantasy-playoff roster.', weights: { production: 45, regularSeason: 15, playoffs: 30, positionValue: 10 } },
  'make-playoffs': { label: 'Make the playoffs', description: 'Emphasizes usable regular-season games before optimizing the playoff weeks.', weights: { production: 40, regularSeason: 40, playoffs: 10, positionValue: 10 } },
  'stars-streamers': { label: 'Stars and streamers', description: 'Prioritizes elite production and assumes later roster spots can be streamed.', weights: { production: 70, regularSeason: 10, playoffs: 10, positionValue: 10 } },
  'schedule-maximizer': { label: 'Schedule maximizer', description: 'Strongly rewards off-night access and lineup fit across both windows.', weights: { production: 35, regularSeason: 30, playoffs: 25, positionValue: 10 } },
} as const;

// Schedule maximizer remains readable so existing saved workspaces can migrate
// safely, but it is no longer offered as a customer-facing preset.
export const VISIBLE_DRAFT_STRATEGY_PRESET_IDS = [
  'balanced',
  'playoff-edge',
  'make-playoffs',
  'stars-streamers',
] as const satisfies readonly (keyof typeof DRAFT_STRATEGY_PRESETS)[];

export type DraftStrategyPresetId = keyof typeof DRAFT_STRATEGY_PRESETS | 'custom';
export type DraftOrderType = 'snake' | 'linear' | 'balanced';

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimestampSchema = z.string().datetime().optional();
const WeightMapSchema = z.record(z.string(), z.number().finite());
const DraftStrategyWeightsSchema = z.object({
  production: z.number().min(0).max(100),
  regularSeason: z.number().min(0).max(100),
  playoffs: z.number().min(0).max(100),
  positionValue: z.number().min(0).max(100),
});

const ImportedProjectionPlayerSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  team: z.string().optional(),
  positions: z.array(z.string()).default([]),
  identitySource: z.enum(['canonical', 'projection-import']).default('canonical'),
  // Some scoring systems can legitimately project a negative per-game rate,
  // especially for low-volume goalies. Rejecting one such row prevented the
  // entire imported source from being applied.
  projectedFppg: z.number().finite(),
  projectedGames: z.number().finite().min(0).max(SEASON_GAMES_PER_TEAM),
  stats: z.record(z.string(), z.number().finite()).default({}),
});

const ProjectionSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  season: z.string().min(1).max(20),
  importedAt: z.string().datetime(),
  matchedCount: z.number().int().min(0),
  projectionOnlyCount: z.number().int().min(0).default(0),
  fileName: z.string().min(1).max(255).optional(),
  players: z.record(z.string(), ImportedProjectionPlayerSchema),
});

const KeeperCostSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('draft-round'), round: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal('salary'), amount: z.number().min(0), currency: z.string().default('USD') }),
]);

const DraftPickSchema = z.object({
  playerId: z.string().min(1),
  providerPlayerId: z.string().optional(),
  providerTeamId: z.string().optional(),
  fullName: z.string().min(1),
  team: z.string(),
  positions: z.array(z.string()),
  status: z.enum(['mine', 'taken']),
  slot: z.string().optional(),
  overallPick: z.number().int().min(1).optional(),
  source: z.enum(['manual', 'provider', 'simulation']).default('manual'),
  madeAt: z.string().datetime(),
});

const DraftTargetSchema = z.object({
  playerId: z.string().min(1),
  fullName: z.string().min(1),
  priority: z.enum(['high', 'normal', 'watch']).default('normal'),
  targetRound: z.number().int().min(1).max(50).nullable().default(null),
  targetOverallPick: z.number().int().min(1).max(1000).nullable().default(null),
  backupOrder: z.number().int().min(0).max(20).default(0),
  addedAt: z.string().datetime(),
});

export const LeagueWorkspaceRosterEntrySchema = z.object({
  playerId: z.string().min(1),
  providerPlayerId: z.string().optional(),
  fullName: z.string().min(1),
  team: z.string(),
  positions: z.array(z.string()),
  slot: z.string().optional(),
  keeper: z.boolean().default(false),
  keeperCost: KeeperCostSchema.optional(),
  protected: z.boolean().default(false),
  undroppable: z.boolean().default(false),
  /** The owner has marked this player OK to drop for streamers (the planner's streaming spots). */
  streamSpot: z.boolean().optional(),
});

export const LeagueCandidateSchema = z.object({
  playerId: z.string().min(1),
  // `availability` is the legacy evidence-source field. Keep it readable so
  // existing synced workspaces migrate without losing confirmed candidates.
  availability: z.enum(['live-provider', 'screenshot-confirmed', 'user-confirmed', 'imported-snapshot', 'unknown']),
  status: z.enum(['available', 'taken', 'unknown']).optional(),
  evidence: z.object({
    source: z.enum(['live-provider', 'screenshot-confirmed', 'user-confirmed', 'imported-snapshot', 'none']),
    observedAt: TimestampSchema,
    expiresAt: TimestampSchema,
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  discovery: z.object({
    source: z.enum(['manual-search', 'schedule-fit', 'market-boundary', 'missing-market-data', 'provider']),
    marketSource: z.string().optional(),
    marketRank: z.number().finite().positive().optional(),
    boundaryStart: z.number().int().positive().optional(),
    boundaryEnd: z.number().int().positive().optional(),
    team: z.string().optional(),
    position: z.string().optional(),
    windowStart: IsoDateSchema.optional(),
    windowEnd: IsoDateSchema.optional(),
    selectedDropPlayerId: z.string().optional(),
    discoveredAt: TimestampSchema,
  }).optional(),
  preference: z.object({
    watched: z.boolean().default(false),
    dismissed: z.boolean().default(false),
    excluded: z.boolean().default(false),
    updatedAt: TimestampSchema,
  }).optional(),
  confidence: z.number().min(0).max(1).optional(),
  observedAt: TimestampSchema,
  expiresAt: TimestampSchema,
});

export const LeagueWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fantasyTeam: z.object({
    name: z.string().max(60).default(''),
    logoDataUrl: z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,/).max(500_000).nullable().default(null),
  }).default({ name: '', logoDataUrl: null }),
  platform: z.enum(['manual', 'yahoo', 'fantrax', 'espn', 'other']),
  providerLeagueId: z.string().optional(),
  numberOfTeams: z.number().int().min(2).max(32).default(12),
  season: z.object({
    id: z.string(),
    label: z.string(),
    start: IsoDateSchema,
    end: IsoDateSchema,
    source: z.enum(['site-config', 'provider', 'manual']),
  }),
  format: z.literal('points'),
  source: z.object({
    kind: z.enum(['default', 'manual', 'legacy-coach', 'import', 'provider']),
    label: z.string(),
  }),
  scoring: z.object({
    presetId: z.enum(['default', 'kkupfl', 'apl', 'yahoo', 'espn', 'chesterfield', 'custom']),
    label: z.string(),
    skater: WeightMapSchema,
    goalie: WeightMapSchema,
    updatedAt: TimestampSchema,
  }),
  rosterRules: z.object({
    slots: z.record(z.string(), z.number().int().min(0)),
    lockingMode: z.enum(['daily', 'weekly']),
    /** Injury statuses the league lets you place in IR slots (Yahoo codes). Unset = IR and IR-LT. */
    irEligibleStatuses: z.array(z.string()).optional(),
  }),
  schedule: z.object({
    timezone: z.string(),
    matchupWeekStart: z.enum(['monday', 'saturday', 'sunday']),
    defaultWindow: z.object({
      preset: z.enum(['rest-of-week', '7d', '14d', '30d', 'rest-of-season', 'season', 'custom']),
      start: IsoDateSchema.optional(),
      end: IsoDateSchema.optional(),
    }),
    playoffs: z.object({
      start: IsoDateSchema,
      end: IsoDateSchema,
    }).refine((range) => range.start <= range.end, { message: 'Playoff end date must be on or after the start date.' }),
  }),
  analysis: z.object({
    defaultDailySlots: z.number().int().min(1).max(20),
  }),
  draftStrategy: z.object({
    presetId: z.enum(['balanced', 'playoff-edge', 'make-playoffs', 'stars-streamers', 'schedule-maximizer', 'custom']),
    weights: DraftStrategyWeightsSchema,
  }).default({ presetId: 'balanced', weights: DRAFT_STRATEGY_PRESETS.balanced.weights }),
  projections: z.object({
    activeSourceId: z.string().nullable(),
    consensusSourceIds: z.array(z.string()).default(['cracked-ice']),
    sources: z.array(ProjectionSourceSchema).max(8),
  }).default({ activeSourceId: null, consensusSourceIds: ['cracked-ice'], sources: [] }),
  keeperRules: z.object({
    maximumKeepers: z.number().int().min(0).max(50).nullable(),
    horizon: z.enum(['next-season', 'two-to-three-years']),
    costSystem: z.enum(['none', 'draft-round', 'salary']),
  }).default({ maximumKeepers: null, horizon: 'next-season', costSystem: 'none' }),
  draftSession: z.object({
    mode: z.enum(['planner', 'live']).default('planner'),
    status: z.enum(['setup', 'live', 'complete']),
    draftPosition: z.number().int().min(1).max(32).nullable(),
    orderType: z.enum(['snake', 'linear', 'balanced']).default('snake'),
    startDate: IsoDateSchema.nullable().default(null),
    pickClockHours: z.number().int().min(1).max(24).nullable().default(null),
    marketSource: z.enum(['yahoo', 'kkupfl']).default('yahoo'),
    opponentModel: z.enum(['yahoo-variance']).default('yahoo-variance'),
    simulationSeed: z.number().int().min(1).default(1),
    teamNames: z.record(z.string(), z.string().max(60)).default({}),
    picks: z.array(DraftPickSchema),
    targets: z.array(DraftTargetSchema),
    unavailablePlayerIds: z.array(z.string().min(1)).default([]),
    keeperPickAssignments: z.array(z.object({
      playerId: z.string().min(1),
      overallPick: z.number().int().min(1).max(1000),
    })).default([]),
    rankAdjustments: z.record(z.string(), z.number().min(-20).max(20)).default({}),
    sync: z.object({
      mode: z.enum(['manual', 'provider']),
      status: z.enum(['idle', 'synced', 'error']),
      provider: z.enum(['yahoo']).optional(),
      lastAttemptAt: TimestampSchema,
      lastSyncedAt: TimestampSchema,
      lastError: z.string().optional(),
      cursor: z.string().optional(),
    }),
  }).default({
    mode: 'planner',
    status: 'setup',
    draftPosition: null,
    orderType: 'snake',
    startDate: null,
    pickClockHours: null,
    marketSource: 'yahoo',
    opponentModel: 'yahoo-variance',
    simulationSeed: 1,
    teamNames: {},
    picks: [],
    targets: [],
    unavailablePlayerIds: [],
    keeperPickAssignments: [],
    rankAdjustments: {},
    sync: { mode: 'manual', status: 'idle' },
  }),
  acquisitions: z.object({
    limit: z.number().int().min(0).nullable(),
    period: z.enum(['week', 'matchup', 'season']),
    movesUsed: z.number().int().min(0).nullable(),
    addTiming: z.enum(['same-day', 'next-day']).default('same-day'),
    waiverDelayDays: z.number().int().min(0).max(7).default(0),
    /**
     * How an unowned player is picked up: 'free-agent' (only recently dropped players
     * sit on waivers) or 'waivers' (every add is a waiver claim). Unset = free agent.
     */
    pickupMethod: z.enum(['free-agent', 'waivers']).optional(),
    observedAt: TimestampSchema,
  }),
  rosterReadinessConfirmation: z.object({
    revision: z.string().min(1),
    confirmedAt: z.string().datetime(),
  }).optional(),
  roster: z.array(LeagueWorkspaceRosterEntrySchema),
  candidates: z.array(LeagueCandidateSchema),
  freshness: z.object({
    sourceSeason: z.string(),
    generatedAt: TimestampSchema,
    importedAt: TimestampSchema,
    syncedAt: TimestampSchema,
    lastError: z.string().optional(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const LeagueWorkspaceStoreSchema = z.object({
  version: z.literal(LEAGUE_WORKSPACE_VERSION),
  migrations: z.array(z.string()).default([]),
  activeLeagueId: z.string(),
  leagues: z.array(LeagueWorkspaceSchema).min(1),
}).superRefine((store, context) => {
  const ids = new Set<string>();
  store.leagues.forEach((league, index) => {
    if (ids.has(league.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['leagues', index, 'id'], message: 'League IDs must be unique.' });
    }
    ids.add(league.id);
  });
  if (!ids.has(store.activeLeagueId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['activeLeagueId'], message: 'The active league must exist in the workspace.' });
  }
});

export type LeagueWorkspace = z.infer<typeof LeagueWorkspaceSchema>;
export type LeagueWorkspaceStore = z.infer<typeof LeagueWorkspaceStoreSchema>;
export type LeagueWorkspaceRosterEntry = z.infer<typeof LeagueWorkspaceRosterEntrySchema>;
export type LeagueCandidate = z.infer<typeof LeagueCandidateSchema>;

const DEFAULT_SLOTS: Record<string, number> = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
  G: 2,
  BN: 4,
  IR: 1,
  'IR+': 1,
};

export function createLeagueId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `league-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultLeagueWorkspace(options: {
  id?: string;
  name?: string;
  timezone?: string;
  now?: string;
} = {}): LeagueWorkspace {
  const now = options.now ?? new Date().toISOString();
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const preset = SCORING_PRESETS.default;
  return LeagueWorkspaceSchema.parse({
    id: options.id ?? createLeagueId(),
    name: options.name ?? 'My League',
    fantasyTeam: { name: '', logoDataUrl: null },
    platform: 'manual',
    numberOfTeams: 12,
    season: {
      id: SEASON.seasonId,
      label: SEASON.label,
      start: SEASON.regularSeasonStart,
      end: SEASON.regularSeasonEnd,
      source: 'site-config',
    },
    format: 'points',
    source: { kind: 'default', label: 'Created on this device' },
    scoring: {
      presetId: 'default',
      label: preset.label,
      skater: preset.skater,
      goalie: preset.goalie,
      updatedAt: now,
    },
    rosterRules: { slots: DEFAULT_SLOTS, lockingMode: 'daily' },
    schedule: {
      timezone,
      matchupWeekStart: 'monday',
      defaultWindow: { preset: 'rest-of-season' },
      playoffs: { ...YAHOO_DEFAULT_PLAYOFFS },
    },
    analysis: { defaultDailySlots: 2 },
    draftStrategy: { presetId: 'balanced', weights: presetDraftStrategy('balanced') },
    projections: { activeSourceId: null, consensusSourceIds: ['cracked-ice'], sources: [] },
    keeperRules: { maximumKeepers: null, horizon: 'next-season', costSystem: 'none' },
    draftSession: { mode: 'planner', status: 'setup', draftPosition: null, orderType: 'snake', startDate: null, pickClockHours: null, marketSource: 'yahoo', opponentModel: 'yahoo-variance', simulationSeed: 1, teamNames: {}, picks: [], targets: [], unavailablePlayerIds: [], keeperPickAssignments: [], rankAdjustments: {}, sync: { mode: 'manual', status: 'idle' } },
    acquisitions: { limit: null, period: 'week', movesUsed: null, addTiming: 'same-day', waiverDelayDays: 0 },
    roster: [],
    candidates: [],
    freshness: { sourceSeason: SEASON.seasonId },
    createdAt: now,
    updatedAt: now,
  });
}

function presetDraftStrategy(presetId: keyof typeof DRAFT_STRATEGY_PRESETS) {
  return { ...DRAFT_STRATEGY_PRESETS[presetId].weights };
}

export function createDefaultLeagueStore(options: Parameters<typeof createDefaultLeagueWorkspace>[0] = {}): LeagueWorkspaceStore {
  const league = createDefaultLeagueWorkspace(options);
  return {
    version: LEAGUE_WORKSPACE_VERSION,
    migrations: [PLAYOFF_DEFAULT_MIGRATION, SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION, DRAFT_TARGET_PICK_MIGRATION, KKUPFL_2026_27_PRESET_MIGRATION, CANDIDATE_EVIDENCE_MIGRATION],
    activeLeagueId: league.id,
    leagues: [league],
  };
}

export function migrateLeagueWorkspaceStore(input: unknown): LeagueWorkspaceStore {
  const versioned = z.object({ version: z.number().int() }).passthrough().parse(input);
  if (versioned.version < 1 || versioned.version > LEAGUE_WORKSPACE_VERSION) {
    throw new Error(`Unsupported league workspace version: ${versioned.version}`);
  }
  const parsed = LeagueWorkspaceStoreSchema.parse({ ...versioned, version: LEAGUE_WORKSPACE_VERSION });
  const migratePlayoffDefault = !parsed.migrations.includes(PLAYOFF_DEFAULT_MIGRATION);
  const retireScheduleMaximizer = !parsed.migrations.includes(SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION);
  const rebuildTargetPicks = !parsed.migrations.includes(DRAFT_TARGET_PICK_MIGRATION);
  const correctKkupflPreset = !parsed.migrations.includes(KKUPFL_2026_27_PRESET_MIGRATION);
  const migrateCandidateEvidence = !parsed.migrations.includes(CANDIDATE_EVIDENCE_MIGRATION);
  if (!migratePlayoffDefault && !retireScheduleMaximizer && !rebuildTargetPicks && !correctKkupflPreset && !migrateCandidateEvidence) return parsed;

  return LeagueWorkspaceStoreSchema.parse({
    ...parsed,
    migrations: [
      ...parsed.migrations,
      ...(migratePlayoffDefault ? [PLAYOFF_DEFAULT_MIGRATION] : []),
      ...(retireScheduleMaximizer ? [SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION] : []),
      ...(rebuildTargetPicks ? [DRAFT_TARGET_PICK_MIGRATION] : []),
      ...(correctKkupflPreset ? [KKUPFL_2026_27_PRESET_MIGRATION] : []),
      ...(migrateCandidateEvidence ? [CANDIDATE_EVIDENCE_MIGRATION] : []),
    ],
    leagues: parsed.leagues.map((league) => {
      const hasLegacyDefault = migratePlayoffDefault && league.season.id === SEASON.seasonId && (
        (league.schedule.playoffs.start === '2027-03-01' && league.schedule.playoffs.end === '2027-03-21')
        || (league.schedule.playoffs.start === '2027-03-01' && league.schedule.playoffs.end === SEASON.regularSeasonEnd)
      );
      const migratedLeague = hasLegacyDefault
        ? { ...league, schedule: { ...league.schedule, playoffs: { ...YAHOO_DEFAULT_PLAYOFFS } } }
        : league;
      const strategyMigratedLeague = retireScheduleMaximizer && migratedLeague.draftStrategy.presetId === 'schedule-maximizer'
        ? { ...migratedLeague, draftStrategy: { presetId: 'balanced' as const, weights: { ...DRAFT_STRATEGY_PRESETS.balanced.weights } } }
        : migratedLeague;
      const kkupflMigratedLeague = correctKkupflPreset && strategyMigratedLeague.scoring.presetId === 'kkupfl'
        ? applyScoringPreset(strategyMigratedLeague, 'kkupfl', strategyMigratedLeague.updatedAt)
        : strategyMigratedLeague;
      const evidenceMigratedLeague = migrateCandidateEvidence
        ? {
            ...kkupflMigratedLeague,
            candidates: kkupflMigratedLeague.candidates.map((candidate) => ({
              ...candidate,
              status: candidate.status ?? (candidate.availability === 'unknown' ? 'unknown' as const : 'available' as const),
              evidence: candidate.evidence ?? {
                source: candidate.availability === 'unknown' ? 'none' as const : candidate.availability,
                observedAt: candidate.observedAt,
                expiresAt: candidate.expiresAt,
                confidence: candidate.confidence,
              },
            })),
          }
        : kkupflMigratedLeague;
      if (!rebuildTargetPicks || evidenceMigratedLeague.draftSession.draftPosition === null) return evidenceMigratedLeague;
      const { draftPosition, orderType } = evidenceMigratedLeague.draftSession;
      const targets = evidenceMigratedLeague.draftSession.targets.map((target) => {
        if (target.targetRound === null || target.targetOverallPick !== null) return target;
        const forwardSlot = (target.targetRound - 1) * evidenceMigratedLeague.numberOfTeams + draftPosition;
        const reverseSlot = target.targetRound * evidenceMigratedLeague.numberOfTeams - draftPosition + 1;
        const reversed = (orderType === 'snake' && target.targetRound % 2 === 0)
          || (orderType === 'balanced' && target.targetRound > 1);
        return {
          ...target,
          targetOverallPick: reversed ? reverseSlot : forwardSlot,
        };
      });
      return { ...evidenceMigratedLeague, draftSession: { ...evidenceMigratedLeague.draftSession, targets } };
    }),
  });
}

export function applyScoringPreset(workspace: LeagueWorkspace, presetId: Exclude<ScoringPresetId, 'custom'>, now = new Date().toISOString()): LeagueWorkspace {
  const preset = SCORING_PRESETS[presetId];
  const isKkupfl = presetId === 'kkupfl';
  return {
    ...workspace,
    numberOfTeams: preset.numberOfTeams,
    scoring: { presetId, label: preset.label, skater: { ...preset.skater }, goalie: { ...preset.goalie }, updatedAt: now },
    rosterRules: { ...workspace.rosterRules, slots: { ...preset.slots }, ...(isKkupfl ? { lockingMode: 'daily' as const, irEligibleStatuses: [...KKUPFL_IR_ELIGIBLE_STATUSES] } : {}) },
    schedule: isKkupfl
      ? { ...workspace.schedule, matchupWeekStart: 'monday', playoffs: { ...KKUPFL_PLAYOFFS } }
      : presetId === 'yahoo'
      ? { ...workspace.schedule, playoffs: { ...YAHOO_DEFAULT_PLAYOFFS } }
      : workspace.schedule,
    draftSession: isKkupfl ? {
      ...workspace.draftSession,
      orderType: 'balanced',
      startDate: KKUPFL_DRAFT_DATES.draftStart,
      pickClockHours: 8,
      marketSource: 'kkupfl',
    } : { ...workspace.draftSession, marketSource: 'yahoo' },
    acquisitions: isKkupfl ? {
      ...workspace.acquisitions,
      limit: 4,
      period: 'week',
      addTiming: 'same-day',
      waiverDelayDays: 1,
      pickupMethod: 'free-agent',
    } : workspace.acquisitions,
    updatedAt: now,
  };
}

export function applyDraftStrategyPreset(
  workspace: LeagueWorkspace,
  presetId: Exclude<DraftStrategyPresetId, 'custom'>,
  now = new Date().toISOString(),
): LeagueWorkspace {
  return {
    ...workspace,
    draftStrategy: { presetId, weights: presetDraftStrategy(presetId) },
    updatedAt: now,
  };
}

export function rosterEntriesFromLegacy(roster: RosterPlayer[]): LeagueWorkspaceRosterEntry[] {
  return roster.map((player) => ({
    playerId: player.id,
    fullName: player.full_name,
    team: player.team,
    positions: player.positions,
    slot: player.current_slot,
    keeper: false,
    protected: false,
    undroppable: false,
  }));
}

export function mergeLegacyLeagueProfile(
  workspace: LeagueWorkspace,
  profile: LeagueProfile,
  roster: RosterPlayer[] = [],
  now = new Date().toISOString(),
): LeagueWorkspace {
  const hasCustomWeights = Boolean(Object.keys(profile.skater_scoring ?? profile.scoring_weights ?? {}).length || Object.keys(profile.goalie_scoring ?? {}).length);
  const validSeasonDate = (value: string | undefined) => value && value >= workspace.season.start && value <= workspace.season.end ? value : undefined;
  return LeagueWorkspaceSchema.parse({
    ...workspace,
    name: profile.league_name || workspace.name,
    numberOfTeams: profile.num_teams && profile.num_teams >= 2 && profile.num_teams <= 32
      ? Math.round(profile.num_teams)
      : workspace.numberOfTeams,
    source: { kind: 'legacy-coach', label: 'Migrated from the existing roster workspace' },
    scoring: hasCustomWeights ? {
      presetId: 'custom',
      label: profile.preset_name || 'Migrated custom scoring',
      skater: profile.skater_scoring ?? profile.scoring_weights ?? workspace.scoring.skater,
      goalie: profile.goalie_scoring ?? workspace.scoring.goalie,
      updatedAt: now,
    } : workspace.scoring,
    rosterRules: { ...workspace.rosterRules, slots: { ...workspace.rosterRules.slots, ...profile.lineup_slots } },
    schedule: {
      ...workspace.schedule,
      playoffs: {
        start: validSeasonDate(profile.playoff_start_date) || workspace.schedule.playoffs.start,
        end: validSeasonDate(profile.playoff_end_date) || workspace.schedule.playoffs.end,
      },
    },
    roster: roster.length ? rosterEntriesFromLegacy(roster) : workspace.roster,
    freshness: { ...workspace.freshness, importedAt: now },
    updatedAt: now,
  });
}

export function toLeagueProfile(workspace: LeagueWorkspace): LeagueProfile {
  return {
    league_name: workspace.name,
    scoring_type: 'points',
    preset_name: workspace.scoring.presetId === 'custom' ? workspace.scoring.label : workspace.scoring.label,
    platform: workspace.platform,
    num_teams: workspace.numberOfTeams,
    lineup_slots: workspace.rosterRules.slots,
    locking_mode: workspace.rosterRules.lockingMode,
    skater_scoring: workspace.scoring.skater,
    goalie_scoring: workspace.scoring.goalie,
    playoff_start_date: workspace.schedule.playoffs.start,
    playoff_end_date: workspace.schedule.playoffs.end,
  };
}

export function activeLeagueFromStore(store: LeagueWorkspaceStore): LeagueWorkspace {
  return store.leagues.find((league) => league.id === store.activeLeagueId) ?? store.leagues[0];
}

export function upsertLeagueCandidates(
  existing: LeagueCandidate[],
  additions: LeagueCandidate[],
): LeagueCandidate[] {
  const candidates = new Map(existing.map((candidate) => [candidate.playerId.replace(/^nhl:/, ''), candidate]));
  additions.forEach((candidate) => {
    const key = candidate.playerId.replace(/^nhl:/, '');
    const current = candidates.get(key);
    const currentObservedAt = current?.observedAt ?? '';
    const nextObservedAt = candidate.observedAt ?? '';
    if (!current || nextObservedAt >= currentObservedAt) {
      candidates.set(key, {
        ...current,
        ...candidate,
        evidence: candidate.evidence ?? current?.evidence,
        discovery: candidate.discovery ?? current?.discovery,
        preference: candidate.preference ?? current?.preference,
      });
    }
  });
  return [...candidates.values()].sort((a, b) => (b.observedAt ?? '').localeCompare(a.observedAt ?? ''));
}

export function createLeagueCandidateObservation(
  playerId: string,
  availability: LeagueCandidate['availability'],
  now = new Date().toISOString(),
  ttlHours = 24,
): LeagueCandidate {
  return {
    playerId,
    availability,
    status: availability === 'unknown' ? 'unknown' : 'available',
    evidence: {
      source: availability === 'unknown' ? 'none' : availability,
      observedAt: now,
      expiresAt: new Date(new Date(now).getTime() + ttlHours * 3_600_000).toISOString(),
      confidence: 1,
    },
    confidence: 1,
    observedAt: now,
    expiresAt: new Date(new Date(now).getTime() + ttlHours * 3_600_000).toISOString(),
  };
}

export function createLeagueCandidateTarget(
  playerId: string,
  discovery: NonNullable<LeagueCandidate['discovery']>,
): LeagueCandidate {
  return {
    playerId,
    availability: 'unknown',
    status: 'unknown',
    discovery,
    preference: { watched: false, dismissed: false, excluded: false, updatedAt: discovery.discoveredAt },
  };
}

export function recordLeagueCandidateStatus(
  candidate: LeagueCandidate,
  status: 'available' | 'taken',
  now = new Date().toISOString(),
  ttlHours = 24,
): LeagueCandidate {
  const expiresAt = new Date(new Date(now).getTime() + ttlHours * 3_600_000).toISOString();
  return {
    ...candidate,
    availability: 'user-confirmed',
    status,
    confidence: 1,
    observedAt: now,
    expiresAt,
    evidence: { source: 'user-confirmed', observedAt: now, expiresAt, confidence: 1 },
  };
}

export function updateLeagueCandidatePreference(
  candidate: LeagueCandidate,
  preference: Partial<Pick<NonNullable<LeagueCandidate['preference']>, 'watched' | 'dismissed' | 'excluded'>>,
  now = new Date().toISOString(),
): LeagueCandidate {
  return {
    ...candidate,
    preference: {
      watched: candidate.preference?.watched ?? false,
      dismissed: candidate.preference?.dismissed ?? false,
      excluded: candidate.preference?.excluded ?? false,
      ...preference,
      updatedAt: now,
    },
  };
}

export function isLeagueCandidateObservationCurrent(candidate: LeagueCandidate, now = Date.now()): boolean {
  const expiresAt = candidate.evidence?.expiresAt ?? candidate.expiresAt;
  return Boolean(expiresAt) && new Date(expiresAt as string).getTime() > now;
}

export function isLeagueCandidateCurrent(candidate: LeagueCandidate, now = Date.now()): boolean {
  const status = candidate.status ?? (candidate.availability === 'unknown' ? 'unknown' : 'available');
  return status === 'available' && isLeagueCandidateObservationCurrent(candidate, now);
}

const WEEKDAY_INDEX: Record<LeagueWorkspace['schedule']['matchupWeekStart'], number> = { sunday: 0, monday: 1, saturday: 6 };

function localDate(timestamp: string | number | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** First local date of the acquisition period containing `now` (the matchup week, or the season). */
export function acquisitionPeriodStart(workspace: LeagueWorkspace, now: string | number | Date = Date.now()): string {
  if (workspace.acquisitions.period === 'season') return workspace.season.start;
  const today = localDate(now, workspace.schedule.timezone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const back = (weekday - WEEKDAY_INDEX[workspace.schedule.matchupWeekStart] + 7) % 7;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - back);
  return start.toISOString().slice(0, 10);
}

export function irEligibleStatuses(workspace: LeagueWorkspace): string[] {
  if (workspace.rosterRules.irEligibleStatuses) return workspace.rosterRules.irEligibleStatuses;
  // KKUPFL leagues saved before this setting existed still follow the league's IR+ rule.
  return workspace.scoring.presetId === 'kkupfl' ? [...KKUPFL_IR_ELIGIBLE_STATUSES] : [...DEFAULT_IR_ELIGIBLE_STATUSES];
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export interface PlanningWeek {
  /** League-local today. */
  today: string;
  /** First and last day of the matchup week being planned (clipped to the season). */
  start: string;
  end: string;
  /** First day a move can still affect: today, or the week's first day when planning ahead. */
  firstPlanDate: string;
  /** The following matchup week, where the last add in each spot carries over. */
  nextStart: string;
  nextEnd: string;
}

/**
 * The matchup week to plan: the current one, or the first week of the season when
 * the season has not started (a season can open mid-week, e.g. a Tuesday).
 */
export function planningWeek(workspace: LeagueWorkspace, now: string | number | Date = Date.now()): PlanningWeek {
  const today = localDate(now, workspace.schedule.timezone);
  const anchor = [[today, workspace.season.start].sort()[1], workspace.season.end].sort()[0];
  const weekday = new Date(`${anchor}T00:00:00Z`).getUTCDay();
  const weekStart = shiftDate(anchor, -((weekday - WEEKDAY_INDEX[workspace.schedule.matchupWeekStart] + 7) % 7));
  const start = [weekStart, workspace.season.start].sort()[1];
  const end = [shiftDate(weekStart, 6), workspace.season.end].sort()[0];
  return {
    today,
    start,
    end,
    firstPlanDate: [today, start].sort()[1],
    nextStart: shiftDate(weekStart, 7),
    nextEnd: [shiftDate(weekStart, 13), workspace.season.end].sort()[0],
  };
}

/**
 * Adds already used in the current period. A count entered during an earlier week
 * no longer applies (weekly limits reset), and an unset count means none used yet.
 */
export function movesUsedThisPeriod(workspace: LeagueWorkspace, now: string | number | Date = Date.now()): number {
  const { movesUsed, observedAt, period } = workspace.acquisitions;
  if (movesUsed === null) return 0;
  if (period === 'season' || !observedAt) return movesUsed;
  return localDate(observedAt, workspace.schedule.timezone) >= acquisitionPeriodStart(workspace, now) ? movesUsed : 0;
}

/** Adds left in the current period, or null when the league has no limit. */
export function acquisitionMovesRemaining(workspace: LeagueWorkspace, now: string | number | Date = Date.now()): number | null {
  if (workspace.acquisitions.limit === null) return null;
  return Math.max(0, workspace.acquisitions.limit - movesUsedThisPeriod(workspace, now));
}

/**
 * Candidate list with one player marked available (for 24 hours) or taken (until
 * changed), adding him as a manual candidate first when he is not on the list yet.
 */
/** "Not interested": keep a player out of pickup suggestions (or bring him back) without saying he's taken. */
export function setCandidateDismissed(
  candidates: LeagueCandidate[],
  player: { id: string; team?: string; position?: string },
  dismissed: boolean,
  now = new Date().toISOString(),
): LeagueCandidate[] {
  const id = player.id.replace(/^nhl:/, '');
  const existing = candidates.find((candidate) => candidate.playerId.replace(/^nhl:/, '') === id);
  const base = existing ?? createLeagueCandidateTarget(player.id, { source: 'manual-search', team: player.team, position: player.position, discoveredAt: now });
  const updated = updateLeagueCandidatePreference(base, { dismissed }, now);
  return existing
    ? candidates.map((candidate) => (candidate === existing ? updated : candidate))
    : upsertLeagueCandidates(candidates, [updated]);
}

export function setCandidateAvailability(
  candidates: LeagueCandidate[],
  player: { id: string; team?: string; position?: string },
  status: 'available' | 'taken',
  now = new Date().toISOString(),
): LeagueCandidate[] {
  const id = player.id.replace(/^nhl:/, '');
  const existing = candidates.find((candidate) => candidate.playerId.replace(/^nhl:/, '') === id);
  const base = existing ?? createLeagueCandidateTarget(player.id, { source: 'manual-search', team: player.team, position: player.position, discoveredAt: now });
  return upsertLeagueCandidates(candidates, [recordLeagueCandidateStatus(base, status, now)]);
}
