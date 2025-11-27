import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import multer from 'multer';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { DATA_CACHE_DIR, CACHE_FILES, MANIFEST_PATH, describeCacheFile } from '../../../apps/api/src/config/cachePaths';
import {
  CoachRequestSchema,
  CoachResponse,
  PlayerProjection,
  Recommendation,
  UserContextSchema,
  LeagueSettingsSchema,
  RosterUploadSchema,
  FreeAgentsUploadSchema,
  Player,
  FreeAgent,
  LeagueProfile,
  NormalizedLeagueProfile
} from '../features/coach/types';
import {
  generateCoachRecommendations,
  mergeUpcomingGames
} from '../features/coach';
import { getPresetByName } from '../features/coach/presets';
import {
  loadUserContext,
  writeUserSettings,
  writeUserRoster,
  writeUserFreeAgents,
  writeUserSnapshot,
  getUserStatus
} from '../features/coach/data-loader';
import type { LoadedUserContext } from '../features/coach/data-loader';
import { REQUIRED_ENV } from '../features/coach/constants';
import type { ScheduleContext } from '../context/schedules';
import { getTeamScheduleDates } from '../context/schedules';
import type { StatsContext, PlayerStatsSnapshot } from '../context/stats';
import type { TeamStatsContext } from '../context/teamStats';
import { buildProjection, calculatePlayerFppg, computeWindowFppg } from '../features/coach/scoring';
import { simulateLineup, buildDateRange } from '../features/coach/simulation';
import {
  parseLeagueSettingsScreenshot,
  parseRosterScreenshot,
  parseFreeAgentsScreenshot,
  OcrProviderError,
  OcrNotConfiguredError
} from '../services/ocr';
import { searchPlayers, type PlayersContext } from '../context/players';

export const coachRoutes = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const LEGACY_BADGE_MAP: Record<string, string> = {
  'off-night boost': 'Cyan',
  'ceiling play': 'Blue',
  'volume stream': 'Green',
  steady: 'Red'
};

const USER_ID_PATTERN = /^[a-z0-9\-_.]{3,64}$/i;


type CacheFileSummary = ReturnType<typeof describeCacheFile>;

interface DataCacheMeta {
  loaded: boolean;
  version: string | null;
  generatedAt: string | null;
  sourcePaths: string[];
  files: Record<string, CacheFileSummary>;
}


function loadDataCacheManifest(): DataCacheMeta {
  let manifest: { version?: string; generatedAt?: string } | null = null;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    manifest = null;
  }

  const files = Object.fromEntries(
    Object.entries(CACHE_FILES).map(([key, path]) => [key, describeCacheFile(path)])
  );

  // If manifest doesn't exist, try to get generatedAt from stats.json
  let generatedAt = manifest?.generatedAt ?? null;
  if (!generatedAt && files.stats?.exists) {
    try {
      const statsContent = JSON.parse(readFileSync(files.stats.path, 'utf8'));
      generatedAt = statsContent.generatedAt ?? null;
    } catch {
      // Ignore errors reading stats file
    }
  }

  return {
    loaded: Boolean(manifest),
    version: manifest?.version ?? null,
    generatedAt,
    sourcePaths: [DATA_CACHE_DIR],
    files
  };
}


const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date');

const ConflictQuerySchema = z.object({
  start: IsoDateSchema,
  end: IsoDateSchema
}).refine((data) => data.start <= data.end, {
  message: 'start must be before or equal to end',
  path: ['end']
});

const ProjectionRosterEntrySchema = z.object({
  playerId: z.string(),
  slot: z.string().optional()
});

const ProjectionRequestSchema = z.object({
  league: z.unknown().optional(),
  league_profile: z.unknown().optional(),
  window: ConflictQuerySchema,
  roster: z.array(ProjectionRosterEntrySchema).default([])
});

const DEFAULT_LINEUP_FALLBACK: Record<string, number> = {
  C: 2,
  LW: 2,
  RW: 2,
  D: 4,
  G: 2,
  BN: 4,
  IR: 1
};

interface NormalizeLeagueProfileResult {
  profile: NormalizedLeagueProfile;
  weightsSource: string;
}

export function toNumericId(id: string): string {
  if (typeof id !== 'string') {
    return '';
  }
  return id.replace(/^nhl:/i, '').trim();
}

export function splitPositions(position: string | string[] | undefined): string[] {
  if (!position) {
    return [];
  }
  const raw = Array.isArray(position) ? position : position.split(/[\/\s,]+/);
  return raw
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .map((value) => {
      if (value === 'L') return 'LW';
      if (value === 'R') return 'RW';
      return value;
    });
}

function normalizeNumberRecord(source: Record<string, unknown> | null | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  if (!source) {
    return result;
  }
  for (const [key, value] of Object.entries(source)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      result[key] = numeric;
    }
  }
  return result;
}

function mergeLineupSlots(
  presetSlots?: Record<string, number> | null,
  fallbackSlots?: Record<string, number> | null,
  overrideSlots?: Record<string, number> | null
): Record<string, number> {
  const result: Record<string, number> = {};
  const apply = (source?: Record<string, number> | null) => {
    if (!source) return;
    for (const [key, value] of Object.entries(source)) {
      if (value == null) continue;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) continue;
      const normalizedKey = key.toUpperCase();
      result[normalizedKey] = numeric;
    }
  };

  apply(presetSlots);
  apply(fallbackSlots);
  apply(overrideSlots);

  if (!Object.keys(result).length) {
    apply(DEFAULT_LINEUP_FALLBACK);
  }

  return result;
}

function normaliseScoringType(input: unknown): 'points' | 'categories' {
  return input === 'categories' ? 'categories' : 'points';
}

function normalisePresetName(name: string | undefined | null, fallback: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.length ? trimmed : fallback;
}

function determineWeightsSource(
  requested: Record<string, unknown> | undefined,
  fallback: LeagueProfile | null | undefined,
  presetName: string,
  hasCustomOverrides: boolean
): string {
  if (hasCustomOverrides) {
    return 'custom';
  }

  if (requested) {
    const requestedPreset = typeof requested.preset_name === 'string' ? requested.preset_name.trim() : '';
    if (requestedPreset) {
      return 'preset(' + requestedPreset + ')';
    }
    return 'league';
  }

  if (fallback?.preset_name) {
    return 'preset(' + fallback.preset_name + ')';
  }

  if (fallback) {
    return 'league';
  }

  return 'preset(' + presetName + ')';
}

export function normalizeLeagueProfile(
  candidate: unknown,
  fallback: LeagueProfile | null | undefined
): NormalizeLeagueProfileResult {
  const requested = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : undefined;
  const fallbackProfile = fallback ?? null;

  const requestedPresetRaw = requested?.preset_name;
  const presetNameFromRequest =
    typeof requestedPresetRaw === 'string' && requestedPresetRaw.trim().length
      ? requestedPresetRaw.trim()
      : undefined;
  const fallbackPresetRaw = fallbackProfile?.preset_name;
  const presetNameFromFallback =
    typeof fallbackPresetRaw === 'string' && fallbackPresetRaw.trim().length
      ? fallbackPresetRaw.trim()
      : undefined;

  const preset =
    (presetNameFromRequest && getPresetByName(presetNameFromRequest)) ||
    (presetNameFromFallback && getPresetByName(presetNameFromFallback)) ||
    getPresetByName('Default');

  if (!preset) {
    throw new Error('Default scoring preset is not configured');
  }

  const leagueName =
    (typeof requested?.league_name === 'string' && requested.league_name.trim()) ||
    fallbackProfile?.league_name ||
    preset.name;

  const skaterScoring = {
    ...normalizeNumberRecord(preset.skater_scoring as Record<string, number> | undefined),
    ...normalizeNumberRecord(fallbackProfile?.skater_scoring as Record<string, number> | undefined),
    ...normalizeNumberRecord(requested?.skater_scoring as Record<string, number> | undefined)
  };

  const goalieScoring = {
    ...normalizeNumberRecord(preset.goalie_scoring as Record<string, number> | undefined),
    ...normalizeNumberRecord(fallbackProfile?.goalie_scoring as Record<string, number> | undefined),
    ...normalizeNumberRecord(requested?.goalie_scoring as Record<string, number> | undefined)
  };

  const lineupSlots = mergeLineupSlots(
    preset.default_roster ?? null,
    (fallbackProfile?.lineup_slots ?? null) as Record<string, number> | null,
    (requested?.lineup_slots ?? null) as Record<string, number> | null
  );

  const resolvedPresetName = normalisePresetName(presetNameFromRequest ?? presetNameFromFallback, preset.name);
  const hasCustomOverrides =
    !!(requested?.skater_scoring && Object.keys(normalizeNumberRecord(requested.skater_scoring as Record<string, number>)).length) ||
    !!(requested?.goalie_scoring && Object.keys(normalizeNumberRecord(requested.goalie_scoring as Record<string, number>)).length);

  // Extract num_teams if present
  const numTeams =
    (typeof requested?.num_teams === 'number' && requested.num_teams) ||
    fallbackProfile?.num_teams ||
    undefined;

  const profile: NormalizedLeagueProfile = {
    league_name: leagueName,
    scoring_type: normaliseScoringType(
      (requested?.scoring_type ?? fallbackProfile?.scoring_type) as string | undefined
    ),
    preset_name: resolvedPresetName,
    lineup_slots: lineupSlots,
    skater_scoring: skaterScoring,
    goalie_scoring: goalieScoring,
    ...(numTeams && { num_teams: numTeams })
  };

  const weightsSource = determineWeightsSource(requested, fallbackProfile, resolvedPresetName, hasCustomOverrides);

  return { profile, weightsSource };
}

function resolveStatsSnapshot(playerId: string, statsContext: StatsContext | null | undefined) {
  if (!statsContext) return undefined;
  const numericId = toNumericId(playerId);
  // Try: numeric ID, original ID, then with nhl: prefix
  return statsContext.players.get(numericId) ??
         statsContext.players.get(playerId) ??
         statsContext.players.get(`nhl:${numericId}`);
}

interface CoachRosterPlayerResponse {
  id: string;
  full_name: string;
  team: string;
  positions: string[];
  current_slot: string;
  games_played: number;
  stats: {
    goals: number;
    assists: number;
    shots_on_goal: number;
    blocks: number;
    power_play_points: number;
    shorthanded_goals: number;
    shorthanded_assists: number;
    hits: number;
    game_winning_goals: number;
  };
  blendedFppg: number;
  seasonFppg?: number;
  last30Fppg?: number;
  last7Fppg?: number;
  upcoming_games: string[];
}

function buildFppgSplits(
  snapshot: PlayerStatsSnapshot | undefined,
  leagueProfile: LeagueProfile | NormalizedLeagueProfile | null | undefined,
  fallback: number
) {
  // Return undefined values if no league profile is configured
  // This prevents showing scores with default/hardcoded weights
  if (!leagueProfile || !leagueProfile.scoring_weights) {
    return {
      seasonFppg: undefined,
      last30Fppg: undefined,
      last7Fppg: undefined
    };
  }

  const seasonWindow = computeWindowFppg(snapshot, leagueProfile, 'season');
  const seasonFppg = seasonWindow.hasData ? seasonWindow.value : fallback;
  const last30Window = computeWindowFppg(snapshot, leagueProfile, 'last30');
  // Don't fall back to seasonFppg - use 0 if no recent data
  const last30Fppg = last30Window.hasData ? last30Window.value : 0;
  const last7Window = computeWindowFppg(snapshot, leagueProfile, 'last7');
  // Don't fall back to last30Fppg - use 0 if no recent data
  const last7Fppg = last7Window.hasData ? last7Window.value : 0;

  return { seasonFppg, last30Fppg, last7Fppg };
}

function buildRosterPlayerResponse(
  player: Player,
  leagueProfile: NormalizedLeagueProfile,
  statsContext: StatsContext | null | undefined
): CoachRosterPlayerResponse {
  const snapshot = resolveStatsSnapshot(player.id, statsContext);
  const positions = splitPositions(player.position);
  const gamesPlayed =
    snapshot?.skaterStats?.gamesPlayed ??
    snapshot?.goalieStats?.gamesPlayed ??
    player.games_played ??
    0;

  const isGoalie = positions.includes('G');

  const stats: any = {
    goals: snapshot?.skaterStats?.goals ?? player.stats?.goals ?? 0,
    assists: snapshot?.skaterStats?.assists ?? player.stats?.assists ?? 0,
    shots_on_goal: snapshot?.skaterStats?.shots ?? player.stats?.shots_on_goal ?? 0,
    blocks: snapshot?.skaterStats?.blocks ?? player.stats?.blocks ?? 0,
    power_play_points: snapshot?.skaterStats?.ppPoints ?? player.stats?.power_play_points ?? 0,
    shorthanded_goals: snapshot?.skaterStats?.shGoals ?? player.stats?.shorthanded_goals ?? 0,
    shorthanded_assists: snapshot?.skaterStats?.shAssists ?? player.stats?.shorthanded_assists ?? 0,
    hits: snapshot?.skaterStats?.hits ?? player.stats?.hits ?? 0,
    game_winning_goals: snapshot?.skaterStats?.gameWinningGoals ?? player.stats?.game_winning_goals ?? 0,
    // Additional comprehensive stats from snapshot
    plus_minus: snapshot?.skaterStats?.plusMinus ?? 0,
    shooting_percentage: snapshot?.skaterStats?.shootingPct ?? 0,
    powerplay_goals: snapshot?.skaterStats?.ppGoals ?? 0,
    powerplay_assists: snapshot?.skaterStats?.ppAssists ?? 0,
    faceoff_percentage: snapshot?.skaterStats?.faceoffWinPct ?? 0,
    time_on_ice: snapshot?.skaterStats?.toi ?? ''
  };

  // Add goalie stats if this is a goalie
  if (isGoalie && snapshot?.goalieStats) {
    stats.wins = snapshot.goalieStats.wins ?? 0;
    stats.losses = snapshot.goalieStats.losses ?? 0;
    stats.overtime_losses = snapshot.goalieStats.overtimeLosses ?? 0;
    stats.saves = snapshot.goalieStats.saves ?? 0;
    stats.shots_against = snapshot.goalieStats.shotsAgainst ?? 0;
    stats.goals_against = snapshot.goalieStats.goalsAgainst ?? 0;
    stats.save_percentage = snapshot.goalieStats.savePct ?? 0;
    stats.goals_against_average = snapshot.goalieStats.gaa ?? 0;
    stats.shutouts = snapshot.goalieStats.shutouts ?? 0;
    stats.games_started = snapshot.goalieStats.gamesStarted ?? 0;
  }

  const numericId = toNumericId(player.id);
  const currentSlot = (player.current_slot ?? positions[0] ?? 'BN').toUpperCase();
  const blendedFppg = Number(calculatePlayerFppg(player, leagueProfile, statsContext).toFixed(2));

  const { seasonFppg, last30Fppg, last7Fppg } = buildFppgSplits(snapshot, leagueProfile, blendedFppg);

  return {
    id: numericId,
    full_name: player.full_name,
    team: player.team,
    positions: positions.length ? positions : ['UTIL'],
    current_slot: currentSlot,
    games_played: gamesPlayed,
    stats,
    blendedFppg,
    seasonFppg,
    last30Fppg,
    last7Fppg,
    upcoming_games: player.upcoming_games ?? []
  };
}

function resolvePlayerForProjection(
  playerId: string,
  context: LoadedUserContext | null | undefined,
  playersContext: PlayersContext | null | undefined
): Player | null {
  const numericId = toNumericId(playerId);

  const fromContext =
    context?.roster.find((entry) => toNumericId(entry.id) === numericId) ??
    context?.free_agents.find((entry) => toNumericId(entry.id) === numericId);

  if (fromContext) {
    return {
      ...fromContext,
      id: numericId
    };
  }

  const directoryEntry = playersContext?.entries.find((entry) => entry.id === numericId);
  if (!directoryEntry) {
    return null;
  }

  return {
    id: numericId,
    full_name: directoryEntry.name,
    team: directoryEntry.team,
    position: directoryEntry.pos.join('/') || 'UTIL',
    games_played: 1,
    stats: {
      goals: 0,
      assists: 0,
      shots_on_goal: 0,
      blocks: 0,
      power_play_points: 0,
      shorthanded_goals: 0,
      shorthanded_assists: 0,
      hits: 0,
      game_winning_goals: 0
    },
    upcoming_games: [],
    is_drop_eligible: false,
    tags: [],
    current_slot: undefined
  };
}
type LegacyMeta = {
  reqId: string;
  durationMs: number;
};

type LegacyPlayerSummary = {
  id: string;
  name: string;
  team: string;
  pos: string[];
};

type LegacyRecommendation = {
  player: LegacyPlayerSummary;
  deltaPoints: number;
  deltaGp: number;
  bestDrop: {
    player: LegacyPlayerSummary;
    lostPoints: number;
  };
  badges: string[];
};

type LegacyCoachResponse = {
  baseline_points: number;
  recommendations: LegacyRecommendation[];
  meta: LegacyMeta;
};

function ensureStagingEnvironment(): void {
  // Staging check disabled - coach endpoints available in production
}

function resolveUserId(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }
  return headerValue;
}

function buildMeta(startedAt: number): LegacyMeta {
  return {
    reqId: randomUUID(),
    durationMs: Date.now() - startedAt
  };
}

function toLegacyPlayerSummary(projection: PlayerProjection): LegacyPlayerSummary {
  return {
    id: projection.base.id,
    name: projection.base.full_name,
    team: projection.base.team,
    pos: [projection.base.position]
  };
}

function toLegacyRecommendation(rec: Recommendation, index: number): LegacyRecommendation {
  const badge = LEGACY_BADGE_MAP[rec.badge] ?? 'Green';
  const badges = [badge];
  if (index === 0) {
    badges.push('MattPick');
  }

  return {
    player: toLegacyPlayerSummary(rec.add_player),
    deltaPoints: rec.delta_points,
    deltaGp: rec.delta_gp,
    bestDrop: {
      player: toLegacyPlayerSummary(rec.drop_player),
      lostPoints: Number(rec.drop_player.projectedPoints.toFixed(2))
    },
    badges
  };
}

function toLegacyCoachResponse(payload: CoachResponse, meta: LegacyMeta): LegacyCoachResponse {
  return {
    baseline_points: Number(payload.baseline_points.toFixed(2)),
    recommendations: payload.recommendations.map((rec, index) =>
      toLegacyRecommendation(rec, index)
    ),
    meta
  };
}

coachRoutes.get('/health', (req, res) => {
  const dataCache = loadDataCacheManifest();
  const teamStatsLoaded = Boolean((req.app.locals?.teamStats as { loaded?: boolean } | null)?.loaded);
  res.json({
    version: process.env.npm_package_version ?? 'dev',
    capabilities: {
      presets: true,
      weights: true,
      projections: true
    },
    dataCache,
    teamStats: {
      loaded: teamStatsLoaded
    }
  });
});

coachRoutes.get('/users/:userId/context', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    let context: LoadedUserContext;
    try {
      context = loadUserContext(rawUserId);
    } catch {
      return res.json({
        league_profile: null,
        note: 'Waiting for required uploads.'
      });
    }

    const { profile } = normalizeLeagueProfile(context.league_profile, context.league_profile);
    return res.json({
      league_profile: profile,
      note: 'All required uploads detected.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});
coachRoutes.put('/users/:userId', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    if (!req.is('application/json')) {
      return res.status(415).json({
        error: 'Only application/json uploads are supported',
        todo: 'Screenshot OCR ingestion pending'
      });
    }

    const parseResult = UserContextSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid context payload', details: parseResult.error.format() });
    }

    const context = parseResult.data;
    await Promise.all([
      writeUserSettings(rawUserId, context.league_profile),
      writeUserRoster(rawUserId, context.roster),
      writeUserFreeAgents(rawUserId, context.free_agents)
    ]);
    await writeUserSnapshot(rawUserId, context);

    return res.status(201).json({
      ok: true,
      userId: rawUserId,
      components: ['settings', 'roster', 'free_agents'],
      counts: {
        roster: context.roster.length,
        free_agents: context.free_agents.length
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.put('/users/:userId/settings', async (req, res) => {
  try {
    ensureStagingEnvironment();
    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Expected application/json payload' });
    }

    const parseResult = LeagueSettingsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid settings payload', details: parseResult.error.format() });
    }

    console.log('[settings] Saving league settings for user:', rawUserId);
    console.log('[settings] Scoring weights:', parseResult.data.scoring_weights);

    await writeUserSettings(rawUserId, parseResult.data);

    try {
      const context = loadUserContext(rawUserId);
      await writeUserSnapshot(rawUserId, context);
      console.log('[settings] Settings saved and snapshot updated');
    } catch (error) {
      // Ignore – other components may not exist yet
      console.warn('[settings] Could not update snapshot:', error);
    }

    return res.status(201).json({ ok: true, userId: rawUserId, component: 'settings' });
  } catch (error) {
    console.error('[settings] Error saving settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.put('/users/:userId/roster', async (req, res) => {
  try {
    ensureStagingEnvironment();
    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Expected application/json payload' });
    }

    const parseResult = RosterUploadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid roster payload', details: parseResult.error.format() });
    }

    await writeUserRoster(rawUserId, parseResult.data.roster);

    try {
      const context = loadUserContext(rawUserId);
      await writeUserSnapshot(rawUserId, context);
    } catch {
      // Ignore until settings exist
    }

    return res.status(201).json({ ok: true, userId: rawUserId, component: 'roster', count: parseResult.data.roster.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.put('/users/:userId/free-agents', async (req, res) => {
  try {
    ensureStagingEnvironment();
    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Expected application/json payload' });
    }

    const parseResult = FreeAgentsUploadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid free agent payload', details: parseResult.error.format() });
    }

    await writeUserFreeAgents(rawUserId, parseResult.data.free_agents);

    try {
      const context = loadUserContext(rawUserId);
      await writeUserSnapshot(rawUserId, context);
    } catch {
      // Ignore until settings/roster exist
    }

    return res.status(201).json({ ok: true, userId: rawUserId, component: 'free_agents', count: parseResult.data.free_agents.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.get('/users/:userId/status', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    const status = getUserStatus(rawUserId);
    return res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// GET endpoint to retrieve league settings
coachRoutes.get('/users/:userId/settings', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    try {
      const context = loadUserContext(rawUserId);
      return res.json({ league_profile: context.league_profile });
    } catch (error) {
      // If no data exists yet, return null
      return res.json({ league_profile: null });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Coach roster and projection endpoints
coachRoutes.get('/users/:userId/roster', (req, res) => {
  const rawUserId = req.params.userId?.trim();
  if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  let context: LoadedUserContext;
  try {
    context = loadUserContext(rawUserId);
  } catch {
    return res.json({ roster: [] });
  }

  const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
  const { profile } = normalizeLeagueProfile(context.league_profile, context.league_profile);
  const roster = context.roster.map((player) => buildRosterPlayerResponse(player, profile, statsContext));

  return res.json({ roster });
});

coachRoutes.post('/users/:userId/projections', (req, res) => {
  const rawUserId = req.params.userId?.trim();
  if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const parseResult = ProjectionRequestSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
  }

  const payload = parseResult.data;
  let context: LoadedUserContext | null = null;
  try {
    context = loadUserContext(rawUserId);
  } catch {
    context = null;
  }

  const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
  const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;
  const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
  const teamStatsContext = (req.app.locals?.teamStats ?? null) as TeamStatsContext | null;

  const { profile: leagueProfile, weightsSource } = normalizeLeagueProfile(
    payload.league ?? payload.league_profile ?? null,
    context?.league_profile
  );

  const rosterEntries = payload.roster ?? [];
  if (!rosterEntries.length) {
    return res.json({ projections: {}, meta: { weightsSource } });
  }

  const projections = rosterEntries
    .map((entry) => {
      const player = resolvePlayerForProjection(entry.playerId, context, playersContext);
      if (!player) {
        return null;
      }
      // Hydrate schedule data from schedule context
      const withSchedule = mergeUpcomingGames(player, scheduleContext, payload.window);
      const withSlot: Player = {
        ...withSchedule,
        current_slot: entry.slot ?? player.current_slot
      };
      return buildProjection(withSlot, leagueProfile, payload.window, statsContext, scheduleContext, teamStatsContext);
    })
    .filter((projection): projection is PlayerProjection => Boolean(projection));

  if (!projections.length) {
    return res.json({ projections: {}, meta: { weightsSource } });
  }

  const simulation = simulateLineup(projections, payload.window, leagueProfile.lineup_slots);
  const startsByDate: Record<string, Record<string, number>> = {};

  for (const record of simulation.startRecords) {
    const numericId = toNumericId(record.playerId);
    const summary = startsByDate[numericId] ?? {};
    summary[record.date] = (summary[record.date] ?? 0) + 1;
    startsByDate[numericId] = summary;
  }

  type GameByDateDetail = { opponent: string; isHome: boolean; isOffNight: boolean; startTime: string; opponentGaPer60?: number };
  const projectionPayload: Record<string, { fppg: number; starts: number; gamesAvailable: number; projectedPoints: number; offNightRate: number; strengthOfSchedule: number; iceScore: number; startsByDate?: Record<string, number>; gamesByDate?: Record<string, GameByDateDetail> }> = {};

  for (const projection of projections) {
    const numericId = toNumericId(projection.base.id);
    const starts = simulation.startsByPlayer.get(projection.base.id) ?? simulation.startsByPlayer.get(numericId) ?? 0;
    const startsSummary = startsByDate[numericId];
    const gamesAvailable = projection.upcomingGamesInWindow.length;

    const response: { fppg: number; starts: number; gamesAvailable: number; projectedPoints: number; offNightRate: number; strengthOfSchedule: number; iceScore: number; startsByDate?: Record<string, number>; gamesByDate?: Record<string, GameByDateDetail> } = {
      fppg: projection.fppg,
      starts,
      gamesAvailable,
      projectedPoints: projection.projectedPoints,
      offNightRate: projection.offNightRate,
      strengthOfSchedule: projection.strengthOfSchedule,
      iceScore: projection.iceScore
    };

    if (startsSummary && Object.keys(startsSummary).length) {
      response.startsByDate = startsSummary;
    }

    // Add game details with opponent GAA
    if (projection.gameDetails && projection.gameDetails.length > 0) {
      const gamesByDate: Record<string, GameByDateDetail> = {};
      for (const game of projection.gameDetails) {
        const opponentStats = teamStatsContext?.byTeam.get(game.opponent);
        gamesByDate[game.date] = {
          opponent: game.opponent,
          isHome: game.isHome,
          isOffNight: game.isOffNight,
          startTime: game.startTime,
          opponentGaPer60: opponentStats?.gaPer60
        };
      }
      response.gamesByDate = gamesByDate;
    }

    projectionPayload[numericId] = response;
  }

  return res.json({
    projections: projectionPayload,
    meta: { weightsSource }
  });
});

coachRoutes.get('/users/:userId/free-agents', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    try {
      const context = loadUserContext(rawUserId);
      const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;

      const enrichedFreeAgents = context.free_agents.map((player) => {
        const statsSnapshot = statsContext?.players.get(player.id);
        let enrichedPlayer: Player = player;

        if (statsSnapshot?.skaterStats) {
          const skater = statsSnapshot.skaterStats;
          enrichedPlayer = {
            ...player,
            games_played: skater.gamesPlayed ?? player.games_played,
            stats: {
              ...player.stats,
              goals: skater.goals ?? 0,
              assists: skater.assists ?? 0,
              shots_on_goal: skater.shots ?? 0,
              blocks: skater.blocks ?? 0,
              power_play_points: skater.ppPoints ?? 0,
              shorthanded_goals: skater.shGoals ?? 0,
              shorthanded_assists: skater.shAssists ?? 0,
              hits: player.stats.hits ?? 0,
              game_winning_goals: player.stats.game_winning_goals ?? 0
            }
          };
        }

        const blendedFppg = calculatePlayerFppg(enrichedPlayer, context.league_profile, statsContext);
        const { seasonFppg, last30Fppg, last7Fppg } = buildFppgSplits(statsSnapshot, context.league_profile, blendedFppg);

        return { ...enrichedPlayer, blendedFppg, seasonFppg, last30Fppg, last7Fppg };
      });

      return res.json({ free_agents: enrichedFreeAgents });
    } catch (error) {
      return res.json({ free_agents: [] });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// DELETE endpoint to clear roster
// DELETE endpoint to clear roster
coachRoutes.delete('/users/:userId/roster', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    await writeUserRoster(rawUserId, []);
    return res.json({ ok: true, message: 'Roster cleared' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// DELETE endpoint to clear free agents
coachRoutes.delete('/users/:userId/free-agents', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    await writeUserFreeAgents(rawUserId, []);
    return res.json({ ok: true, message: 'Free agents cleared' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// POST endpoint to manually add a player to roster
coachRoutes.post('/users/:userId/roster/add', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { playerId } = req.body;
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'playerId is required' });
    }

    console.log('[add-to-roster] Request:', { userId: rawUserId, playerId });

    // Normalize player ID (accept both "nhl:XXXXX" and "XXXXX" formats)
    const normalizedPlayerId = playerId.startsWith('nhl:') ? playerId : `nhl:${playerId}`;
    console.log('[add-to-roster] Normalized player ID:', normalizedPlayerId);

    // Load players context
    const playersContext = req.app.locals?.players as PlayersContext | undefined;
    if (!playersContext) {
      console.error('[add-to-roster] Players context not loaded in app.locals');
      return res.status(503).json({ error: 'Players directory not available' });
    }

    console.log('[add-to-roster] Players context loaded:', {
      playerCount: playersContext.entries.length,
      sourcePath: playersContext.meta?.sourcePath
    });

    // Find the player by ID
    const playerEntry = playersContext.entries.find(p => p.id === normalizedPlayerId);
    if (!playerEntry) {
      console.error('[add-to-roster] Player not found:', {
        normalizedPlayerId,
        sampleIds: playersContext.entries.slice(0, 5).map(p => p.id)
      });
      return res.status(404).json({ error: 'Player not found' });
    }

    console.log('[add-to-roster] Player found:', playerEntry);

    // Load existing roster and check for duplicates
    let existingRoster: Player[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingRoster = context.roster;
      console.log('[add-to-roster] Existing roster loaded:', { rosterSize: existingRoster.length });
    } catch (error) {
      console.log('[add-to-roster] No existing roster, starting fresh. Error:', (error as Error).message);
      // No existing roster, start fresh
    }

    // Check for duplicates using normalized ID
    if (existingRoster.some(p => p.id === normalizedPlayerId)) {
      console.error('[add-to-roster] Player already in roster:', normalizedPlayerId);
      return res.status(400).json({ error: 'Player already in roster' });
    }

    // Get slot from request body (optional, defaults to 'BN')
    const slot = req.body.slot?.trim() || 'BN';
    console.log('[add-to-roster] Adding to slot:', slot);

    // Create player object
    const newPlayer: Player = {
      id: playerEntry.id,
      full_name: playerEntry.name,
      team: playerEntry.team,
      position: playerEntry.pos.join('/'),
      games_played: 1,
      stats: {
        goals: 0,
        assists: 0,
        shots_on_goal: 0,
        blocks: 0,
        power_play_points: 0
      },
      upcoming_games: [],
      is_drop_eligible: true,
      current_slot: slot
    };

    // Add to roster
    const updatedRoster = [...existingRoster, newPlayer];
    console.log('[add-to-roster] Attempting to write roster:', { newRosterSize: updatedRoster.length });
    await writeUserRoster(rawUserId, updatedRoster);

    console.log('[add-to-roster] Successfully added player to roster');
    return res.json({ ok: true, userId: rawUserId, component: 'roster', count: updatedRoster.length });
  } catch (error) {
    console.error('[add-to-roster] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[add-to-roster] Error details:', { message, stack });
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// POST endpoint to bulk add multiple players to roster
coachRoutes.post('/users/:userId/roster/add-bulk', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { playerIds, slot } = req.body;
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({ error: 'playerIds array is required' });
    }

    const targetSlot = slot?.trim() || 'BN';
    console.log('[bulk-add-to-roster] Request:', { userId: rawUserId, playerCount: playerIds.length, slot: targetSlot, playerIds });

    // Load players context
    const playersContext = req.app.locals?.players as PlayersContext | undefined;
    console.log('[bulk-add-to-roster] Players context exists:', !!playersContext);
    console.log('[bulk-add-to-roster] Players context entries:', playersContext?.entries?.length || 0);
    if (!playersContext) {
      console.error('[bulk-add-to-roster] Players context not loaded');
      return res.status(503).json({ error: 'Players directory not available' });
    }

    // Load existing roster once
    let existingRoster: Player[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingRoster = context.roster;
      console.log('[bulk-add-to-roster] Existing roster loaded:', { rosterSize: existingRoster.length });
    } catch (error) {
      console.log('[bulk-add-to-roster] No existing roster, starting fresh');
    }

    const existingIds = new Set(existingRoster.map(p => p.id));
    const newPlayers: Player[] = [];
    const skipped: string[] = [];
    const notFound: string[] = [];

    // Process all player IDs
    for (const playerId of playerIds) {
      const normalizedPlayerId = playerId.startsWith('nhl:') ? playerId : `nhl:${playerId}`;

      // Skip duplicates
      if (existingIds.has(normalizedPlayerId)) {
        console.log('[bulk-add-to-roster] Skipping duplicate:', normalizedPlayerId);
        skipped.push(playerId);
        continue;
      }

      // Find player
      const playerEntry = playersContext.entries.find(p => p.id === normalizedPlayerId);
      if (!playerEntry) {
        console.error('[bulk-add-to-roster] Player not found:', normalizedPlayerId, 'in', playersContext.entries.length, 'entries');
        // Log a sample of IDs to help debug
        if (playersContext.entries.length > 0) {
          console.error('[bulk-add-to-roster] Sample player IDs:', playersContext.entries.slice(0, 5).map(p => p.id));
        }
        notFound.push(playerId);
        continue;
      }

      // Create player object
      const newPlayer: Player = {
        id: playerEntry.id,
        full_name: playerEntry.name,
        team: playerEntry.team,
        position: playerEntry.pos.join('/'),
        games_played: 1,
        stats: {
          goals: 0,
          assists: 0,
          shots_on_goal: 0,
          blocks: 0,
          power_play_points: 0
        },
        upcoming_games: [],
        is_drop_eligible: true,
        current_slot: targetSlot
      };

      newPlayers.push(newPlayer);
      existingIds.add(normalizedPlayerId); // Track for subsequent duplicate checks
    }

    // Add all new players and save once
    const updatedRoster = [...existingRoster, ...newPlayers];
    console.log('[bulk-add-to-roster] Saving roster:', {
      previousSize: existingRoster.length,
      newSize: updatedRoster.length,
      added: newPlayers.length
    });
    await writeUserRoster(rawUserId, updatedRoster);

    console.log('[bulk-add-to-roster] Successfully added players');
    return res.json({
      ok: true,
      userId: rawUserId,
      added: newPlayers.length,
      skipped: skipped.length,
      notFound: notFound.length,
      skippedPlayers: skipped,
      notFoundPlayers: notFound,
      totalRosterSize: updatedRoster.length
    });
  } catch (error) {
    console.error('[bulk-add-to-roster] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// DELETE endpoint to remove a specific player from roster
coachRoutes.delete('/users/:userId/roster/remove/:playerId', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const playerId = req.params.playerId?.trim();
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    // Normalize player ID (accept both "nhl:XXXXX" and "XXXXX" formats)
    const normalizedPlayerId = playerId.startsWith('nhl:') ? playerId : `nhl:${playerId}`;

    // Load existing roster
    let existingRoster: Player[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingRoster = context.roster;
    } catch {
      return res.status(404).json({ error: 'Roster not found' });
    }

    // Check if player exists in roster
    if (!existingRoster.some(p => p.id === normalizedPlayerId)) {
      return res.status(404).json({ error: 'Player not found in roster' });
    }

    // Remove player from roster
    const updatedRoster = existingRoster.filter(p => p.id !== normalizedPlayerId);
    await writeUserRoster(rawUserId, updatedRoster);

    return res.json({ ok: true, userId: rawUserId, component: 'roster', count: updatedRoster.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// PATCH endpoint to update roster lineup (player slots)
coachRoutes.patch('/users/:userId/roster/lineup', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { lineup } = req.body;
    if (!lineup || !Array.isArray(lineup)) {
      return res.status(400).json({ error: 'lineup array is required' });
    }

    // Load existing roster
    let existingRoster: Player[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingRoster = context.roster;
    } catch {
      return res.status(404).json({ error: 'Roster not found' });
    }

    // Update slots for each player in the lineup
    // lineup format: [{ playerId: string, slot: string }, ...]
    const updatedRoster = existingRoster.map(player => {
      const lineupEntry = lineup.find((entry: any) => {
        const normalizedId = entry.playerId?.startsWith('nhl:')
          ? entry.playerId
          : `nhl:${entry.playerId}`;
        return normalizedId === player.id;
      });

      if (lineupEntry) {
        return {
          ...player,
          current_slot: lineupEntry.slot
        };
      }

      return player;
    });

    // Save updated roster
    await writeUserRoster(rawUserId, updatedRoster);

    return res.json({
      ok: true,
      userId: rawUserId,
      component: 'roster',
      count: updatedRoster.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// POST endpoint to manually add a player to free agents
coachRoutes.post('/users/:userId/free-agents/add', async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { playerId } = req.body;
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'playerId is required' });
    }

    // Load players context
    const playersContext = req.app.locals?.players as PlayersContext | undefined;
    if (!playersContext) {
      return res.status(503).json({ error: 'Players directory not available' });
    }

    // Find the player by ID
    const playerEntry = playersContext.entries.find(p => p.id === playerId);
    if (!playerEntry) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Load existing free agents and check for duplicates
    let existingFreeAgents: FreeAgent[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingFreeAgents = context.free_agents;
    } catch {
      // No existing free agents, start fresh
    }

    if (existingFreeAgents.some(p => p.id === playerId)) {
      return res.status(400).json({ error: 'Player already in free agents' });
    }

    // Create player object
    const newPlayer: FreeAgent = {
      id: playerEntry.id,
      full_name: playerEntry.name,
      team: playerEntry.team,
      position: playerEntry.pos.join('/'),
      games_played: 1,
      stats: {
        goals: 0,
        assists: 0,
        shots_on_goal: 0,
        blocks: 0,
        power_play_points: 0
      },
      upcoming_games: [],
      is_drop_eligible: false
    };

    // Add to free agents
    const updatedFreeAgents = [...existingFreeAgents, newPlayer];
    await writeUserFreeAgents(rawUserId, updatedFreeAgents);

    return res.json({ ok: true, userId: rawUserId, component: 'free_agents', count: updatedFreeAgents.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});


// Image upload endpoint for league settings
coachRoutes.post('/users/:userId/upload/league-settings', upload.single('image'), async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const provider = (req.body.provider as 'openai' | undefined) || 'openai';
    const promptHints = req.body.hints ? JSON.parse(req.body.hints) : [];

    // Save uploaded image for audit
    const uploadsDir = join(process.cwd(), 'server', 'data', 'uploads', rawUserId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    const imageId = randomUUID();
    const imagePath = join(uploadsDir, `settings-${imageId}.png`);
    await writeFile(imagePath, req.file.buffer);

    // Parse with OCR
    const result = await parseLeagueSettingsScreenshot(req.file.buffer, {
      provider,
      userId: rawUserId,
      promptHints
    });

    // Save settings
    await writeUserSettings(rawUserId, result.league_profile);

    return res.json({
      ok: true,
      league_profile: result.league_profile,
      confidence: result.confidence,
      warnings: result.warnings,
      imageId
    });
  } catch (error) {
    if (error instanceof OcrNotConfiguredError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof OcrProviderError) {
      return res.status(502).json({ error: error.message, provider: error.provider });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Image upload endpoint for roster
coachRoutes.post('/users/:userId/upload/roster', upload.single('image'), async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const provider = (req.body.provider as 'openai' | undefined) || 'openai';
    const promptHints = req.body.hints ? JSON.parse(req.body.hints) : [];
    const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;

    if (!playersContext) {
      return res.status(503).json({ error: 'Player directory unavailable' });
    }

    // Save uploaded image to /tmp (only writable directory in serverless)
    const uploadsDir = join('/tmp', 'uploads', rawUserId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    const imageId = randomUUID();
    const imagePath = join(uploadsDir, `roster-${imageId}.png`);
    await writeFile(imagePath, req.file.buffer);

    // Player search function for OCR
    const playerSearchFn = async (name: string) => {
      const matches = searchPlayers(name, playersContext, 5);
      return matches.map(m => ({
        id: m.id,
        name: m.name,
        team: m.team,
        position: m.pos[0] || 'F'
      }));
    };

    // Parse with OCR
    const result = await parseRosterScreenshot(req.file.buffer, {
      provider,
      userId: rawUserId,
      promptHints
    }, playerSearchFn);

    // Load existing roster and append new players (avoid duplicates by ID)
    let existingRoster: Player[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingRoster = context.roster;
    } catch {
      // No existing roster, start fresh
    }

    const existingIds = new Set(existingRoster.map(p => p.id));
    const newPlayers = result.roster.filter(p => !existingIds.has(p.id));
    const combinedRoster = [...existingRoster, ...newPlayers];

    // Save combined roster
    await writeUserRoster(rawUserId, combinedRoster);

    return res.json({
      ok: true,
      roster: result.roster,
      unmatchedPlayers: result.unmatchedPlayers,
      confidence: result.confidence,
      imageId
    });
  } catch (error) {
    if (error instanceof OcrNotConfiguredError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof OcrProviderError) {
      return res.status(502).json({ error: error.message, provider: error.provider });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Image upload endpoint for free agents
coachRoutes.post('/users/:userId/upload/free-agents', upload.single('image'), async (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const provider = (req.body.provider as 'openai' | undefined) || 'openai';
    const promptHints = req.body.hints ? JSON.parse(req.body.hints) : [];
    const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;

    if (!playersContext) {
      return res.status(503).json({ error: 'Player directory unavailable' });
    }

    // Save uploaded image to /tmp (only writable directory in serverless)
    const uploadsDir = join('/tmp', 'uploads', rawUserId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    const imageId = randomUUID();
    const imagePath = join(uploadsDir, `free-agents-${imageId}.png`);
    await writeFile(imagePath, req.file.buffer);

    // Player search function for OCR
    const playerSearchFn = async (name: string) => {
      const matches = searchPlayers(name, playersContext, 5);
      return matches.map(m => ({
        id: m.id,
        name: m.name,
        team: m.team,
        position: m.pos[0] || 'F'
      }));
    };

    // Parse with OCR
    const result = await parseFreeAgentsScreenshot(req.file.buffer, {
      provider,
      userId: rawUserId,
      promptHints
    }, playerSearchFn);

    // Load existing free agents and append new players (avoid duplicates by ID)
    let existingFreeAgents: FreeAgent[] = [];
    try {
      const context = loadUserContext(rawUserId);
      existingFreeAgents = context.free_agents;
    } catch {
      // No existing free agents, start fresh
    }

    const existingIds = new Set(existingFreeAgents.map(p => p.id));
    const newPlayers = result.free_agents.filter(p => !existingIds.has(p.id));
    const combinedFreeAgents = [...existingFreeAgents, ...newPlayers];

    // Save combined free agents
    await writeUserFreeAgents(rawUserId, combinedFreeAgents);

    return res.json({
      ok: true,
      free_agents: result.free_agents,
      unmatchedPlayers: result.unmatchedPlayers,
      confidence: result.confidence,
      imageId
    });
  } catch (error) {
    console.error('[OCR Upload Error]', error);
    if (error instanceof OcrNotConfiguredError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof OcrProviderError) {
      return res.status(502).json({ error: error.message, provider: error.provider });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[OCR Upload] Error details:', { message, stack });
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Legacy free-agents upload endpoint (kept for backwards compatibility)
coachRoutes.post('/users/:userId/free-agents/upload', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    return res.status(301).json({
      message: 'This endpoint has moved',
      newEndpoint: `/coach/users/${rawUserId}/upload/free-agents`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.get('/users/:userId/conflicts', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id. Use 3-64 characters: letters, numbers, -, _, .' });
    }

    const parseResult = ConflictQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid query', details: parseResult.error.format() });
    }

    const { start, end } = parseResult.data;
    const window = { start, end };

    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const teamStatsContext = (req.app.locals?.teamStats ?? null) as TeamStatsContext | null;
    const context = loadUserContext(rawUserId);

    const rosterWithSchedule = context.roster.map((player) =>
      mergeUpcomingGames(player, scheduleContext, window)
    );

    const rosterProjections = rosterWithSchedule.map((player) =>
      buildProjection(player, context.league_profile, window, statsContext, scheduleContext, teamStatsContext)
    );
    const projectionById = new Map(rosterProjections.map((projection) => [projection.base.id, projection]));

    const simulation = simulateLineup(
      rosterProjections,
      window,
      context.league_profile.lineup_slots
    );

    const benchCounts = new Map<string, number>();
    for (const record of simulation.benchRecords) {
      benchCounts.set(record.playerId, (benchCounts.get(record.playerId) ?? 0) + 1);
    }

    const startsByPlayerObject = Object.fromEntries(simulation.startsByPlayer.entries());
    const benchCountsObject = Object.fromEntries(benchCounts.entries());

    const calendar = buildDateRange(window);
    const daySummaries = calendar.map((date) => {
      const starters = simulation.startRecords
        .filter((record) => record.date === date)
        .map((record) => {
          const projection = projectionById.get(record.playerId);
          return {
            playerId: record.playerId,
            playerName: record.playerName,
            team: projection?.base.team ?? '',
            position: record.position,
            fppg: record.fppg
          };
        });

      const bench = simulation.benchRecords
        .filter((record) => record.date === date)
        .map((record) => {
          const projection = projectionById.get(record.playerId);
          return {
            playerId: record.playerId,
            playerName: record.playerName,
            team: projection?.base.team ?? '',
            position: record.position,
            fppg: record.fppg,
            reason: record.reason
          };
        });

      const unusedSlots: Record<string, number> = {};
      for (const [position, limit] of Object.entries(context.league_profile.lineup_slots)) {
        const used = starters.filter((starter) => starter.position === position).length;
        unusedSlots[position] = Math.max(0, limit - used);
      }

      return {
        date,
        starters,
        benched: bench,
        unusedSlots
      };
    });

    return res.json({
      window,
      lineupSlots: context.league_profile.lineup_slots,
      summary: {
        totalBenchGp: simulation.benchRecords.length,
        totalStarts: Array.from(simulation.startsByPlayer.values()).reduce((sum, value) => sum + value, 0)
      },
      startsByPlayer: startsByPlayerObject,
      benchCounts: benchCountsObject,
      byDay: daySummaries
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.post('/recommendations', (req, res) => {
  const startedAt = Date.now();

  try {
    ensureStagingEnvironment();

    const userId = resolveUserId(req.header('x-user-id') ?? undefined);
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const parseResult = CoachRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
    }

    const { window } = parseResult.data;
    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const teamStatsContext = (req.app.locals?.teamStats ?? null) as TeamStatsContext | null;
    const payload = generateCoachRecommendations(userId, window, scheduleContext, statsContext, teamStatsContext);
    const meta = buildMeta(startedAt);

    return res.json({ ...payload, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

coachRoutes.post('/streamers', (req, res) => {
  const startedAt = Date.now();

  try {
    ensureStagingEnvironment();

    const userId = resolveUserId(req.header('x-user-id') ?? undefined);
    if (!userId) {
      return res.status(401).json({ error: 'Missing x-user-id header' });
    }

    const parseResult = CoachRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
    }

    const { window } = parseResult.data;
    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const teamStatsContext = (req.app.locals?.teamStats ?? null) as TeamStatsContext | null;
    const payload = generateCoachRecommendations(userId, window, scheduleContext, statsContext, teamStatsContext);
    const meta = buildMeta(startedAt);

    const legacy = toLegacyCoachResponse(payload, meta);
    return res.json(legacy);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Player search with FPPG calculated based on user's league settings
coachRoutes.get('/users/:userId/players/search', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      return res.status(400).json({ error: 'Missing q parameter' });
    }
    if (query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;
    if (!playersContext) {
      return res.status(503).json({ error: 'Player directory unavailable' });
    }

    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;
    const limit = typeof req.query.limit === 'string' ? Math.min(parseInt(req.query.limit, 10) || 10, 25) : 10;
    const matches = searchPlayers(query, playersContext, limit);

    // Load user's league settings for FPPG calculation
    let leagueProfile: LeagueProfile | null = null;
    try {
      const context = loadUserContext(rawUserId);
      leagueProfile = context.league_profile;
    } catch {
      // If no user context, FPPG will be null
    }

    const results = matches.map((entry) => {
      // Get player stats from stats context
      const snapshot = statsContext?.players.get(entry.id);

      const splits = buildFppgSplits(snapshot, leagueProfile, 0);
      const blendedFppg = splits.seasonFppg;
      const upcomingGames = getUpcomingGames(entry.team, scheduleContext, 10);

      return {
        id: entry.id,
        name: entry.name,
        team: entry.team,
        pos: entry.pos,
        aliases: entry.aliases,
        blendedFppg,
        seasonFppg: splits.seasonFppg,
        last30Fppg: splits.last30Fppg,
        last7Fppg: splits.last7Fppg,
        upcomingGames
      };
    });

    return res.json({
      results,
      meta: {
        count: results.length,
        limit,
        generatedAt: playersContext.meta.generatedAt,
        directorySize: playersContext.meta.playerCount
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

// Helper function to get upcoming games
function getUpcomingGames(teamCode: string, scheduleContext: ScheduleContext | null | undefined, limit: number = 10): string[] {
  if (!scheduleContext) {
    return [];
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const allDates = getTeamScheduleDates(teamCode, scheduleContext);

  // Filter to future games only and limit
  return allDates
    .filter(date => date >= today)
    .slice(0, limit);
}

// GET /coach/users/:userId/players - Get all players with user-specific FPPG calculation
coachRoutes.get('/users/:userId/players', (req, res) => {
  try {
    ensureStagingEnvironment();

    const rawUserId = req.params.userId?.trim();
    if (!rawUserId || !USER_ID_PATTERN.test(rawUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const playersContext = (req.app.locals?.players ?? null) as PlayersContext | null;
    if (!playersContext) {
      return res.status(503).json({ error: 'Player directory unavailable' });
    }

    const statsContext = (req.app.locals?.stats ?? null) as StatsContext | null;
    const scheduleContext = (req.app.locals?.schedules ?? null) as ScheduleContext | null;

    // Load user's league settings for FPPG calculation
    let leagueProfile: LeagueProfile | null = null;
    try {
      const context = loadUserContext(rawUserId);
      leagueProfile = context.league_profile;
    } catch {
      // If no user context, FPPG will be null
    }

    // Convert all players to results with calculated FPPG
    const results = playersContext.entries.map((entry) => {
      // Get player stats from stats context
      const snapshot = statsContext?.players.get(entry.id);

      const splits = buildFppgSplits(snapshot, leagueProfile, 0);
      const blendedFppg = splits.seasonFppg;
      const upcomingGames = getUpcomingGames(entry.team, scheduleContext, 10);

      // Determine if player is a goalie
      const isGoalie = entry.pos.includes('G');

      // Build detailed stats object
      let detailedStats: any = {};
      let gamesPlayed = 0;

      if (snapshot) {
        if (isGoalie && snapshot.goalieStats) {
          // Goalie stats
          gamesPlayed = snapshot.goalieStats.gamesPlayed ?? 0;
          detailedStats = {
            wins: snapshot.goalieStats.wins ?? 0,
            losses: snapshot.goalieStats.losses ?? 0,
            overtime_losses: snapshot.goalieStats.overtimeLosses ?? 0,
            saves: snapshot.goalieStats.saves ?? 0,
            shots_against: snapshot.goalieStats.shotsAgainst ?? 0,
            goals_against: snapshot.goalieStats.goalsAgainst ?? 0,
            save_percentage: snapshot.goalieStats.savePct ?? 0,
            goals_against_average: snapshot.goalieStats.gaa ?? 0,
            shutouts: snapshot.goalieStats.shutouts ?? 0,
            games_started: snapshot.goalieStats.gamesStarted ?? 0,
          };
        } else if (snapshot.skaterStats) {
          // Skater stats
          gamesPlayed = snapshot.skaterStats.gamesPlayed ?? 0;
          detailedStats = {
            goals: snapshot.skaterStats.goals ?? 0,
            assists: snapshot.skaterStats.assists ?? 0,
            points: snapshot.skaterStats.points ?? 0,
            shots_on_goal: snapshot.skaterStats.shots ?? 0,
            power_play_points: snapshot.skaterStats.ppPoints ?? 0,
            blocks: snapshot.skaterStats.blocks ?? 0,
            hits: snapshot.skaterStats.hits ?? 0,
            plus_minus: snapshot.skaterStats.plusMinus ?? 0,
            shooting_percentage: snapshot.skaterStats.shootingPct ?? 0,
            powerplay_goals: snapshot.skaterStats.ppGoals ?? 0,
            powerplay_assists: snapshot.skaterStats.ppAssists ?? 0,
            shorthanded_goals: snapshot.skaterStats.shGoals ?? 0,
            shorthanded_assists: snapshot.skaterStats.shAssists ?? 0,
            game_winning_goals: snapshot.skaterStats.gameWinningGoals ?? 0,
            faceoff_percentage: snapshot.skaterStats.faceoffWinPct ?? 0,
            time_on_ice: snapshot.skaterStats.toi ?? '',
          };
        }
      }

      return {
        id: entry.id,
        name: entry.name,
        team: entry.team,
        pos: entry.pos,
        aliases: entry.aliases,
        blendedFppg,
        seasonFppg: splits.seasonFppg,
        last30Fppg: splits.last30Fppg,
        last7Fppg: splits.last7Fppg,
        upcomingGames,
        games_played: gamesPlayed,
        stats: detailedStats,
      };
    });

    return res.json({
      players: results,
      meta: {
        count: results.length,
        generatedAt: playersContext.meta.generatedAt,
        directorySize: playersContext.meta.playerCount
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('staging environment') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});


































