import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { calculateUsableStarts, calculateOffNightPct } from '../utils/schedule-utils';

interface ScheduleData {
  season: string;
  teams: Record<string, string[]>;
  lastRefreshed: string;
}

interface BestMatch {
  teams: string[];
  usableStarts: number;
  offNightPct: number;
  uniqueDays: number;
}

interface ScheduleContext {
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

export function loadSchedules(season = '20252026'): ScheduleContext {
  const dataPath = join(process.cwd(), 'data', `schedules-${season}.json`);
  
  if (!existsSync(dataPath)) {
    throw new Error(`Schedules not warmed—run npm run warm:schedules. Missing: ${dataPath}`);
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
  
  return context;
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