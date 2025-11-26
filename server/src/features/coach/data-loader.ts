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
  LeagueSettingsSchema
} from './types';
import {
  MAX_FREE_AGENT_CANDIDATES,
  MAX_DROP_CANDIDATES
} from './constants';

export interface LoadedUserContext extends UserContext {
  roster: Player[];
  free_agents: FreeAgent[];
}

export const USER_CONTEXT_DIR_CANDIDATES = [
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

export const USER_CONTEXT_FILES = {
  settings: SETTINGS_FILE,
  roster: ROSTER_FILE,
  freeAgents: FREE_AGENTS_FILE,
  snapshot: SNAPSHOT_FILE
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
  const existing = findExistingRoot();
  if (existing) {
    return existing;
  }

  const fallback = USER_CONTEXT_DIR_CANDIDATES[0];
  if (!fallback) {
    throw new Error('No coach user directory candidates configured');
  }
  mkdirSync(fallback, { recursive: true });
  cachedRoot = fallback;
  return fallback;
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

function loadFromLegacy(userId: string): LoadedUserContext {
  const legacyPath = findLegacyContextPath(userId);
  if (!legacyPath) {
    throw new Error(`User context not found for ${userId}`);
  }

  const sanitized = readFileSync(legacyPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(sanitized);
  const context = UserContextSchema.parse(parsed);
  return truncatePools(userId, context);
}

function loadFromSplit(userId: string, userDir: string): LoadedUserContext {
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

  return truncatePools(userId, context);
}

function truncatePools(userId: string, context: UserContext): LoadedUserContext {
  const { roster, free_agents } = context;

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

export function loadUserContext(userId: string): LoadedUserContext {
  const root = findExistingRoot();
  if (root) {
    const userDir = join(root, userId);
    if (existsSync(userDir) && statSync(userDir).isDirectory()) {
      return loadFromSplit(userId, userDir);
    }
  }

  return loadFromLegacy(userId);
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

export function getUserStatus(userId: string): UserStatusSummary {
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
    loadUserContext(userId);
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
  const dir = resolveUserDir(userId, true);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(
    join(dir, SETTINGS_FILE),
    `${JSON.stringify(profile, null, 2)}\n`,
    'utf8'
  );
}

export async function writeUserRoster(userId: string, roster: Player[]): Promise<void> {
  const dir = resolveUserDir(userId, true);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(
    join(dir, ROSTER_FILE),
    `${JSON.stringify({ roster }, null, 2)}\n`,
    'utf8'
  );
}

export async function writeUserFreeAgents(userId: string, freeAgents: FreeAgent[]): Promise<void> {
  const dir = resolveUserDir(userId, true);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(
    join(dir, FREE_AGENTS_FILE),
    `${JSON.stringify({ free_agents: freeAgents }, null, 2)}\n`,
    'utf8'
  );
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
