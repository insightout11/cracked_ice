import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface BackToBackResult {
  teamCode: string;
  teamName: string;
  totalBackToBack: number;
  remainingBackToBack: number;
  totalGames: number;
}

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

    const NHL_TEAMS = [
      { id: 24, name: 'Anaheim Ducks', abbreviation: 'ANA', triCode: 'ANA' },
      { id: 6, name: 'Boston Bruins', abbreviation: 'BOS', triCode: 'BOS' },
      { id: 7, name: 'Buffalo Sabres', abbreviation: 'BUF', triCode: 'BUF' },
      { id: 20, name: 'Calgary Flames', abbreviation: 'CGY', triCode: 'CGY' },
      { id: 12, name: 'Carolina Hurricanes', abbreviation: 'CAR', triCode: 'CAR' },
      { id: 16, name: 'Chicago Blackhawks', abbreviation: 'CHI', triCode: 'CHI' },
      { id: 21, name: 'Colorado Avalanche', abbreviation: 'COL', triCode: 'COL' },
      { id: 28, name: 'Columbus Blue Jackets', abbreviation: 'CBJ', triCode: 'CBJ' },
      { id: 25, name: 'Dallas Stars', abbreviation: 'DAL', triCode: 'DAL' },
      { id: 17, name: 'Detroit Red Wings', abbreviation: 'DET', triCode: 'DET' },
      { id: 22, name: 'Edmonton Oilers', abbreviation: 'EDM', triCode: 'EDM' },
      { id: 13, name: 'Florida Panthers', abbreviation: 'FLA', triCode: 'FLA' },
      { id: 26, name: 'Los Angeles Kings', abbreviation: 'LAK', triCode: 'LAK' },
      { id: 29, name: 'Minnesota Wild', abbreviation: 'MIN', triCode: 'MIN' },
      { id: 8, name: 'Montreal Canadiens', abbreviation: 'MTL', triCode: 'MTL' },
      { id: 18, name: 'Nashville Predators', abbreviation: 'NSH', triCode: 'NSH' },
      { id: 1, name: 'New Jersey Devils', abbreviation: 'NJD', triCode: 'NJD' },
      { id: 2, name: 'New York Islanders', abbreviation: 'NYI', triCode: 'NYI' },
      { id: 3, name: 'New York Rangers', abbreviation: 'NYR', triCode: 'NYR' },
      { id: 9, name: 'Ottawa Senators', abbreviation: 'OTT', triCode: 'OTT' },
      { id: 4, name: 'Philadelphia Flyers', abbreviation: 'PHI', triCode: 'PHI' },
      { id: 5, name: 'Pittsburgh Penguins', abbreviation: 'PIT', triCode: 'PIT' },
      { id: 27, name: 'San Jose Sharks', abbreviation: 'SJS', triCode: 'SJS' },
      { id: 54, name: 'Seattle Kraken', abbreviation: 'SEA', triCode: 'SEA' },
      { id: 19, name: 'St. Louis Blues', abbreviation: 'STL', triCode: 'STL' },
      { id: 14, name: 'Tampa Bay Lightning', abbreviation: 'TBL', triCode: 'TBL' },
      { id: 10, name: 'Toronto Maple Leafs', abbreviation: 'TOR', triCode: 'TOR' },
      { id: 55, name: 'Utah Hockey Club', abbreviation: 'UTA', triCode: 'UTA' },
      { id: 23, name: 'Vancouver Canucks', abbreviation: 'VAN', triCode: 'VAN' },
      { id: 53, name: 'Vegas Golden Knights', abbreviation: 'VGK', triCode: 'VGK' },
      { id: 15, name: 'Washington Capitals', abbreviation: 'WSH', triCode: 'WSH' },
      { id: 30, name: 'Winnipeg Jets', abbreviation: 'WPG', triCode: 'WPG' }
    ];

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

function filterDatesByRange(dates: Set<string>, start?: string, end?: string): Set<string> {
  if (!start && !end) return dates;

  const filtered = new Set<string>();
  for (const date of dates) {
    if (start && date < start) continue;
    if (end && date > end) continue;
    filtered.add(date);
  }

  return filtered;
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
    const scheduleContext = loadScheduleContext();

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_loaded',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    const { start, end } = req.query;

    console.log(`[backtobacks] ${start || 'season-start'}->${end || 'season-end'}`);
    const t0 = Date.now();

    // Step 1: Calculate back-to-back games for each team
    const results: BackToBackResult[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start, end);
      const sortedDates = Array.from(filteredDates).sort();

      let totalBackToBack = 0;
      let remainingBackToBack = 0;

      // Check each consecutive pair of dates
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const currentDate = new Date(sortedDates[i]);
        const nextDate = new Date(sortedDates[i + 1]);

        const diffTime = nextDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // If the difference is exactly 1 day, it's a back-to-back
        if (diffDays === 1) {
          totalBackToBack++;
          // Count as remaining if the second game is today or later
          if (sortedDates[i + 1] >= today) {
            remainingBackToBack++;
          }
        }
      }

      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        totalBackToBack,
        remainingBackToBack,
        totalGames: filteredDates.size // Total games in the date range
      });
    }

    // Sort by total back-to-back descending, then remaining back-to-back descending
    results.sort((a, b) =>
      b.totalBackToBack - a.totalBackToBack ||
      b.remainingBackToBack - a.remainingBackToBack
    );

    console.log(`[backtobacks] ok in ${Date.now() - t0}ms`);
    res.json(results);

  } catch (error: any) {
    console.error('[backtobacks] error:', error);
    res.status(500).json({ error: 'Failed to calculate back-to-back games' });
  }
}