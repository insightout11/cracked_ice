import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Team data
const NHL_TEAMS = [
  { id: 1, name: 'New Jersey Devils', abbreviation: 'NJD', triCode: 'NJD' },
  { id: 2, name: 'New York Islanders', abbreviation: 'NYI', triCode: 'NYI' },
  { id: 3, name: 'New York Rangers', abbreviation: 'NYR', triCode: 'NYR' },
  { id: 4, name: 'Philadelphia Flyers', abbreviation: 'PHI', triCode: 'PHI' },
  { id: 5, name: 'Pittsburgh Penguins', abbreviation: 'PIT', triCode: 'PIT' },
  { id: 6, name: 'Boston Bruins', abbreviation: 'BOS', triCode: 'BOS' },
  { id: 7, name: 'Buffalo Sabres', abbreviation: 'BUF', triCode: 'BUF' },
  { id: 8, name: 'Montreal Canadiens', abbreviation: 'MTL', triCode: 'MTL' },
  { id: 9, name: 'Ottawa Senators', abbreviation: 'OTT', triCode: 'OTT' },
  { id: 10, name: 'Toronto Maple Leafs', abbreviation: 'TOR', triCode: 'TOR' },
  { id: 12, name: 'Carolina Hurricanes', abbreviation: 'CAR', triCode: 'CAR' },
  { id: 13, name: 'Florida Panthers', abbreviation: 'FLA', triCode: 'FLA' },
  { id: 14, name: 'Tampa Bay Lightning', abbreviation: 'TBL', triCode: 'TBL' },
  { id: 15, name: 'Washington Capitals', abbreviation: 'WSH', triCode: 'WSH' },
  { id: 16, name: 'Chicago Blackhawks', abbreviation: 'CHI', triCode: 'CHI' },
  { id: 17, name: 'Detroit Red Wings', abbreviation: 'DET', triCode: 'DET' },
  { id: 18, name: 'Nashville Predators', abbreviation: 'NSH', triCode: 'NSH' },
  { id: 19, name: 'St. Louis Blues', abbreviation: 'STL', triCode: 'STL' },
  { id: 20, name: 'Calgary Flames', abbreviation: 'CGY', triCode: 'CGY' },
  { id: 21, name: 'Colorado Avalanche', abbreviation: 'COL', triCode: 'COL' },
  { id: 22, name: 'Edmonton Oilers', abbreviation: 'EDM', triCode: 'EDM' },
  { id: 23, name: 'Vancouver Canucks', abbreviation: 'VAN', triCode: 'VAN' },
  { id: 24, name: 'Anaheim Ducks', abbreviation: 'ANA', triCode: 'ANA' },
  { id: 25, name: 'Dallas Stars', abbreviation: 'DAL', triCode: 'DAL' },
  { id: 26, name: 'Los Angeles Kings', abbreviation: 'LAK', triCode: 'LAK' },
  { id: 27, name: 'San Jose Sharks', abbreviation: 'SJS', triCode: 'SJS' },
  { id: 28, name: 'Columbus Blue Jackets', abbreviation: 'CBJ', triCode: 'CBJ' },
  { id: 29, name: 'Minnesota Wild', abbreviation: 'MIN', triCode: 'MIN' },
  { id: 30, name: 'Winnipeg Jets', abbreviation: 'WPG', triCode: 'WPG' },
  { id: 53, name: 'Vegas Golden Knights', abbreviation: 'VGK', triCode: 'VGK' },
  { id: 54, name: 'Seattle Kraken', abbreviation: 'SEA', triCode: 'SEA' },
  { id: 55, name: 'Utah Hockey Club', abbreviation: 'UTA', triCode: 'UTA' }
];

// Schedule utility functions
function countIntersect(setA: Set<string>, setB: Set<string>): number {
  let count = 0;
  for (const item of setA) {
    if (setB.has(item)) count++;
  }
  return count;
}

function countAminusB(setA: Set<string>, setB: Set<string>): number {
  let count = 0;
  for (const item of setA) {
    if (!setB.has(item)) count++;
  }
  return count;
}

function pctOffNightNonOverlap(seedSet: Set<string>, candidateSet: Set<string>): number {
  const OFF_NIGHTS = new Set(['Mon', 'Wed', 'Fri', 'Sun']);
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function weekdayOf(dateStr: string) {
    return WD[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
  }

  const nonOverlapDates = [...candidateSet].filter(d => !seedSet.has(d));
  if (nonOverlapDates.length === 0) return 0;

  const offNightCount = nonOverlapDates.filter(d => OFF_NIGHTS.has(weekdayOf(d))).length;
  return offNightCount / nonOverlapDates.length;
}

function filterDatesByRange(dateSet: Set<string>, start?: string, end?: string): Set<string> {
  if (!start && !end) return dateSet;

  return new Set([...dateSet].filter(date => {
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }));
}

// Load schedule context
function loadScheduleContext() {
  try {
    const dataPath = join(process.cwd(), 'data', 'schedules-20252026.json');

    if (!existsSync(dataPath)) {
      console.error('Schedule data not found:', dataPath);
      return null;
    }

    const data = JSON.parse(readFileSync(dataPath, 'utf8'));

    // Convert to Sets for efficient lookup
    const sets = new Map<string, Set<string>>();
    const teamNameMap = new Map<string, string>();

    for (const [teamCode, dates] of Object.entries(data.teams)) {
      sets.set(teamCode, new Set(dates as string[]));

      // Map team codes to full names
      const team = NHL_TEAMS.find(t => t.triCode === teamCode);
      if (team) {
        teamNameMap.set(teamCode, team.name);
      }
    }

    return { sets, teamNameMap };
  } catch (error) {
    console.error('Error loading schedule context:', error);
    return null;
  }
}

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if this is a complement request
    if (req.query.seedTeamCode) {
      const { seedTeamCode, start, end } = req.query;

      // Load real schedule data
      const scheduleContext = loadScheduleContext();

      if (!scheduleContext) {
        return res.status(500).json({
          error: 'schedules_not_loaded',
          message: 'Missing data/schedules-20252026.json — please warm schedules.'
        });
      }

      const seedTeamCodeUpper = String(seedTeamCode).toUpperCase();

      // Validate team exists
      if (!scheduleContext.sets.has(seedTeamCodeUpper)) {
        return res.status(400).json({ error: 'unknown_team', team: seedTeamCodeUpper });
      }

      // Get seed team dates
      const seedTeamDates = scheduleContext.sets.get(seedTeamCodeUpper)!;
      const seedDatesFiltered = filterDatesByRange(seedTeamDates, start, end);

      if (seedDatesFiltered.size === 0) {
        return res.status(400).json({
          error: 'empty_seed_in_window',
          team: seedTeamCodeUpper,
          start,
          end,
          message: 'No games found for seed team in specified date range'
        });
      }

      // Calculate complements for all other teams
      const results = [];
      for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
        if (teamCode === seedTeamCodeUpper) continue;

        const teamDatesFiltered = filterDatesByRange(teamDates, start, end);

        const conflicts = countIntersect(seedDatesFiltered, teamDatesFiltered);
        const nonOverlap = countAminusB(teamDatesFiltered, seedDatesFiltered);
        const offNightShare = pctOffNightNonOverlap(seedDatesFiltered, teamDatesFiltered);

        results.push({
          teamCode,
          teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
          conflicts,
          nonOverlap,
          offNightShare: Math.round(offNightShare * 1000) / 1000,
          // Legacy compatibility
          complement: nonOverlap,
          weightedComplement: nonOverlap,
          abbreviation: teamCode,
          datesComplement: [...teamDatesFiltered].filter(d => !seedDatesFiltered.has(d)).sort()
        });
      }

      // Sort by conflicts (asc), then nonOverlap (desc), then offNightShare (desc)
      results.sort((a, b) =>
        a.conflicts - b.conflicts ||
        b.nonOverlap - a.nonOverlap ||
        b.offNightShare - a.offNightShare
      );

      return res.json(results);
    }

    // Default: return team list
    res.json(NHL_TEAMS);
  } catch (error: any) {
    console.error('Teams endpoint error:', error);
    res.status(500).json({ error: 'Failed to get teams', details: error?.message });
  }
}