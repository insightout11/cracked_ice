import { STATS_PATH } from '../../../apps/api/src/config/cachePaths';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface GoalieStats {
  wins: number;
  losses: number;
  overtimeLosses: number;
  gamesPlayed: number;
  gamesStarted: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number;
  gaa: number;
  shutouts: number;
  toi: string;
}

export interface SkaterStats {
  goals: number;
  assists: number;
  points: number;
  gamesPlayed: number;
  shots: number;
  shootingPct: number;
  blocks: number;
  plusMinus: number;
  ppGoals: number;
  ppAssists: number;
  ppPoints: number;
  shGoals: number;
  shAssists: number;
  shPoints: number;
  hits: number;
  gameWinningGoals: number;
  toi: string;
  faceoffWinPct?: number;
}

export interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  fppg?: number;
  team?: string;
}

export interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  careerAvgPPG: number;
  bestSeason: string;
  bestSeasonPPG: number;
}

export interface PlayerBio {
  birthDate?: string;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  heightInInches?: number;
  weightInPounds?: number;
  shootsCatches?: string;
  sweaterNumber?: number;
  draftYear?: number;
  draftTeam?: string;
  draftRound?: number;
  draftPickInRound?: number;
  draftOverallPick?: number;
}

export interface PlayerStatsSnapshot {
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  blendedFppg: number;
  goalieStats?: GoalieStats;
  skaterStats?: SkaterStats;
  last30GoalieStats?: GoalieStats;
  last30SkaterStats?: SkaterStats;
  last7GoalieStats?: GoalieStats;
  last7SkaterStats?: SkaterStats;
  careerHistory?: Record<string, CareerSeasonStats>;
  careerSummary?: CareerSummary;
  bio?: PlayerBio;
}

interface StatsFile {
  schemaVersion?: string;
  generatedAt?: string;
  source?: string;
  players?: Record<string, PlayerStatsSnapshot>;
}

export interface StatsContext {
  meta: {
    schemaVersion: string | null;
    generatedAt: string | null;
    source: string | null;
    sourcePath: string | null;
    playerCount: number;
  };
  players: Map<string, PlayerStatsSnapshot>;
}

const LEGACY_STATS_PATHS = [
  join(process.cwd(), 'apps', 'api', 'cache', 'stats.json'),
  join(process.cwd(), 'cache', 'stats.json'),
  join(process.cwd(), 'server', 'data', 'stats.json')
];

let warnedLegacyStats = false;

const STATS_PATH_CANDIDATES = [
  STATS_PATH,
  ...LEGACY_STATS_PATHS,
  typeof __dirname === 'string' ? join(__dirname, '..', 'data', 'stats.json') : undefined,
  join(process.cwd(), 'data', 'stats.json'),
  join(process.cwd(), 'server', 'data', 'stats.json')
].filter((candidate): candidate is string => Boolean(candidate));

function resolveStatsPath(): string {
  if (existsSync(STATS_PATH)) {
    return STATS_PATH;
  }

  const legacyPath = LEGACY_STATS_PATHS.find((candidate) => existsSync(candidate));
  if (legacyPath) {
    if (!warnedLegacyStats) {
      warnedLegacyStats = true;
      console.warn('[stats] Using legacy cache path:', legacyPath);
    }
    return legacyPath;
  }

  const fallback = STATS_PATH_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!fallback) {
    throw new Error(`Stats cache not found. Checked: ${STATS_PATH_CANDIDATES.join(', ')}`);
  }
  return fallback;
}
export function loadStats(): StatsContext {
  console.log('[stats] Loading stats...');
  console.log('[stats] Checking paths:', STATS_PATH_CANDIDATES);
  console.log('[stats] cwd:', process.cwd());

  const path = resolveStatsPath();
  console.log('[stats] Resolved path:', path);

  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as StatsFile;

  if (!parsed.players || typeof parsed.players !== 'object') {
    throw new Error('Stats cache is missing player records');
  }

  const players = new Map<string, PlayerStatsSnapshot>(Object.entries(parsed.players));

  console.log('[stats] Loaded', players.size, 'player stats from', path);

  return {
    meta: {
      schemaVersion: parsed.schemaVersion ?? null,
      generatedAt: parsed.generatedAt ?? null,
      source: parsed.source ?? null,
      sourcePath: path,
      playerCount: players.size
    },
    players
  };
}

export function getPlayerStats(
  playerId: string,
  context: StatsContext | null | undefined
): PlayerStatsSnapshot | undefined {
  if (!context) return undefined;
  return context.players.get(playerId);
}



