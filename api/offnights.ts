import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Utility functions
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

// Team names mapping
const TEAM_NAMES: Record<string, string> = {
  'NJD': 'New Jersey Devils', 'NYI': 'New York Islanders', 'NYR': 'New York Rangers',
  'PHI': 'Philadelphia Flyers', 'PIT': 'Pittsburgh Penguins', 'BOS': 'Boston Bruins',
  'BUF': 'Buffalo Sabres', 'MTL': 'Montreal Canadiens', 'OTT': 'Ottawa Senators',
  'TOR': 'Toronto Maple Leafs', 'CAR': 'Carolina Hurricanes', 'FLA': 'Florida Panthers',
  'TBL': 'Tampa Bay Lightning', 'WSH': 'Washington Capitals', 'CHI': 'Chicago Blackhawks',
  'DET': 'Detroit Red Wings', 'NSH': 'Nashville Predators', 'STL': 'St. Louis Blues',
  'CGY': 'Calgary Flames', 'COL': 'Colorado Avalanche', 'EDM': 'Edmonton Oilers',
  'VAN': 'Vancouver Canucks', 'ANA': 'Anaheim Ducks', 'DAL': 'Dallas Stars',
  'LAK': 'Los Angeles Kings', 'SJS': 'San Jose Sharks', 'CBJ': 'Columbus Blue Jackets',
  'MIN': 'Minnesota Wild', 'WPG': 'Winnipeg Jets', 'VGK': 'Vegas Golden Knights',
  'SEA': 'Seattle Kraken', 'UTA': 'Utah Hockey Club'
};

function loadScheduleData() {
  try {
    const dataPath = join(process.cwd(), 'data', 'schedules-20252026.json');

    if (!existsSync(dataPath)) {
      console.error('Schedule data not found:', dataPath);
      return null;
    }

    const data = JSON.parse(readFileSync(dataPath, 'utf8'));

    const sets = new Map<string, Set<string>>();
    const teamNameMap = new Map<string, string>();

    // Build maps from schedule data
    for (const [teamCode, dates] of Object.entries(data.teams)) {
      sets.set(teamCode, new Set(dates as string[]));
      teamNameMap.set(teamCode, TEAM_NAMES[teamCode] || teamCode);
    }

    return { sets, teamNameMap };
  } catch (error) {
    console.error('Error loading schedule data:', error);
    return null;
  }
}

export default function handler(req: any, res: any) {
  // Set CORS headers
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
    const { start, end } = req.query;

    // Load schedule data
    const scheduleContext = loadScheduleData();

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_loaded',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    // Step 1: Calculate which days are off-nights (≤ 8 total games)
    const gameCounts = new Map<string, number>();

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start as string, end as string);
      for (const date of filteredDates) {
        gameCounts.set(date, (gameCounts.get(date) || 0) + 1);
      }
    }

    // Since each game involves 2 teams, divide by 2 to get actual game count
    const actualGameCounts = new Map<string, number>();
    for (const [date, teamCount] of gameCounts.entries()) {
      actualGameCounts.set(date, Math.floor(teamCount / 2));
    }

    // Identify off-night dates (≤ 8 games total)
    const offNightDates = new Set<string>();
    for (const [date, gameCount] of actualGameCounts.entries()) {
      if (gameCount <= 8) {
        offNightDates.add(date);
      }
    }

    // Step 2: Count off-nights per team
    const results = [];
    const today = new Date().toISOString().split('T')[0];

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start as string, end as string);

      let totalOffNights = 0;
      let remainingOffNights = 0;

      for (const date of filteredDates) {
        if (offNightDates.has(date)) {
          totalOffNights++;
          if (date >= today) {
            remainingOffNights++;
          }
        }
      }

      const totalGames = filteredDates.size;
      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        totalOffNights,
        remainingOffNights,
        totalGames
      });
    }

    // Sort by total off-nights descending, then remaining off-nights descending
    results.sort((a, b) =>
      b.totalOffNights - a.totalOffNights ||
      b.remainingOffNights - a.remainingOffNights
    );

    res.json(results);

  } catch (error) {
    console.error('[offnights] error:', error);
    res.status(500).json({ error: 'Failed to calculate off-nights' });
  }
}