import { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
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

// Team ID to triCode mapping
const TEAM_ID_MAP: Record<number, string> = {
  1: 'NJD', 2: 'NYI', 3: 'NYR', 4: 'PHI', 5: 'PIT', 6: 'BOS',
  7: 'BUF', 8: 'MTL', 9: 'OTT', 10: 'TOR', 12: 'CAR', 13: 'FLA',
  14: 'TBL', 15: 'WSH', 16: 'CHI', 17: 'DET', 18: 'NSH', 19: 'STL',
  20: 'CGY', 21: 'COL', 22: 'EDM', 23: 'VAN', 24: 'ANA', 25: 'DAL',
  26: 'LAK', 27: 'SJS', 28: 'CBJ', 29: 'MIN', 30: 'WPG', 53: 'VGK',
  54: 'SEA', 55: 'UTA'
};

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
  const dataPath = join(process.cwd(), 'data', 'schedules-20252026.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));

  const sets = new Map<string, Set<string>>();
  const teamNameMap = new Map<string, string>();

  // Build maps from schedule data
  for (const [teamIdStr, dates] of Object.entries(data.teams)) {
    const teamId = parseInt(teamIdStr);
    const triCode = TEAM_ID_MAP[teamId];
    if (triCode) {
      sets.set(triCode, new Set(dates as string[]));
      teamNameMap.set(triCode, TEAM_NAMES[triCode]);
    }
  }

  return { sets, teamNameMap };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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