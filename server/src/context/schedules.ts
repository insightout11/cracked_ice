import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Inlined schedule utilities to avoid module resolution issues
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const OFF_NIGHTS = new Set(['Mon', 'Wed', 'Fri', 'Sun']);

function weekdayOf(dateStr: string) {
  return WD[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
}

function calculateUsableStarts(teamCombination: string[], scheduleContext: any, slotsPerDay = 2): number {
  const perDayCount: Record<string, number> = {};

  for (const teamCode of teamCombination) {
    const teamDates = scheduleContext.sets.get(teamCode);
    if (!teamDates) continue;

    for (const date of teamDates) {
      perDayCount[date] = (perDayCount[date] || 0) + 1;
    }
  }

  let score = 0;
  for (const count of Object.values(perDayCount)) {
    score += Math.min(slotsPerDay, count);
  }

  return score;
}

function calculateOffNightPct(teamCombination: string[], scheduleContext: any): number {
  const uniqueDates = new Set<string>();

  for (const teamCode of teamCombination) {
    const teamDates = scheduleContext.sets.get(teamCode);
    if (!teamDates) continue;

    for (const date of teamDates) {
      uniqueDates.add(date);
    }
  }

  if (uniqueDates.size === 0) return 0;

  let offNightCount = 0;
  for (const date of uniqueDates) {
    if (OFF_NIGHTS.has(weekdayOf(date))) {
      offNightCount++;
    }
  }

  return offNightCount / uniqueDates.size;
}

interface ScheduleData {
  season: string;
  teams: Record<string, string[]>;
  games?: Record<string, GameDetails[]>;
  lastRefreshed: string;
}

interface GameDetails {
  date: string;
  opponent: string;
  isHome: boolean;
  gameId?: number;
  venue?: string;
  startTime?: string;
}

interface CacheScheduleEntry {
  date?: string;
  isOffNight?: boolean;
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
}

export interface GameMeta {
  date: string;
  startTime: string;
  opponent: string;
  isHome: boolean;
  isOffNight: boolean;
}

interface BestMatch {
  teams: string[];
  usableStarts: number;
  offNightPct: number;
  uniqueDays: number;
}

export interface ScheduleContext {
  meta: {
    season: string;
    lastRefreshed: string;
    teamCount: number;
  };
  sets: Map<string, Set<string>>;
  teamNameMap: Map<string, string>; // triCode -> full name
  idToTriCodeMap: Map<number, string>; // numeric ID -> triCode
  bestMatches: {
    2: BestMatch[];
    3: BestMatch[];
    4: BestMatch[];
  };
}

// Team ID to triCode mapping (all 32 NHL teams)
const TEAM_ID_MAP: Record<number, string> = {
  1: 'NJD', 2: 'NYI', 3: 'NYR', 4: 'PHI', 5: 'PIT', 6: 'BOS',
  7: 'BUF', 8: 'MTL', 9: 'OTT', 10: 'TOR', 12: 'CAR', 13: 'FLA',
  14: 'TBL', 15: 'WSH', 16: 'CHI', 17: 'DET', 18: 'NSH', 19: 'STL',
  20: 'CGY', 21: 'COL', 22: 'EDM', 23: 'VAN', 24: 'ANA', 25: 'DAL',
  26: 'LAK', 27: 'SJS', 28: 'CBJ', 29: 'MIN', 30: 'WPG', 53: 'VGK',
  54: 'SEA', 55: 'UTA'
};

const ENRICHED_SCHEDULE_CACHE_PATH_CANDIDATES = [
  join(process.cwd(), 'apps', 'api', 'data-cache', 'schedule.json'),
  join(process.cwd(), '..', 'apps', 'api', 'data-cache', 'schedule.json'),
  join(process.cwd(), 'data', 'schedule.json')
];
const GAME_META_REGISTRY = new WeakMap<ScheduleContext, Map<string, GameMeta[]>>();

export function loadSchedules(season = '20252026'): ScheduleContext {
  // Try multiple potential locations for schedules file
  const schedulesFileName = `schedules-${season}.json`;
  const candidatePaths = [
    join(process.cwd(), 'data', schedulesFileName),
    join(process.cwd(), '..', '..', 'data', schedulesFileName),
    join(process.cwd(), '..', 'data', schedulesFileName),
  ];

  let dataPath: string | null = null;
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      dataPath = candidate;
      break;
    }
  }

  if (!dataPath) {
    throw new Error(`Schedules not warmed—run npm run warm:schedules. Checked: ${candidatePaths.join(', ')}`);
  }

  const rawData = readFileSync(dataPath, 'utf8');
  const data: ScheduleData = JSON.parse(rawData);
  
  // Convert arrays to Sets for efficient set operations
  const sets = new Map<string, Set<string>>();
  const teamNameMap = new Map<string, string>();
  
  for (const [triCode, dates] of Object.entries(data.teams)) {
    sets.set(triCode, new Set(dates));
    // For now, use triCode as team name - can be enhanced later
    teamNameMap.set(triCode, getTeamName(triCode));
  }
  
  const idToTriCodeMap = new Map<number, string>();
  for (const [id, triCode] of Object.entries(TEAM_ID_MAP)) {
    idToTriCodeMap.set(parseInt(id), triCode);
  }
  
  const bestMatches = precomputeBestMatches(sets);

  // Try to load enriched schedule entries from cache first
  let enrichedEntries = loadEnrichedScheduleEntries();

  // If no enriched cache, use games from the schedules file as fallback
  if (!enrichedEntries && data.games) {
    console.log('📦 Using game details from schedules file (enriched cache not found)');
    enrichedEntries = convertGameDetailsToEntries(data.games);
  }

  const gameMetaMap = enrichedEntries ? buildGameMetaMap(enrichedEntries) : null;

  const context: ScheduleContext = {
    meta: {
      season: data.season,
      lastRefreshed: data.lastRefreshed,
      teamCount: Object.keys(data.teams).length
    },
    sets,
    teamNameMap,
    idToTriCodeMap,
    bestMatches
  };

  console.log(`📅 Loaded ${context.meta.teamCount} team schedules for ${season}`);
  console.log(`   Last refreshed: ${new Date(context.meta.lastRefreshed).toLocaleString()}`);
  console.log(`🔥 Precomputed best matches: 2-team (${bestMatches[2].length}), 3-team (${bestMatches[3].length}), 4-team (${bestMatches[4].length})`);

  if (gameMetaMap && gameMetaMap.size) {
    GAME_META_REGISTRY.set(context, gameMetaMap);
    console.log(`✨ Game metadata loaded for ${gameMetaMap.size} teams`);
  }

  return context;
}

function convertGameDetailsToEntries(games: Record<string, GameDetails[]>): Record<string, CacheScheduleEntry[]> {
  const entries: Record<string, CacheScheduleEntry[]> = {};

  for (const [teamCode, teamGames] of Object.entries(games)) {
    entries[teamCode] = teamGames.map(game => ({
      date: game.date,
      homeTeam: game.isHome ? teamCode : game.opponent,
      awayTeam: game.isHome ? game.opponent : teamCode,
      startTime: game.startTime,
      isOffNight: false // Will be computed later if needed
    }));
  }

  return entries;
}

function loadEnrichedScheduleEntries(): Record<string, CacheScheduleEntry[]> | null {
  let enrichedPath: string | null = null;

  for (const candidate of ENRICHED_SCHEDULE_CACHE_PATH_CANDIDATES) {
    if (existsSync(candidate)) {
      enrichedPath = candidate;
      break;
    }
  }

  if (!enrichedPath) {
    return null;
  }

  try {
    const raw = readFileSync(enrichedPath, 'utf8');
    const parsed = JSON.parse(raw) as { teams?: Record<string, CacheScheduleEntry[]> };
    return parsed.teams ?? null;
  } catch (error) {
    console.warn('[schedules] Failed to load enriched schedule cache:', (error as Error).message);
    return null;
  }
}

function buildGameMetaMap(entries: Record<string, CacheScheduleEntry[] | undefined>): Map<string, GameMeta[]> {
  const map = new Map<string, GameMeta[]>();

  for (const [team, records] of Object.entries(entries)) {
    if (!records) continue;
    const normalizedTeam = team.toUpperCase();
    const metas: GameMeta[] = [];

    for (const record of records) {
      const meta = createGameMeta(normalizedTeam, record);
      if (meta) {
        metas.push(meta);
      }
    }

    if (metas.length) {
      map.set(normalizedTeam, metas);
    }
  }

  return map;
}

function createGameMeta(teamCode: string, entry: CacheScheduleEntry): GameMeta | null {
  const date = entry?.date;
  if (!date) {
    return null;
  }

  const homeTeam = entry.homeTeam?.toUpperCase();
  const awayTeam = entry.awayTeam?.toUpperCase();
  if (!homeTeam || !awayTeam) {
    return null;
  }

  let opponent: string | null = null;
  let isHome = false;
  if (homeTeam === teamCode) {
    opponent = awayTeam;
    isHome = true;
  } else if (awayTeam === teamCode) {
    opponent = homeTeam;
    isHome = false;
  } else {
    return null;
  }

  return {
    date,
    startTime: entry.startTime ?? '',
    opponent,
    isHome,
    isOffNight: Boolean(entry.isOffNight)
  };
}

export function getTeamGameMeta(teamCode: string, context: ScheduleContext | null | undefined): GameMeta[] {
  if (!context) return [];
  const metaMap = GAME_META_REGISTRY.get(context);
  if (!metaMap) {
    return [];
  }
  return metaMap.get(teamCode.toUpperCase()) ?? [];
}

export function getTeamScheduleDates(teamCode: string, context: ScheduleContext | null | undefined): string[] {
  if (!context) return [];

  // Try enriched game meta first (includes opponent, time, etc.)
  const gameMeta = getTeamGameMeta(teamCode, context);
  if (gameMeta.length > 0) {
    return gameMeta.map(game => game.date);
  }

  // Fallback to raw schedule dates from context.sets
  const normalizedTeamCode = teamCode.toUpperCase();
  const teamDates = context.sets.get(normalizedTeamCode);
  if (teamDates) {
    return Array.from(teamDates).sort();
  }

  return [];
}

/**
 * Get count of unique NHL games within a date window
 * Returns number of unique games (each game counted once, not twice)
 */
export function getUniqueNHLGamesInWindow(
  context: ScheduleContext | null | undefined,
  startDate: string,
  endDate: string
): number {
  if (!context) return 0;

  const metaMap = GAME_META_REGISTRY.get(context);
  if (!metaMap) return 0;

  const uniqueGameIds = new Set<string>();

  // Iterate over all teams' games
  for (const [teamCode, games] of metaMap.entries()) {
    for (const game of games) {
      // Filter to window
      if (game.date >= startDate && game.date <= endDate) {
        // Create unique game ID (sort teams to avoid duplicates)
        const teams = [teamCode, game.opponent].sort();
        const gameId = `${game.date}-${teams[0]}-${teams[1]}`;
        uniqueGameIds.add(gameId);
      }
    }
  }

  return uniqueGameIds.size;
}

function getTeamName(triCode: string): string {
  const names: Record<string, string> = {
    'ANA': 'Anaheim Ducks',
    'BOS': 'Boston Bruins',
    'BUF': 'Buffalo Sabres',
    'CGY': 'Calgary Flames',
    'CAR': 'Carolina Hurricanes',
    'CHI': 'Chicago Blackhawks',
    'COL': 'Colorado Avalanche',
    'CBJ': 'Columbus Blue Jackets',
    'DAL': 'Dallas Stars',
    'DET': 'Detroit Red Wings',
    'EDM': 'Edmonton Oilers',
    'FLA': 'Florida Panthers',
    'LAK': 'Los Angeles Kings',
    'MIN': 'Minnesota Wild',
    'MTL': 'Montréal Canadiens',
    'NSH': 'Nashville Predators',
    'NJD': 'New Jersey Devils',
    'NYI': 'New York Islanders',
    'NYR': 'New York Rangers',
    'OTT': 'Ottawa Senators',
    'PHI': 'Philadelphia Flyers',
    'PIT': 'Pittsburgh Penguins',
    'SJS': 'San Jose Sharks',
    'SEA': 'Seattle Kraken',
    'STL': 'St. Louis Blues',
    'TBL': 'Tampa Bay Lightning',
    'TOR': 'Toronto Maple Leafs',
    'VAN': 'Vancouver Canucks',
    'VGK': 'Vegas Golden Knights',
    'WSH': 'Washington Capitals',
    'WPG': 'Winnipeg Jets',
    'UTA': 'Utah Hockey Club'
  };
  
  return names[triCode] || triCode;
}

export function resolveTeamIdentifier(identifier: string | number, context: ScheduleContext): string | null {
  if (typeof identifier === 'string') {
    return context.sets.has(identifier.toUpperCase()) ? identifier.toUpperCase() : null;
  }
  
  if (typeof identifier === 'number') {
    return context.idToTriCodeMap.get(identifier) || null;
  }
  
  return null;
}

export function filterDatesByRange(dates: Set<string>, start?: string, end?: string): Set<string> {
  if (!start && !end) return dates;
  
  const filtered = new Set<string>();
  for (const date of dates) {
    if (start && date < start) continue;
    if (end && date > end) continue;
    filtered.add(date);
  }
  
  return filtered;
}

function precomputeBestMatches(sets: Map<string, Set<string>>): { 2: BestMatch[], 3: BestMatch[], 4: BestMatch[] } {
  const teams = Array.from(sets.keys());
  const mockContext = { sets }; // Simplified context for calculations
  
  const results: { 2: BestMatch[], 3: BestMatch[], 4: BestMatch[] } = {
    2: [],
    3: [],
    4: []
  };
  
  // Generate combinations for k=2,3,4
  for (const k of [2, 3, 4] as const) {
    const combinations = generateCombinations(teams, k);
    
    const matches: BestMatch[] = [];
    for (const combo of combinations) {
      const usableStarts = calculateUsableStarts(combo, mockContext, 2);
      const offNightPct = calculateOffNightPct(combo, mockContext);
      const uniqueDays = calculateUniqueDays(combo, mockContext);
      
      matches.push({
        teams: combo,
        usableStarts,
        offNightPct,
        uniqueDays
      });
    }
    
    // Sort by usableStarts (desc), then offNightPct (desc)
    matches.sort((a, b) => 
      b.usableStarts - a.usableStarts ||
      b.offNightPct - a.offNightPct
    );
    
    // Keep top 50 per k
    results[k] = matches.slice(0, 50);
  }
  
  return results;
}

function generateCombinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  
  backtrack(0, []);
  return results;
}

function calculateUniqueDays(teamCombination: string[], scheduleContext: { sets: Map<string, Set<string>> }): number {
  const uniqueDates = new Set<string>();
  
  for (const teamCode of teamCombination) {
    const teamDates = scheduleContext.sets.get(teamCode);
    if (!teamDates) continue;
    
    for (const date of teamDates) {
      uniqueDates.add(date);
    }
  }
  
  return uniqueDates.size;
}