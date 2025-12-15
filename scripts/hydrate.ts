import { mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const FIXTURES_DIR = join(DATA_DIR, 'fixtures');
const CACHE_DIR = join(ROOT, 'cache');
const REPO_ROOT = join(ROOT, '..', '..');
const SERVER_DATA_DIR = join(REPO_ROOT, 'server', 'data');

const CACHE_SCHEMA_VERSION = 'v1';

const NHL_STATS_BASE = process.env.NHL_STATS_BASE ?? 'https://statsapi.web.nhl.com';
const HYDRATE_TIMEOUT_MS = Number(process.env.HYDRATE_TIMEOUT_MS ?? '20000');
const REQUEST_DELAY_MS = 250;

const MAX_FETCH_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const JITTER_MS = 200;

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA ?? 'public';
const SUPABASE_BUCKET = process.env.SUPABASE_CACHE_BUCKET ?? '';

let supabase: SupabaseClient | null = null;

interface FixtureSchedule {
  [team: string]: string[];
  _offnight?: string[];
}

interface ServerScheduleFile {
  season: string;
  teams: Record<string, string[]>;
}

interface ScheduleEntry {
  date: string;
  isOffNight: boolean;
}

interface ScheduleCacheFile {
  schemaVersion: string;
  generatedAt: string;
  source: string;
  teams: Record<string, ScheduleEntry[]>;
}

interface PlayerStatsRecord {
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  blendedFppg: number;
}

interface StatsCacheFile {
  schemaVersion: string;
  generatedAt: string;
  source: string;
  weights: { season: number; last30: number; last7: number };
  players: Record<string, PlayerStatsRecord>;
}

const BLEND_WEIGHTS = { season: 0.5, last30: 0.3, last7: 0.2 } as const;
const OFF_NIGHT_GAME_THRESHOLD = 8;
const DEFAULT_SCORING = {
  goals: 3,
  assists: 2,
  shots: 0.4,
  blocks: 0.6,
  powerPlayPoints: 0.5
} as const;

type ScoringWeights = typeof DEFAULT_SCORING;

function ensureCacheDir(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
}

function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_BUCKET) {
    return null;
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });
    console.log(`[hydrate] Connected to Supabase schema: ${SUPABASE_SCHEMA}`);
  }
  return supabase;
}

async function uploadCachePayload(client: SupabaseClient, remotePath: string, payload: Buffer | string): Promise<boolean> {
  const dataBuffer = typeof payload === 'string' ? Buffer.from(payload) : payload;
  console.log(`[hydrate] Uploading ${remotePath} ...`);
  const { error } = await client.storage.from(SUPABASE_BUCKET).upload(remotePath, dataBuffer, {
    upsert: true,
    contentType: 'application/json'
  });
  if (error) {
    console.warn(`[hydrate] Cache upload error for ${remotePath}: ${error.message}`);
    return false;
  }
  console.log(`[hydrate] Cache upload success: ${remotePath}`);
  return true;
}

function findLatestServerSchedule(): string | null {
  try {
    const entries = readdirSync(SERVER_DATA_DIR)
      .filter((name) => name.startsWith('schedules-') && name.endsWith('.json'))
      .sort();
    if (!entries.length) {
      return null;
    }
    return join(SERVER_DATA_DIR, entries[entries.length - 1]);
  } catch {
    return null;
  }
}

function computeOffNights(teams: Record<string, string[]>): Set<string> {
  const counts = new Map<string, number>();
  for (const dates of Object.values(teams)) {
    const seen = new Set<string>();
    for (const date of dates) {
      if (seen.has(date)) continue;
      seen.add(date);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  const offNights = new Set<string>();
  for (const [date, teamCount] of counts.entries()) {
    const games = teamCount / 2;
    if (games <= OFF_NIGHT_GAME_THRESHOLD) {
      offNights.add(date);
    }
  }
  return offNights;
}

function normaliseTeamDates(raw: Record<string, string[]>, offNights: Set<string>): Record<string, ScheduleEntry[]> {
  const teams: Record<string, ScheduleEntry[]> = {};
  for (const [team, dates] of Object.entries(raw)) {
    const unique = Array.from(new Set(dates)).sort();
    teams[team] = unique.map((date) => ({
      date,
      isOffNight: offNights.has(date)
    }));
  }
  return teams;
}

function hydrateSchedule(generatedAt: string): { payload: ScheduleCacheFile; season: string | null } {
  const serverSchedulePath = findLatestServerSchedule();

  if (serverSchedulePath) {
    try {
      const raw = JSON.parse(readFileSync(serverSchedulePath, 'utf8')) as ServerScheduleFile;
      const offNights = computeOffNights(raw.teams);
      return {
        payload: {
          schemaVersion: CACHE_SCHEMA_VERSION,
          generatedAt,
          source: `server/data/${basename(serverSchedulePath)}`,
          teams: normaliseTeamDates(raw.teams, offNights)
        },
        season: raw.season
      };
    } catch (error) {
      console.warn(`[hydrate] Failed to read server schedule (${serverSchedulePath}):`, (error as Error).message);
    }
  }

  const fallbackPath = join(DATA_DIR, 'schedule.sample.json');
  const fallbackRaw = JSON.parse(readFileSync(fallbackPath, 'utf8')) as FixtureSchedule;
  const { _offnight, ...teams } = fallbackRaw;
  const offNights = new Set(_offnight ?? []);

  return {
    payload: {
      schemaVersion: CACHE_SCHEMA_VERSION,
      generatedAt,
      source: 'sample-fixture',
      teams: normaliseTeamDates(teams, offNights)
    },
    season: null
  };
}

function deriveSeasonFromToday(): string {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const startYear = month < 6 ? year - 1 : year;
  const endYear = startYear + 1;
  return `${startYear}${endYear}`;
}

function getScoringWeights(): ScoringWeights {
  try {
    const files = readdirSync(FIXTURES_DIR).filter((name) => name.startsWith('league') && name.endsWith('.json'));
    for (const file of files) {
      const payload = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as { scoring?: Record<string, number> };
      if (payload.scoring) {
        const { goals, assists, shots_on_goal, blocks, power_play_points } = payload.scoring;
        if (typeof goals === 'number' && typeof assists === 'number') {
          return {
            goals,
            assists,
            shots: shots_on_goal ?? DEFAULT_SCORING.shots,
            blocks: blocks ?? DEFAULT_SCORING.blocks,
            powerPlayPoints: power_play_points ?? DEFAULT_SCORING.powerPlayPoints
          } as ScoringWeights;
        }
      }
    }
  } catch (error) {
    console.warn('[hydrate] Failed to read scoring weights from fixtures:', (error as Error).message);
  }
  return DEFAULT_SCORING;
}

function collectPlayerIds(): string[] {
  const ids = new Set<string>();
  try {
    const playersPayload = JSON.parse(readFileSync(join(DATA_DIR, 'players.json'), 'utf8')) as { players?: { id?: string }[] };
    playersPayload.players?.forEach((player) => {
      if (player.id?.startsWith('nhl:')) ids.add(player.id);
    });
  } catch (error) {
    console.warn('[hydrate] Failed to read players.json:', (error as Error).message);
  }

  try {
    const fixtureFiles = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith('.json'));
    for (const file of fixtureFiles) {
      const payload = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8'));
      const candidates = payload?.players ?? payload?.candidates ?? [];
      for (const entry of candidates) {
        if (typeof entry?.id === 'string' && entry.id.startsWith('nhl:')) {
          ids.add(entry.id);
        }
      }
    }
  } catch (error) {
    console.warn('[hydrate] Failed to read fixtures:', (error as Error).message);
  }

  return Array.from(ids);
}

function toNumericId(playerId: string): string {
  return playerId.replace(/^nhl:/, '');
}

function safeDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HYDRATE_TIMEOUT_MS);
  try {
    const response = await fetch(`${NHL_STATS_BASE}${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry<T>(path: string, label: string): Promise<T | null> {
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchWithTimeout<T>(path);
    } catch (error) {
      if (attempt === MAX_FETCH_ATTEMPTS - 1) {
        console.warn(`[hydrate] ${label} failed after ${MAX_FETCH_ATTEMPTS} attempts: ${(error as Error).message}`);
        return null;
      }
      const backoff = BASE_RETRY_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * JITTER_MS);
      await delay(backoff);
    }
  }
  return null;
}

function computeFantasyPoints(stat: any, weights: ScoringWeights): number {
  if (!stat) return 0;
  const goals = Number(stat.goals ?? 0);
  const assists = Number(stat.assists ?? 0);
  const shots = Number(stat.shots ?? stat.shotsOnGoal ?? 0);
  const blocks = Number(stat.blocked ?? stat.blocks ?? 0);
  const powerPlayPoints = Number(stat.powerPlayPoints ?? 0);
  return (
    goals * weights.goals +
    assists * weights.assists +
    shots * weights.shots +
    blocks * weights.blocks +
    powerPlayPoints * weights.powerPlayPoints
  );
}

interface StatsSingleSeasonResponse {
  stats: Array<{ splits: Array<{ stat: any }> }>;
}

interface GameLogResponse {
  stats: Array<{ splits: Array<{ date?: string; gameDate?: string; stat: any }> }>;
}

function calculateFppg(totalPoints: number, games: number): number {
  if (!games || games <= 0) return 0;
  return Number((totalPoints / games).toFixed(2));
}

interface NHLPlayerLanding {
  currentTeamAbbrev?: string;
  firstName?: { default?: string };
  lastName?: { default?: string };
}

async function hydratePlayerTeams(): Promise<void> {
  const playersPath = join(DATA_DIR, 'players.json');
  let playersData: { players: any[] };

  try {
    playersData = JSON.parse(readFileSync(playersPath, 'utf8'));
  } catch (error) {
    console.warn('[hydrate] Failed to read players.json:', (error as Error).message);
    return;
  }

  if (!playersData.players || !Array.isArray(playersData.players)) {
    console.warn('[hydrate] Invalid players.json structure');
    return;
  }

  let updatedCount = 0;
  const totalPlayers = playersData.players.length;

  for (const player of playersData.players) {
    if (!player.id?.startsWith('nhl:')) continue;

    const numericId = toNumericId(player.id);

    try {
      const response = await fetch(`https://api-web.nhle.com/v1/player/${numericId}/landing`);
      if (!response.ok) {
        await delay(REQUEST_DELAY_MS);
        continue;
      }

      const data = await response.json() as NHLPlayerLanding;
      const currentTeam = data.currentTeamAbbrev;

      if (currentTeam && currentTeam !== player.team) {
        console.log(`[hydrate] Team change: ${player.name} ${player.team} → ${currentTeam}`);
        player.team = currentTeam;
        updatedCount++;
      }

      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      console.warn(`[hydrate] Failed to fetch team for ${player.name}:`, (error as Error).message);
      await delay(REQUEST_DELAY_MS);
    }
  }

  if (updatedCount > 0) {
    const tempPath = `${playersPath}.tmp`;
    const jsonContent = JSON.stringify(playersData, null, 2);
    writeFileSync(tempPath, jsonContent, 'utf8');
    renameSync(tempPath, playersPath);
    console.log(`[hydrate] Updated ${updatedCount} player team assignments in players.json`);

    // Also update the root data/ directory
    const rootDataPlayersPath = join(REPO_ROOT, 'data', 'players.json');
    try {
      const rootTempPath = `${rootDataPlayersPath}.tmp`;
      writeFileSync(rootTempPath, jsonContent, 'utf8');
      renameSync(rootTempPath, rootDataPlayersPath);
      console.log(`[hydrate] Synced player teams to data/players.json`);
    } catch (error) {
      console.warn('[hydrate] Failed to sync to data/players.json:', (error as Error).message);
    }
  } else {
    console.log(`[hydrate] No player team changes detected (checked ${totalPlayers} players)`);
  }
}

async function hydrateStats(seasonFromSchedule: string | null, generatedAt: string): Promise<StatsCacheFile | null> {
  const playerIds = collectPlayerIds();
  if (!playerIds.length) {
    console.warn('[hydrate] No player IDs found; skipping stats hydration.');
    return null;
  }

  const weights = getScoringWeights();
  const resolvedSeason = process.env.NHL_SEASON ?? seasonFromSchedule ?? deriveSeasonFromToday();
  const seasonParam = resolvedSeason;
  const seasonLabel = `statsSingleSeason:${seasonParam}`;

  const stats: Record<string, PlayerStatsRecord> = {};
  let successCount = 0;

  const now = new Date();
  const thirtyAgo = new Date(now);
  thirtyAgo.setUTCDate(thirtyAgo.getUTCDate() - 30);
  const sevenAgo = new Date(now);
  sevenAgo.setUTCDate(sevenAgo.getUTCDate() - 7);

  for (const playerId of playerIds) {
    const numericId = toNumericId(playerId);
    const seasonUrl = `/api/v1/people/${numericId}/stats?stats=statsSingleSeason&season=${seasonParam}`;
    const gameLogUrl = `/api/v1/people/${numericId}/stats?stats=gameLog&season=${seasonParam}`;

    const seasonData = await fetchJsonWithRetry<StatsSingleSeasonResponse>(seasonUrl, `statsSingleSeason ${playerId}`);
    if (!seasonData) {
      await delay(REQUEST_DELAY_MS);
      continue;
    }

    const gameLogData = await fetchJsonWithRetry<GameLogResponse>(gameLogUrl, `gameLog ${playerId}`);
    if (!gameLogData) {
      await delay(REQUEST_DELAY_MS);
      continue;
    }

    const seasonSplit = seasonData.stats?.[0]?.splits?.[0]?.stat ?? null;
    const gamesPlayed = Number(seasonSplit?.games ?? 0);
    const seasonPoints = computeFantasyPoints(seasonSplit, weights);
    const seasonFppg = calculateFppg(seasonPoints, gamesPlayed);

    const splits = gameLogData.stats?.[0]?.splits ?? [];
    let points30 = 0;
    let games30 = 0;
    let points7 = 0;
    let games7 = 0;

    for (const split of splits) {
      const dateString = split.date ?? split.gameDate;
      const date = safeDate(dateString);
      if (!date) continue;
      const fantasyPoints = computeFantasyPoints(split.stat, weights);
      if (date >= thirtyAgo) {
        points30 += fantasyPoints;
        games30 += 1;
      }
      if (date >= sevenAgo) {
        points7 += fantasyPoints;
        games7 += 1;
      }
    }

    const last30Fppg = calculateFppg(points30, games30);
    const last7Fppg = calculateFppg(points7, games7);
    const blendedFppg = Number(
      (
        seasonFppg * BLEND_WEIGHTS.season +
        last30Fppg * BLEND_WEIGHTS.last30 +
        last7Fppg * BLEND_WEIGHTS.last7
      ).toFixed(2)
    );

    stats[playerId] = {
      seasonFppg,
      last30Fppg,
      last7Fppg,
      blendedFppg
    };

    successCount += 1;
    await delay(REQUEST_DELAY_MS);
  }

  const totalPlayers = playerIds.length;
  const successRatio = totalPlayers > 0 ? successCount / totalPlayers : 0;
  const percent = Math.round(successRatio * 100);
  console.log(`[hydrate] Stats hydration summary: ${successCount}/${totalPlayers} players (${percent}%)`);

  if (successCount === 0 || successRatio < 0.8) {
    console.warn('[hydrate] Stats hydration below threshold; retaining previous cache.');
    return null;
  }

  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    generatedAt,
    source: seasonLabel,
    weights: { ...BLEND_WEIGHTS },
    players: stats
  };
}

async function main(): Promise<void> {
  ensureCacheDir();

  const syncTimestamp = new Date().toISOString();

  // Hydrate player teams first (trades, roster moves)
  console.log('[hydrate] Checking for player team changes...');
  await hydratePlayerTeams();

  const { payload: schedulePayload, season } = hydrateSchedule(syncTimestamp);
  const schedulePath = join(CACHE_DIR, 'schedule.json');
  writeFileSync(schedulePath, JSON.stringify(schedulePayload, null, 2), 'utf8');

  const statsPayload = await hydrateStats(season, syncTimestamp);
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    console.log('[hydrate] Supabase env not configured; skipping remote uploads.');
  }

  let statsUploaded = false;
  let scheduleUploaded = false;

  if (statsPayload) {
    const statsPath = join(CACHE_DIR, 'stats.json');
    const tempPath = `${statsPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(statsPayload, null, 2), 'utf8');
    renameSync(tempPath, statsPath);
    console.log('[hydrate] Wrote cache/stats.json');

    if (supabaseClient) {
      const prefix = `cache/v1/${statsPayload.generatedAt}`;
      statsUploaded = await uploadCachePayload(supabaseClient, `${prefix}/stats.json`, readFileSync(statsPath));
      scheduleUploaded = await uploadCachePayload(supabaseClient, `${prefix}/schedule.json`, readFileSync(schedulePath));
      if (statsUploaded && scheduleUploaded) {
        const pointerPayload = JSON.stringify({ ts: statsPayload.generatedAt }, null, 2);
        await uploadCachePayload(supabaseClient, 'cache/v1/latest.json', pointerPayload);
      }
    }
  } else {
    console.warn('[hydrate] Skipped stats cache update.');
    if (supabaseClient) {
      const prefix = `cache/v1/${syncTimestamp}`;
      scheduleUploaded = await uploadCachePayload(supabaseClient, `${prefix}/schedule.json`, readFileSync(schedulePath));
      if (scheduleUploaded) {
        const pointerPayload = JSON.stringify({ ts: syncTimestamp }, null, 2);
        await uploadCachePayload(supabaseClient, 'cache/v1/latest.json', pointerPayload);
      }
    }
  }

  console.log('[hydrate] Wrote cache/schedule.json');
}

main().catch((error) => {
  console.error('[hydrate] Unexpected failure:', error);
  process.exitCode = 1;
});