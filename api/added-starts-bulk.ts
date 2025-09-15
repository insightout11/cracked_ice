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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rosterTeamCodes, start, end, slotsPerDay = 2 } = req.body;

    if (!rosterTeamCodes || !Array.isArray(rosterTeamCodes)) {
      return res.status(400).json({ error: 'rosterTeamCodes is required and must be an array' });
    }

    // Normalize team codes to uppercase
    const normalizedRoster = rosterTeamCodes.map((code: string) => code.toUpperCase());

    // Load schedule data
    const scheduleContext = loadScheduleData();

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_loaded',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    // Validate all roster teams exist
    for (const teamCode of normalizedRoster) {
      if (!scheduleContext.sets.has(teamCode)) {
        return res.status(400).json({ error: 'unknown_roster_team', team: teamCode });
      }
    }

    const rosterSet = new Set(normalizedRoster);

    // Helper function to get filtered team dates
    const getTeamDates = (teamCode: string) => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return teamDates;
    };

    // Build occupancy from current roster
    const occupancy = new Map<string, number>();
    for (const team of normalizedRoster) {
      const dates = filterDatesByRange(getTeamDates(team), start || '2025-10-01', end || '2026-04-30');
      for (const date of dates) {
        occupancy.set(date, (occupancy.get(date) || 0) + 1);
      }
    }

    // Get all teams and filter out roster teams
    const allTeams = Array.from(scheduleContext.sets.keys());

    // Score every other team
    const rows = allTeams
      .filter(team => !rosterSet.has(team))
      .map(team => {
        const dates = filterDatesByRange(getTeamDates(team), start || '2025-10-01', end || '2026-04-30');
        let added = 0;
        for (const date of dates) {
          if ((occupancy.get(date) || 0) < slotsPerDay) {
            added++;
          }
        }
        return {
          team,
          candidateGamesInWindow: dates.size,
          usableStarts: added,
          teamName: scheduleContext.teamNameMap.get(team) || team,
          abbreviation: team
        };
      });

    res.json({ rows });

  } catch (error) {
    console.error('[added-starts-bulk] error:', error);
    res.status(500).json({ error: 'Failed to calculate bulk added starts' });
  }
}