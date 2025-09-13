import { VercelRequest, VercelResponse } from '@vercel/node';

// Utility functions
function countIntersect(a: Set<string>, b: Set<string>) {
  let c = 0;
  for (const d of a) if (b.has(d)) c++;
  return c;
}

function countAminusB(a: Set<string>, b: Set<string>) {
  let c = 0;
  for (const d of a) if (!b.has(d)) c++;
  return c;
}

function weekdayOf(dateStr: string) {
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  return WD[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
}

function pctOffNightNonOverlap(seed: Set<string>, other: Set<string>) {
  const OFF_NIGHTS = new Set(['Mon', 'Wed', 'Fri', 'Sun']);
  let non = 0, off = 0;
  for (const d of other) {
    if (!seed.has(d)) {
      non++;
      if (OFF_NIGHTS.has(weekdayOf(d))) off++;
    }
  }
  return non ? off / non : 0;
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

async function loadScheduleData() {
  // Fetch the schedule data from the public JSON file
  const response = await fetch('https://cracked-ice-web.vercel.app/schedules-20252026.json');
  const data = await response.json();

  const sets = new Map<string, Set<string>>();
  const teamNameMap = new Map<string, string>();

  // Build maps from schedule data - data.teams contains teamCode: dates[]
  for (const [teamCode, dates] of Object.entries(data.teams)) {
    sets.set(teamCode, new Set(dates as string[]));
    teamNameMap.set(teamCode, TEAM_NAMES[teamCode] || teamCode);
  }

  return { sets, teamNameMap };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { seedTeamCode, start, end } = req.query;

    if (!seedTeamCode || typeof seedTeamCode !== 'string') {
      return res.status(400).json({ error: 'seedTeamCode is required' });
    }

    const seedTri = seedTeamCode.toUpperCase();

    // Load schedule data
    const scheduleContext = await loadScheduleData();

    // Validate team exists
    if (!scheduleContext.sets.has(seedTri)) {
      return res.status(400).json({ error: 'unknown_team', team: seedTri });
    }

    // Get seed team dates
    const seedTeamDates = scheduleContext.sets.get(seedTri)!;
    const seedDatesFiltered = filterDatesByRange(
      seedTeamDates,
      start as string,
      end as string
    );

    // Check if seed set is empty after filtering
    if (seedDatesFiltered.size === 0) {
      return res.status(400).json({
        error: 'empty_seed_in_window',
        team: seedTri,
        start,
        end,
        message: 'No games found for seed team in specified date range'
      });
    }

    // Calculate complements for all other teams
    const results = [];
    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      if (teamCode === seedTri) continue;

      const teamDatesFiltered = filterDatesByRange(teamDates, start as string, end as string);

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

    res.json(results);

  } catch (error) {
    console.error('[complement] error:', error);
    res.status(500).json({ error: 'Failed to calculate complements', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}