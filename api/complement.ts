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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { seedTeamCode } = req.query;

    if (!seedTeamCode || typeof seedTeamCode !== 'string') {
      return res.status(400).json({ error: 'seedTeamCode is required' });
    }

    // Mock response for now - replace with actual implementation later
    const mockResults: ComplementResult[] = [
      {
        teamCode: 'UTA',
        teamName: 'Utah Hockey Club',
        totalGames: 82,
        conflictGames: 15,
        conflictPct: 18.29,
        offNightGames: 67,
        offNightPct: 81.71,
        usableStarts: 67
      },
      {
        teamCode: 'ANA',
        teamName: 'Anaheim Ducks',
        totalGames: 82,
        conflictGames: 18,
        conflictPct: 21.95,
        offNightGames: 64,
        offNightPct: 78.05,
        usableStarts: 64
      },
      {
        teamCode: 'CHI',
        teamName: 'Chicago Blackhawks',
        totalGames: 82,
        conflictGames: 20,
        conflictPct: 24.39,
        offNightGames: 62,
        offNightPct: 75.61,
        usableStarts: 62
      }
    ];

    res.json(mockResults);
  } catch (error) {
    console.error('Error in complement API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}