import { z } from 'zod';
import type { LeagueProfile, RosterPlayer } from './coachSchemas';
import { SEASON, SEASON_GAMES_PER_TEAM } from './season';
import scoringPresets from '../../../config/scoring-presets.json';

export const LEAGUE_WORKSPACE_VERSION = 1 as const;
export const YAHOO_DEFAULT_PLAYOFFS = {
  start: SEASON.defaultFantasyPlayoffsStart,
  end: SEASON.defaultFantasyPlayoffsEnd,
} as const;
export const EARLY_FINISH_PLAYOFFS = {
  start: '2027-03-15',
  end: '2027-04-04',
} as const;
export const PLAYOFF_DEFAULT_MIGRATION = '2026-27-yahoo-calendar-correction' as const;
export const SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION = '2026-27-retire-schedule-maximizer' as const;

export const SCORING_PRESETS = scoringPresets;

export type ScoringPresetId = keyof typeof SCORING_PRESETS | 'custom';

export const DRAFT_STRATEGY_PRESETS = {
  balanced: { label: 'Balanced', description: 'Standardized projected production leads; schedules and positional value break close calls.', weights: { production: 55, regularSeason: 20, playoffs: 15, positionValue: 10 } },
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
});

export const LeagueCandidateSchema = z.object({
  playerId: z.string().min(1),
  availability: z.enum(['live-provider', 'screenshot-confirmed', 'user-confirmed', 'imported-snapshot', 'unknown']),
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
    mode: z.enum(['planner', 'live']).default('live'),
    status: z.enum(['setup', 'live', 'complete']),
    draftPosition: z.number().int().min(1).max(32).nullable(),
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
    mode: 'live',
    status: 'setup',
    draftPosition: null,
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
    observedAt: TimestampSchema,
  }),
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
    draftSession: { mode: 'planner', status: 'setup', draftPosition: null, opponentModel: 'yahoo-variance', simulationSeed: 1, teamNames: {}, picks: [], targets: [], unavailablePlayerIds: [], keeperPickAssignments: [], rankAdjustments: {}, sync: { mode: 'manual', status: 'idle' } },
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
    migrations: [PLAYOFF_DEFAULT_MIGRATION, SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION],
    activeLeagueId: league.id,
    leagues: [league],
  };
}

export function migrateLeagueWorkspaceStore(input: unknown): LeagueWorkspaceStore {
  const parsed = LeagueWorkspaceStoreSchema.parse(input);
  const migratePlayoffDefault = !parsed.migrations.includes(PLAYOFF_DEFAULT_MIGRATION);
  const retireScheduleMaximizer = !parsed.migrations.includes(SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION);
  if (!migratePlayoffDefault && !retireScheduleMaximizer) return parsed;

  return LeagueWorkspaceStoreSchema.parse({
    ...parsed,
    migrations: [
      ...parsed.migrations,
      ...(migratePlayoffDefault ? [PLAYOFF_DEFAULT_MIGRATION] : []),
      ...(retireScheduleMaximizer ? [SCHEDULE_MAXIMIZER_RETIREMENT_MIGRATION] : []),
    ],
    leagues: parsed.leagues.map((league) => {
      const hasLegacyDefault = migratePlayoffDefault && league.season.id === SEASON.seasonId && (
        (league.schedule.playoffs.start === '2027-03-01' && league.schedule.playoffs.end === '2027-03-21')
        || (league.schedule.playoffs.start === '2027-03-01' && league.schedule.playoffs.end === SEASON.regularSeasonEnd)
      );
      const migratedLeague = hasLegacyDefault
        ? { ...league, schedule: { ...league.schedule, playoffs: { ...YAHOO_DEFAULT_PLAYOFFS } } }
        : league;
      return retireScheduleMaximizer && migratedLeague.draftStrategy.presetId === 'schedule-maximizer'
        ? { ...migratedLeague, draftStrategy: { presetId: 'balanced' as const, weights: { ...DRAFT_STRATEGY_PRESETS.balanced.weights } } }
        : migratedLeague;
    }),
  });
}

export function applyScoringPreset(workspace: LeagueWorkspace, presetId: Exclude<ScoringPresetId, 'custom'>, now = new Date().toISOString()): LeagueWorkspace {
  const preset = SCORING_PRESETS[presetId];
  return {
    ...workspace,
    numberOfTeams: preset.numberOfTeams,
    scoring: { presetId, label: preset.label, skater: { ...preset.skater }, goalie: { ...preset.goalie }, updatedAt: now },
    rosterRules: { ...workspace.rosterRules, slots: { ...preset.slots } },
    schedule: presetId === 'yahoo'
      ? { ...workspace.schedule, playoffs: { ...YAHOO_DEFAULT_PLAYOFFS } }
      : workspace.schedule,
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
    if (!current || nextObservedAt >= currentObservedAt) candidates.set(key, candidate);
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
    confidence: 1,
    observedAt: now,
    expiresAt: new Date(new Date(now).getTime() + ttlHours * 3_600_000).toISOString(),
  };
}

export function isLeagueCandidateCurrent(candidate: LeagueCandidate, now = Date.now()): boolean {
  return Boolean(candidate.expiresAt) && new Date(candidate.expiresAt as string).getTime() > now;
}
