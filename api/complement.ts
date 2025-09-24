import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ComplementResult {
  teamCode: string;
  teamName: string;
  totalGames: number;
  conflictGames: number;
  conflictPct: number;
  offNightGames: number;
  offNightPct: number;
  usableStarts: number;
}

function loadScheduleContext() {
  const dataPath = join(process.cwd(), 'data', 'schedules-context.json');

  if (!existsSync(dataPath)) {
    throw new Error('Schedule context not found. Run npm run warm:schedules first.');
  }

  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

  return {
    sets: new Map(Object.entries(data.sets).map(([k, v]) => [k, new Set(v as string[])])),
    teamNameMap: new Map(Object.entries(data.teamNameMap))
  };
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const scheduleContext = loadScheduleContext();
    const { seedTeamCode, start, end } = req.query;

    if (!seedTeamCode || typeof seedTeamCode !== 'string') {
      return res.status(400).json({ error: 'seedTeamCode is required' });
    }

    const seedTeam = seedTeamCode.toUpperCase();
    const seedDates = scheduleContext.sets.get(seedTeam);

    if (!seedDates) {
      return res.status(404).json({ error: `Team ${seedTeam} not found` });
    }

    const seedFiltered = filterDatesByRange(seedDates, start as string, end as string);
    const results: ComplementResult[] = [];

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      if (teamCode === seedTeam) continue;

      const teamFiltered = filterDatesByRange(teamDates, start as string, end as string);
      const intersection = new Set([...seedFiltered].filter(x => teamFiltered.has(x)));
      const teamOnlyDates = new Set([...teamFiltered].filter(x => !seedFiltered.has(x)));

      const conflictGames = intersection.size;
      const conflictPct = teamFiltered.size > 0 ? (conflictGames / teamFiltered.size) * 100 : 0;

      // Calculate off-night games (games when seed team doesn't play)
      const offNightGames = teamOnlyDates.size;
      const offNightPct = teamFiltered.size > 0 ? (offNightGames / teamFiltered.size) * 100 : 0;

      // Usable starts = games when they don't conflict
      const usableStarts = teamFiltered.size - conflictGames;

      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        totalGames: teamFiltered.size,
        conflictGames,
        conflictPct: Math.round(conflictPct * 100) / 100,
        offNightGames,
        offNightPct: Math.round(offNightPct * 100) / 100,
        usableStarts
      });
    }

    // Sort by usable starts descending, then by off-night percentage descending
    results.sort((a, b) => {
      if (b.usableStarts !== a.usableStarts) {
        return b.usableStarts - a.usableStarts;
      }
      return b.offNightPct - a.offNightPct;
    });

    res.json(results);
  } catch (error) {
    console.error('Error in complement API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}