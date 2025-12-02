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
    const { rosterTeamCodes, candidateTeamCode, start, end, slotsPerDay = 2 } = req.body;

    if (!rosterTeamCodes || !Array.isArray(rosterTeamCodes) || !candidateTeamCode) {
      return res.status(400).json({ error: 'rosterTeamCodes and candidateTeamCode are required' });
    }

    // Normalize team codes to uppercase
    const normalizedRoster = rosterTeamCodes.map((code: string) => code.toUpperCase());
    const normalizedCandidate = candidateTeamCode.toUpperCase();

    // Load schedule data
    const scheduleContext = loadScheduleData();

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_loaded',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    // Validate all teams exist
    if (!scheduleContext.sets.has(normalizedCandidate)) {
      return res.status(400).json({ error: 'unknown_team', team: normalizedCandidate });
    }
    for (const teamCode of normalizedRoster) {
      if (!scheduleContext.sets.has(teamCode)) {
        return res.status(400).json({ error: 'unknown_roster_team', team: teamCode });
      }
    }

    // Helper function to get filtered team dates
    const getFilteredTeamDates = (teamCode: string): Set<string> => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return filterDatesByRange(teamDates, start, end);
    };

    // Build occupancy map from roster teams
    const occupiedPerDay = new Map<string, number>();
    for (const teamCode of normalizedRoster) {
      const teamDates = getFilteredTeamDates(teamCode);
      for (const date of teamDates) {
        occupiedPerDay.set(date, (occupiedPerDay.get(date) || 0) + 1);
      }
    }

    // Get candidate team's dates in the window
    const candidateDates = getFilteredTeamDates(normalizedCandidate);

    // Count only candidate dates that have available slots
    const addedDates: string[] = [];
    for (const date of candidateDates) {
      if ((occupiedPerDay.get(date) || 0) < slotsPerDay) {
        addedDates.push(date);
      }
    }

    res.json({
      addedStarts: addedDates.length,
      dates: addedDates.sort(),
      candidateGamesInWindow: candidateDates.size,
      sampleAddedDates: addedDates.slice(0, 10),
      diagnostics: {
        rosterTeams: normalizedRoster,
        candidateTeam: normalizedCandidate,
        dateRange: { start, end },
        slotsPerDay
      }
    });

  } catch (error) {
    console.error('[added-starts] error:', error);
    res.status(500).json({ error: 'Failed to calculate added starts' });
  }
}