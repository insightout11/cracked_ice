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
  // Skater stats
  goals?: number;
  assists?: number;
  points?: number;
  // Goalie stats
  wins?: number;
  losses?: number;
  overtimeLosses?: number;
  goalsAgainst?: number;
  goalsAgainstAverage?: number;
  savePct?: number;
  shutouts?: number;
  // Common
  fppg?: number;
  team?: string;
}

export interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  // Skater summary
  careerAvgPPG?: number;
  bestSeason?: string;
  bestSeasonPPG?: number;
  // Goalie summary
  careerWinPct?: number;
  careerGAA?: number;
  careerSavePct?: number;
  totalWins?: number;
  totalShutouts?: number;
  bestSeasonGAA?: number;
  bestSeasonSavePct?: number;
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

export type InjuryStatusType =
  | 'HEALTHY'
  | 'INACTIVE'
  | 'IR'          // Future
  | 'IR_PLUS'     // Future
  | 'DTD'         // Future
  | 'OUT'         // Future
  | 'QUESTIONABLE'; // Future

export interface AdvancedStats {
  // Power play
  ppTimeOnIcePerGame?: number;
  ppGoalsForPer60?: number;
  ppIndividualSatFor?: number;

  // Penalty kill
  shTimeOnIcePerGame?: number;
  ppGoalsAgainstPer60?: number;
  shIndividualSatFor?: number;

  // Realtime
  giveaways?: number;
  giveawaysPer60?: number;
  takeaways?: number;
  takeawaysPer60?: number;
  hitsPer60?: number;
  blockedShotsPer60?: number;

  // Faceoffs by zone
  defensiveZoneFaceoffPct?: number;
  offensiveZoneFaceoffPct?: number;
  neutralZoneFaceoffPct?: number;

  // Average TOI tracking (for role trend analysis)
  avgToiPerGame?: number;  // Overall average TOI in seconds
  gamesPlayed?: number;    // Games played in window (for validation)
}

export interface GameLogEntry {
  gameDate: string;
  opponent?: string;
  isHome?: boolean;
  teamResult?: 'W' | 'L' | 'OTL' | 'SOL';
  teamScore?: string;
  teamGoalsFor?: number;
  teamGoalsAgainst?: number;
  toi?: string;
  toiSeconds?: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus?: number;
  shots: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shorthandedPoints: number;
  hits?: number;
  blocks?: number;
  pim?: number;
  gamesStarted?: number;
  decision?: 'W' | 'L' | 'O';
  saves?: number;
  shotsAgainst?: number;
  goalsAgainst?: number;
  savePct?: number;
  gaa?: number;
  shutout?: boolean;
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
  injuryStatus?: InjuryStatusType;
  isActive?: boolean;
  advancedStats?: AdvancedStats;
  last7AdvancedStats?: AdvancedStats; // Last 7 days advanced stats for role trend calculation
  gameLog?: GameLogEntry[]; // Game-by-game performance log
}

interface StatsFile {
  schemaVersion?: string;
  generatedAt?: string;
  source?: string;
  players?: Record<string, PlayerStatsSnapshot>;
}

function totalToiSeconds(value: string): number {
  if (!value) return 0;
  if (!value.includes(':')) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds : 0;
  }
  const [minutes, seconds] = value.split(':').map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? (minutes * 60) + seconds : 0;
}

export function normalizeGoalieStats(stats: GoalieStats | undefined): GoalieStats | undefined {
  if (!stats) return undefined;
  const derivedSaves = Math.max(0, stats.shotsAgainst - stats.goalsAgainst);
  const saves = stats.saves > 0 ? stats.saves : derivedSaves;
  const savePct = stats.savePct > 0 || stats.shotsAgainst <= 0
    ? stats.savePct
    : Number((saves / stats.shotsAgainst).toFixed(5));
  const toiSeconds = totalToiSeconds(stats.toi);
  const gaa = stats.gaa > 0
    ? stats.gaa
    : stats.goalsAgainst > 0 && toiSeconds > 0
      ? Number(((stats.goalsAgainst * 3600) / toiSeconds).toFixed(5))
      : stats.gamesPlayed > 0
        ? Number((stats.goalsAgainst / stats.gamesPlayed).toFixed(5))
        : 0;
  return { ...stats, saves, savePct, gaa };
}

function normalizeSnapshot(snapshot: PlayerStatsSnapshot): PlayerStatsSnapshot {
  return {
    ...snapshot,
    goalieStats: normalizeGoalieStats(snapshot.goalieStats),
    last30GoalieStats: normalizeGoalieStats(snapshot.last30GoalieStats),
    last7GoalieStats: normalizeGoalieStats(snapshot.last7GoalieStats),
  };
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

  const players = new Map<string, PlayerStatsSnapshot>(
    Object.entries(parsed.players).map(([id, snapshot]) => [id, normalizeSnapshot(snapshot)])
  );

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



