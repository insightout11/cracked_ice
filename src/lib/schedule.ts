import { addDays, startOfWeek, format } from 'date-fns';

export function getStartOfIsoWeek(d = new Date()) {
  return startOfWeek(d, { weekStartsOn: 1 }); // Monday
}

export function formatWeekLabel(iso: string) {
  return format(new Date(iso), "MMMM d, yyyy");
}

export function getPrevWeekIso(iso: string) {
  const d = new Date(iso);
  return format(addDays(d, -7), 'yyyy-MM-dd');
}

export function getNextWeekIso(iso: string) {
  const d = new Date(iso);
  return format(addDays(d, +7), 'yyyy-MM-dd');
}

export type DayId = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
export const DAY_IDS: DayId[] = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function isOffNight(day: DayId) {
  // consider Tue/Thu/Sat heavy nights
  return !['Tue','Thu','Sat'].includes(day);
}

export function computeB2B(team: TeamWeek) {
  // linear scan across DAY_IDS; if team has games on day i and i+1 -> mark day i+1 (or both)
  const set = new Set<DayId>();
  for (let i=0;i<DAY_IDS.length-1;i++) {
    const a = DAY_IDS[i], b = DAY_IDS[i+1];
    const hasA = (team.gamesByDay[a]?.length ?? 0) > 0;
    const hasB = (team.gamesByDay[b]?.length ?? 0) > 0;
    if (hasA && hasB) {
      set.add(b); // mark second night (or also set.add(a) if preferred)
    }
  }
  return set;
}

// Data types for Weekly Schedule API
export interface GameCell {
  opponent: string;         // 'TOR'
  opponentLogo: string;     // cdn url
  home: boolean;            // true -> home, false -> away
  start: string;            // ISO datetime
}

export interface TeamWeek {
  team: string;              // 'BUF'
  teamName: string;          // 'Buffalo Sabres'
  logo: string;              // cdn url
  gamesByDay: Record<DayId, GameCell[]>;
}

export interface WeeklySchedule {
  weekOf: string;           // '2025-03-17'
  days: { id: DayId; date: string }[];  // 'Mon 17', 'Tue 18', ...
  teams: TeamWeek[];
}


// Helper to get current week ISO string (Monday) - start with NHL season
export function getCurrentWeekIso(): string {
  // Start with first Monday of October 2025 for 2025-2026 NHL season
  const seasonStart = new Date('2025-10-06'); // First Monday of October 2025
  return format(seasonStart, 'yyyy-MM-dd');
}

// Generate week options for dropdown - full NHL season (October through June)
export function getWeekOptions(): Array<{value: string, label: string}> {
  const options: Array<{value: string, label: string}> = [];
  
  // NHL season typically runs from early October through early June (about 35 weeks)
  const seasonStart = new Date('2025-10-01'); // Start of 2025-26 season
  const seasonEnd = new Date('2026-06-15');   // End including playoffs
  
  let weekStart = getStartOfIsoWeek(seasonStart);
  
  while (weekStart <= seasonEnd) {
    const isoWeek = format(weekStart, 'yyyy-MM-dd');
    const label = `Week of ${formatWeekLabel(isoWeek)}`;
    options.push({ value: isoWeek, label });
    weekStart = addDays(weekStart, 7);
  }
  
  return options;
}

// Note: findOpponentForDate function removed - we now use real NHL opponent data from the API

// API call to get real schedule data with start times
export async function fetchWeeklyScheduleData(weekIso: string): Promise<WeeklySchedule> {
  try {
    // First, get all teams
    const baseURL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:8080/api'
      : '/api';
    const teamsResponse = await fetch(`${baseURL}/teams`);
    const teams = await teamsResponse.json();
    
    // Generate the 7 days for the week
    const weekStart = getStartOfIsoWeek(new Date(weekIso));
    const days = [
      { id: 'Mon' as const, date: format(weekStart, 'MMM d') },
      { id: 'Tue' as const, date: format(addDays(weekStart, 1), 'MMM d') },
      { id: 'Wed' as const, date: format(addDays(weekStart, 2), 'MMM d') },
      { id: 'Thu' as const, date: format(addDays(weekStart, 3), 'MMM d') },
      { id: 'Fri' as const, date: format(addDays(weekStart, 4), 'MMM d') },
      { id: 'Sat' as const, date: format(addDays(weekStart, 5), 'MMM d') },
      { id: 'Sun' as const, date: format(addDays(weekStart, 6), 'MMM d') }
    ];
    
    // Read the actual schedule data from public folder (now includes start times)
    const scheduleResponse = await fetch('/schedules-20252026.json');
    const scheduleData = await scheduleResponse.json();
    
    // Build teams with their real schedule data using the detailed games info
    const scheduleTeams: TeamWeek[] = teams.map((team: any) => {
      const teamGames = scheduleData.games[team.triCode] || [];
      const gamesByDay: Record<DayId, GameCell[]> = {
        'Mon': [],
        'Tue': [],
        'Wed': [],
        'Thu': [],
        'Fri': [],
        'Sat': [],
        'Sun': []
      };
      
      // Check each day of the week for games
      days.forEach((day, index) => {
        const dayDate = format(addDays(weekStart, index), 'yyyy-MM-dd');
        
        // Find games on this specific date
        const gamesOnDay = teamGames.filter((game: any) => game.date === dayDate);
        
        gamesOnDay.forEach((game: any) => {
          // Handle both current format (game.date) and future enhanced format (game.startTime)
          const startTime = game.startTime || game.date;
          
          gamesByDay[day.id].push({
            opponent: game.opponent,
            opponentLogo: `https://assets.nhle.com/logos/nhl/svg/${game.opponent}_light.svg`,
            home: game.isHome,
            start: startTime
          });
        });
      });
      
      return {
        team: team.triCode,
        teamName: team.name,
        logo: `https://assets.nhle.com/logos/nhl/svg/${team.triCode}_light.svg`,
        gamesByDay
      };
    });
    
    return {
      weekOf: weekIso,
      days,
      teams: scheduleTeams
    };
  } catch (error) {
    console.error('Error fetching schedule data:', error);
    throw error; // Let the page handle the error
  }
}