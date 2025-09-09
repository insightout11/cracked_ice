import { ComplementResult, Team } from '../types/nhl';

const OFF_NIGHT_WEIGHTS: { [key: string]: number } = {
  'Monday': 1.2,
  'Tuesday': 1.0,
  'Wednesday': 1.2,
  'Thursday': 1.0,
  'Friday': 1.2,
  'Saturday': 1.0,
  'Sunday': 1.2,
};

function getDayOfWeek(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function complementScore(
  seedDates: Set<string>,
  otherDates: Set<string>,
  useWeights: boolean = true
): { raw: number; weighted: number; dates: string[] } {
  const complementDates = Array.from(otherDates).filter(date => !seedDates.has(date));
  const raw = complementDates.length;
  
  let weighted = raw;
  if (useWeights) {
    weighted = complementDates.reduce((sum, date) => {
      const dayOfWeek = getDayOfWeek(date);
      return sum + (OFF_NIGHT_WEIGHTS[dayOfWeek] || 1.0);
    }, 0);
  }

  return { raw, weighted, dates: complementDates };
}

export async function calculateComplements(
  seedTeamId: number,
  seedDates: Set<string>,
  allTeams: Team[],
  getTeamDates: (teamId: number) => Promise<Set<string>>
): Promise<ComplementResult[]> {
  const results: ComplementResult[] = [];
  
  for (const team of allTeams) {
    if (team.id === seedTeamId) continue;
    
    try {
      const teamDates = await getTeamDates(team.id);
      const complement = complementScore(seedDates, teamDates);
      
      results.push({
        teamId: team.id,
        teamName: team.name,
        abbreviation: team.abbreviation,
        complement: complement.raw,
        weightedComplement: Math.round(complement.weighted * 10) / 10,
        datesComplement: complement.dates.sort(),
      });
    } catch (error) {
      console.error(`Failed to calculate complement for team ${team.id}:`, error);
    }
  }
  
  return results.sort((a, b) => b.weightedComplement - a.weightedComplement);
}

export function calculateAddedStarts(
  occupiedDates: Set<string>,
  candidateDates: Set<string>
): { addedStarts: number; dates: string[] } {
  const addedDates = Array.from(candidateDates).filter(date => !occupiedDates.has(date));
  
  return {
    addedStarts: addedDates.length,
    dates: addedDates.sort(),
  };
}

export function getCurrentNHLSeason(): string {
  // Return the current 2024-2025 NHL season (available in API)
  return `20242025`;
}

export function getDateRange(window: '7d' | '14d' | 'season'): { start: string; end: string; season?: string } {
  const today = new Date();
  const start = new Date(today);
  let end = new Date(today);

  switch (window) {
    case '7d':
      end.setDate(today.getDate() + 7);
      break;
    case '14d':
      end.setDate(today.getDate() + 14);
      break;
    case 'season':
      // 2024-2025 NHL season: October 2024 to June 2025
      start.setFullYear(2024, 9, 1); // October 1, 2024
      end.setFullYear(2025, 5, 30);  // June 30, 2025
      break;
  }

  const result = {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };

  if (window === 'season') {
    return {
      ...result,
      season: getCurrentNHLSeason(),
    };
  }

  return result;
}