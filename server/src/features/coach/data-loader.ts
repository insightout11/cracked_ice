import { existsSync, readFileSync, mkdirSync, statSync } from 'fs';
import { promises as fsp } from 'fs';
import { join } from 'path';
import {
  UserContextSchema,
  LeagueProfile,
  UserContext,
  FreeAgent,
  Player,
  FreeAgentsUploadSchema,
  RosterUploadSchema,
  LeagueSettingsSchema,
  PositionOverridesSchema,
  PositionOverrides,
  PositionOverride
} from './types';
import {
  MAX_FREE_AGENT_CANDIDATES,
  MAX_DROP_CANDIDATES
} from './constants';
import { getKVStorage } from './kvStorage';
import { YAHOO_STANDARD_PRESET } from './presets';

export interface LoadedUserContext extends UserContext {
  roster: Player[];
  free_agents: FreeAgent[];
}

export const USER_CONTEXT_DIR_CANDIDATES = [
  join('/tmp', 'data', 'coach', 'users'), // Writable directory in serverless
  typeof __dirname === 'string'
    ? join(__dirname, '..', '..', '..', 'data', 'coach', 'users')
    : undefined,
  join(process.cwd(), 'data', 'coach', 'users'),
  join(process.cwd(), 'server', 'data', 'coach', 'users'),
].filter((candidate): candidate is string => Boolean(candidate));

const SETTINGS_FILE = 'settings.json';
const ROSTER_FILE = 'roster.json';
const FREE_AGENTS_FILE = 'free_agents.json';
const SNAPSHOT_FILE = 'context.snapshot.json';
const POSITION_OVERRIDES_FILE = 'position_overrides.json';

export const USER_CONTEXT_FILES = {
  settings: SETTINGS_FILE,
  roster: ROSTER_FILE,
  freeAgents: FREE_AGENTS_FILE,
  snapshot: SNAPSHOT_FILE,
  positionOverrides: POSITION_OVERRIDES_FILE
} as const;

export interface UserComponentStatus {
  present: boolean;
  updatedAt?: string;
  count?: number;
  source?: 'split' | 'legacy';
  path?: string;
}

export interface UserStatusSummary {
  userId: string;
  components: {
    settings: UserComponentStatus;
    roster: UserComponentStatus;
    free_agents: UserComponentStatus;
  };
  legacyFallback: boolean;
  contextReady: boolean;
  contextError?: string;
}

let cachedRoot: string | null = null;

function findExistingRoot(): string | null {
  if (cachedRoot && existsSync(cachedRoot)) {
    return cachedRoot;
  }

  for (const candidate of USER_CONTEXT_DIR_CANDIDATES) {
    if (!candidate) continue;
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      cachedRoot = candidate;
      return candidate;
    }
  }

  return null;
}

function findLegacyContextPath(userId: string): string | null {
  for (const candidate of USER_CONTEXT_DIR_CANDIDATES) {
    if (!candidate) continue;
    if (!existsSync(candidate)) continue;
    const filePath = join(candidate, `${userId}.json`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

export function ensureUserContextRoot(): string {
  // For writes, always prefer /tmp in serverless (first candidate)
  const firstCandidate = USER_CONTEXT_DIR_CANDIDATES[0];
  if (firstCandidate?.startsWith('/tmp')) {
    mkdirSync(firstCandidate, { recursive: true });
    cachedRoot = firstCandidate;
    return firstCandidate;
  }

  const existing = findExistingRoot();
  if (existing) {
    return existing;
  }

  if (!firstCandidate) {
    throw new Error('No coach user directory candidates configured');
  }
  mkdirSync(firstCandidate, { recursive: true });
  cachedRoot = firstCandidate;
  return firstCandidate;
}

function resolveExistingRoot(): string {
  const root = findExistingRoot();
  if (!root) {
    throw new Error(
      `Coach user context directory not found. Checked: ${USER_CONTEXT_DIR_CANDIDATES.join(', ')}`
    );
  }
  return root;
}

function resolveUserDir(userId: string, ensure = false): string {
  const root = ensure ? ensureUserContextRoot() : resolveExistingRoot();
  return join(root, userId);
}

function readJsonFile<T>(path: string): T {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as T;
}

async function loadFromLegacy(userId: string, playersContext?: any): Promise<LoadedUserContext> {
  const legacyPath = findLegacyContextPath(userId);
  if (!legacyPath) {
    throw new Error(`User context not found for ${userId}`);
  }

  const sanitized = readFileSync(legacyPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(sanitized);
  const context = UserContextSchema.parse(parsed);
  return await truncatePools(userId, context, playersContext);
}

async function loadFromSplit(userId: string, userDir: string, playersContext?: any): Promise<LoadedUserContext> {
  const settingsPath = join(userDir, SETTINGS_FILE);
  const rosterPath = join(userDir, ROSTER_FILE);
  const freeAgentsPath = join(userDir, FREE_AGENTS_FILE);

  if (!existsSync(settingsPath)) {
    throw new Error(`League settings not found for ${userId}. Upload settings first.`);
  }
  if (!existsSync(rosterPath)) {
    throw new Error(`Roster not found for ${userId}. Upload roster before running the coach.`);
  }

  const league_profile = LeagueSettingsSchema.parse(readJsonFile( settingsPath ));
  const rosterPayload = RosterUploadSchema.parse(readJsonFile( rosterPath ));

  let freeAgents: FreeAgent[] = [];
  if (existsSync(freeAgentsPath)) {
    const freeAgentPayload = FreeAgentsUploadSchema.parse(readJsonFile( freeAgentsPath ));
    freeAgents = freeAgentPayload.free_agents;
  }

  const context: UserContext = {
    user_id: userId,
    league_profile,
    roster: rosterPayload.roster,
    free_agents: freeAgents
  };

  return await truncatePools(userId, context, playersContext);
}

function applyPositionOverrides(
  players: (Player | FreeAgent)[],
  overrides: PositionOverrides
): (Player | FreeAgent)[] {
  return players.map(player => {
    // Parse player position to get base positions
    const basePositions = player.position.split(/[\/,]/).map(p => p.trim().toUpperCase());

    // Get merged positions (base + overrides)
    const mergedPositions = getPlayerPositions(player.id, basePositions, overrides);

    // Update player position if it changed
    if (mergedPositions.length !== basePositions.length ||
        !mergedPositions.every(p => basePositions.includes(p))) {
      return {
        ...player,
        position: mergedPositions.join('/')
      };
    }

    return player;
  });
}

/**
 * Sync roster/free agent player teams with latest data from PlayersContext
 */
function syncPlayerTeams<T extends Player | FreeAgent>(
  players: T[],
  playersContext: any
): { synced: T[]; updateCount: number } {
  if (!playersContext?.entries) {
    return { synced: players, updateCount: 0 };
  }

  let updateCount = 0;
  const synced = players.map((player) => {
    const latest = playersContext.entries.find((p: any) => p.id === player.id);
    if (latest && latest.team !== player.team) {
      updateCount++;
      return { ...player, team: latest.team };
    }
    return player;
  });

  return { synced, updateCount };
}

async function truncatePools(userId: string, context: UserContext, playersContext?: any): Promise<LoadedUserContext> {
  let { roster, free_agents } = context;

  // Sync player teams with latest players.json data
  if (playersContext) {
    const rosterSync = syncPlayerTeams(roster, playersContext);
    const faSync = syncPlayerTeams(free_agents, playersContext);

    if (rosterSync.updateCount > 0 || faSync.updateCount > 0) {
      console.log(`[data-loader] Auto-synced teams for ${userId}: ${rosterSync.updateCount} roster, ${faSync.updateCount} free agents`);
      roster = rosterSync.synced;
      free_agents = faSync.synced;

      // Persist the updated roster back to storage
      if (rosterSync.updateCount > 0) {
        await writeUserRoster(userId, roster);
      }
      if (faSync.updateCount > 0) {
        const kv = getKVStorage();
        await kv.write(userId, 'free_agents', JSON.stringify({ free_agents }));
      }
    }
  }

  // Apply position overrides
  const overrides = await loadPositionOverrides(userId);
  if (overrides.overrides.length > 0) {
    roster = applyPositionOverrides(roster, overrides) as Player[];
    free_agents = applyPositionOverrides(free_agents, overrides) as FreeAgent[];
    console.log(`[data-loader] Applied ${overrides.overrides.length} position overrides for ${userId}`);
  }

  const dropPool = roster.filter((player) => player.is_drop_eligible);
  if (dropPool.length > MAX_DROP_CANDIDATES) {
    console.warn(
      `[coach] drop pool truncated from ${dropPool.length} to ${MAX_DROP_CANDIDATES} for user ${userId}`
    );
  }

  if (free_agents.length > MAX_FREE_AGENT_CANDIDATES) {
    console.warn(
      `[coach] free agent pool truncated from ${free_agents.length} to ${MAX_FREE_AGENT_CANDIDATES} for user ${userId}`
    );
  }

  return {
    ...context,
    roster,
    free_agents: free_agents.slice(0, MAX_FREE_AGENT_CANDIDATES)
  };
}

/**
 * Create default league profile using Yahoo Standard preset
 */
function createDefaultLeagueProfile(): LeagueProfile {
  return {
    league_name: 'My League',
    scoring_type: 'points' as const,
    preset_name: 'Yahoo Standard',
    skater_scoring: YAHOO_STANDARD_PRESET.skater_scoring,
    goalie_scoring: YAHOO_STANDARD_PRESET.goalie_scoring,
    lineup_slots: YAHOO_STANDARD_PRESET.default_roster || {
      C: 2,
      LW: 2,
      RW: 2,
      D: 4,
      G: 2,
      BN: 4
    }
  };
}

export async function loadUserContext(userId: string, playersContext?: any): Promise<LoadedUserContext> {
  // Try loading from KV first (production)
  console.log(`[data-loader] REDIS_URL present: ${!!process.env.REDIS_URL}, value length: ${process.env.REDIS_URL?.length || 0}`);
  const kv = getKVStorage();
  try {
    const [settingsData, rosterData, freeAgentsData] = await Promise.all([
      kv.read(userId, 'settings'),
      kv.read(userId, 'roster'),
      kv.read(userId, 'free_agents')
    ]);

    // If we have roster in Redis, use it (even if settings missing)
    if (rosterData) {
      console.log(`[data-loader] Loading ${userId} roster from KV (settings: ${!!settingsData})`);
      const rosterPayload = RosterUploadSchema.parse(JSON.parse(rosterData));

      // Try to get settings from Redis, use Yahoo Standard preset as default
      let league_profile;
      if (settingsData) {
        league_profile = LeagueSettingsSchema.parse(JSON.parse(settingsData));
      } else {
        console.log(`[data-loader] Settings not in Redis, using Yahoo Standard preset for ${userId}`);
        league_profile = createDefaultLeagueProfile();
      }

      let freeAgents: FreeAgent[] = [];
      if (freeAgentsData) {
        const freeAgentPayload = FreeAgentsUploadSchema.parse(JSON.parse(freeAgentsData));
        freeAgents = freeAgentPayload.free_agents;
      }

      const context: UserContext = {
        user_id: userId,
        league_profile,
        roster: rosterPayload.roster,
        free_agents: freeAgents
      };

      return await truncatePools(userId, context, playersContext);
    }
  } catch (error) {
    console.warn(`[data-loader] KV load failed for ${userId}, trying filesystem:`, error);
  }

  // No roster in Redis, fallback to filesystem
  return await loadFromFilesystemOrLegacy(userId, playersContext);
}

async function loadFromFilesystemOrLegacy(userId: string, playersContext?: any): Promise<LoadedUserContext> {
  const root = findExistingRoot();
  if (root) {
    const userDir = join(root, userId);
    if (existsSync(userDir) && statSync(userDir).isDirectory()) {
      console.log(`[data-loader] Loading ${userId} from filesystem`);
      return await loadFromSplit(userId, userDir, playersContext);
    }
  }

  console.log(`[data-loader] Loading ${userId} from legacy`);
  return await loadFromLegacy(userId, playersContext);
}

export function getDropCandidates(roster: Player[]): Player[] {
  // Filter out players in IR/IR+ slots - they don't take up active lineup spots
  const activeRoster = roster.filter((player) => {
    const slot = player.current_slot?.toUpperCase();
    return !slot || (!slot.startsWith('IR') && slot !== 'IR+');
  });

  const dropEligible = activeRoster.filter((player) => player.is_drop_eligible);
  if (!dropEligible.length) {
    return activeRoster.slice(0, MAX_DROP_CANDIDATES);
  }
  return dropEligible.slice(0, MAX_DROP_CANDIDATES);
}


function buildFileStatus(path: string, source: 'split' | 'legacy', countExtractor?: (data: any) => number): UserComponentStatus {
  const stat = statSync(path);
  const status: UserComponentStatus = {
    present: true,
    updatedAt: new Date(stat.mtimeMs).toISOString(),
    source,
    path
  };
  if (countExtractor) {
    try {
      const data = readJsonFile<any>(path);
      const count = countExtractor(data);
      if (typeof count === 'number' && Number.isFinite(count)) {
        status.count = count;
      }
    } catch (error) {
      console.warn(`[coach] Failed to derive count for ${path}: ${(error as Error).message}`);
    }
  }
  return status;
}

export async function getUserStatus(userId: string): Promise<UserStatusSummary> {
  const root = findExistingRoot();
  const legacyPath = findLegacyContextPath(userId);

  let settingsStatus: UserComponentStatus = { present: false };
  let rosterStatus: UserComponentStatus = { present: false };
  let freeAgentsStatus: UserComponentStatus = { present: false };
  let legacyFallback = false;

  if (root) {
    const userDir = join(root, userId);
    if (existsSync(userDir) && statSync(userDir).isDirectory()) {
      const settingsPath = join(userDir, SETTINGS_FILE);
      const rosterPath = join(userDir, ROSTER_FILE);
      const freeAgentsPath = join(userDir, FREE_AGENTS_FILE);

      if (existsSync(settingsPath)) {
        settingsStatus = buildFileStatus(settingsPath, 'split');
      }
      if (existsSync(rosterPath)) {
        rosterStatus = buildFileStatus(rosterPath, 'split', (payload: any) =>
          Array.isArray(payload?.roster) ? payload.roster.length : 0
        );
      }
      if (existsSync(freeAgentsPath)) {
        freeAgentsStatus = buildFileStatus(freeAgentsPath, 'split', (payload: any) =>
          Array.isArray(payload?.free_agents) ? payload.free_agents.length : 0
        );
      }
    }
  }

  if (!settingsStatus.present && !rosterStatus.present && !freeAgentsStatus.present && legacyPath) {
    legacyFallback = true;
    try {
      const legacyContext = UserContextSchema.parse(readJsonFile(legacyPath));
      const stat = statSync(legacyPath);
      const baseMeta = {
        updatedAt: new Date(stat.mtimeMs).toISOString(),
        source: 'legacy' as const,
        path: legacyPath
      };
      settingsStatus = { present: true, ...baseMeta };
      rosterStatus = {
        present: legacyContext.roster.length > 0,
        count: legacyContext.roster.length,
        ...baseMeta
      };
      freeAgentsStatus = {
        present: legacyContext.free_agents.length > 0,
        count: legacyContext.free_agents.length,
        ...baseMeta
      };
    } catch (error) {
      console.warn(`[coach] Failed to parse legacy context for ${userId}: ${(error as Error).message}`);
    }
  }

  let contextReady = false;
  let contextError: string | undefined;
  try {
    await loadUserContext(userId);
    contextReady = true;
  } catch (error) {
    contextError = (error as Error).message;
  }

  return {
    userId,
    components: {
      settings: settingsStatus,
      roster: rosterStatus,
      free_agents: freeAgentsStatus
    },
    legacyFallback,
    contextReady,
    contextError
  };
}

export async function writeUserSettings(userId: string, profile: LeagueProfile): Promise<void> {
  const data = `${JSON.stringify(profile, null, 2)}\n`;

  // Write to KV (production) or filesystem (local)
  const kv = getKVStorage();
  await kv.write(userId, 'settings', data);

  // Also write to filesystem for compatibility
  try {
    const dir = resolveUserDir(userId, true);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(join(dir, SETTINGS_FILE), data, 'utf8');
  } catch (error) {
    console.warn('[data-loader] Filesystem write failed (expected in serverless):', error);
  }
}

export async function writeUserRoster(userId: string, roster: Player[]): Promise<void> {
  const data = `${JSON.stringify({ roster }, null, 2)}\n`;

  // Write to KV (production) or filesystem (local)
  const kv = getKVStorage();

  // Auto-migrate: If settings don't exist in Redis yet, migrate them from filesystem
  // This ensures the first roster update migrates all data to Redis for persistence
  try {
    const settingsData = await kv.read(userId, 'settings');
    if (!settingsData) {
      console.log(`[data-loader] Settings not in Redis, auto-migrating for ${userId}...`);
      // Load current context from filesystem
      const context = await loadUserContext(userId);
      // Write settings and free_agents to Redis
      await writeUserSettings(userId, context.league_profile);
      await writeUserFreeAgents(userId, context.free_agents);
      console.log(`[data-loader] Auto-migration complete for ${userId}`);
    }
  } catch (error) {
    console.warn('[data-loader] Auto-migration check failed:', error);
  }

  await kv.write(userId, 'roster', data);

  // Also write to filesystem for compatibility
  try {
    const dir = resolveUserDir(userId, true);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(join(dir, ROSTER_FILE), data, 'utf8');
  } catch (error) {
    console.warn('[data-loader] Filesystem write failed (expected in serverless):', error);
  }
}

export async function writeUserFreeAgents(userId: string, freeAgents: FreeAgent[]): Promise<void> {
  const data = `${JSON.stringify({ free_agents: freeAgents }, null, 2)}\n`;

  // Write to KV (production) or filesystem (local)
  const kv = getKVStorage();
  await kv.write(userId, 'free_agents', data);

  // Also write to filesystem for compatibility
  try {
    const dir = resolveUserDir(userId, true);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(join(dir, FREE_AGENTS_FILE), data, 'utf8');
  } catch (error) {
    console.warn('[data-loader] Filesystem write failed (expected in serverless):', error);
  }
}

export async function writeUserSnapshot(userId: string, context: UserContext): Promise<void> {
  const dir = resolveUserDir(userId, true);
  await fsp.mkdir(dir, { recursive: true });
  const serialized = `${JSON.stringify(context, null, 2)}\n`;
  await Promise.all([
    fsp.writeFile(join(dir, SNAPSHOT_FILE), serialized, 'utf8'),
    fsp.writeFile(join(ensureUserContextRoot(), `${userId}.json`), serialized, 'utf8')
  ]);
}

// Position Override Functions
export async function loadPositionOverrides(userId: string): Promise<PositionOverrides> {
  const kv = getKVStorage();

  try {
    // Try to load from KV storage first
    const data = await kv.read(userId, 'position_overrides');
    if (data) {
      return PositionOverridesSchema.parse(JSON.parse(data));
    }
  } catch (error) {
    console.warn(`[data-loader] Failed to load position overrides from KV for ${userId}:`, error);
  }

  // Fallback to filesystem for backward compatibility
  const dir = resolveUserDir(userId, false);
  if (!dir) {
    return { overrides: [] };
  }

  const path = join(dir, POSITION_OVERRIDES_FILE);
  if (!existsSync(path)) {
    return { overrides: [] };
  }

  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return PositionOverridesSchema.parse(parsed);
  } catch (error) {
    console.warn(`[data-loader] Failed to load position overrides for ${userId}:`, error);
    return { overrides: [] };
  }
}

export async function writePositionOverrides(userId: string, overrides: PositionOverrides): Promise<void> {
  console.log('[writePositionOverrides] Starting write for userId:', userId);
  console.log('[writePositionOverrides] Overrides to write:', JSON.stringify(overrides, null, 2));

  // Write to KV storage first (primary storage for production)
  const kv = getKVStorage();
  await kv.write(userId, 'position_overrides', JSON.stringify(overrides));
  console.log('[writePositionOverrides] Written to KV storage successfully');

  // Also write to filesystem for compatibility/local dev
  try {
    const dir = resolveUserDir(userId, true);
    await fsp.mkdir(dir, { recursive: true });
    const serialized = `${JSON.stringify(overrides, null, 2)}\n`;
    await fsp.writeFile(join(dir, POSITION_OVERRIDES_FILE), serialized, 'utf8');
    console.log('[writePositionOverrides] File written successfully');
  } catch (fsError) {
    console.warn('[writePositionOverrides] Filesystem write failed (non-fatal):', fsError);
    // Don't throw - KV write succeeded which is what matters in production
  }
}

export async function addPositionOverride(
  userId: string,
  playerId: string,
  positions: string[],
  updatedBy?: string,
  notes?: string
): Promise<void> {
  console.log('[addPositionOverride] Called with:', { userId, playerId, positions, updatedBy, notes });

  const current = await loadPositionOverrides(userId);
  console.log('[addPositionOverride] Current overrides:', current);

  const now = new Date().toISOString();

  // Remove existing override for this player if any
  const filtered = current.overrides.filter(o => o.player_id !== playerId);

  // Add new override
  const newOverride: PositionOverride = {
    player_id: playerId,
    positions,
    updated_at: now,
    updated_by: updatedBy,
    notes
  };
  console.log('[addPositionOverride] New override to add:', newOverride);

  const finalOverrides = {
    ...current,
    overrides: [...filtered, newOverride]
  };
  console.log('[addPositionOverride] Final overrides object:', finalOverrides);

  await writePositionOverrides(userId, finalOverrides);
  console.log('[addPositionOverride] writePositionOverrides completed');
}

export async function removePositionOverride(userId: string, playerId: string): Promise<void> {
  const current = await loadPositionOverrides(userId);
  const filtered = current.overrides.filter(o => o.player_id !== playerId);

  await writePositionOverrides(userId, {
    ...current,
    overrides: filtered
  });
}

export function getPlayerPositions(
  playerId: string,
  basePositions: string[],
  overrides: PositionOverrides
): string[] {
  const override = overrides.overrides.find(o => o.player_id === playerId);
  if (override) {
    // Replace base positions with override positions (allows both adding and removing)
    return override.positions;
  }
  return basePositions;
}
