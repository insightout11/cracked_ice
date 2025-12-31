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

/**
 * @deprecated Use game.isOffNight flag instead for accurate data.
 * This is a day-based approximation and should not be used for metrics.
 * The real off-night determination is based on actual league-wide game counts.
 */
export function isOffNight(day: DayId) {
  // Off-night definition: 8 or fewer games across the league on that day
  // Typically Mon/Wed/Fri/Sun, but this is an approximation for the Weekly Schedule view
  // The actual off-night determination is done server-side based on real game counts
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
  isOffNight: boolean;      // true if 8 or fewer league games that day
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

// Sort mode types
export type SortMode = 'alphabetical' | 'best' | 'worst';

export interface TeamScheduleMetrics {
  totalGames: number;
  offNightGames: number;
  b2bGames: number;
  offNightPercentage: number;
  scheduleScore: number;
}

export interface TeamWeekWithScore extends TeamWeek {
  metrics: TeamScheduleMetrics;
}


// Helper to get current week ISO string (Monday) - start with NHL season
export function getCurrentWeekIso(): string {
  const now = new Date();
  const seasonStart = new Date('2025-10-06'); // First Monday of October 2025
  const seasonEnd = new Date('2026-06-15');   // End of season including playoffs

  // If we're within the season, use the current week
  if (now >= seasonStart && now <= seasonEnd) {
    return format(getStartOfIsoWeek(now), 'yyyy-MM-dd');
  }

  // Otherwise default to the first week of the season
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

/**
 * Calculate schedule metrics and score for a team
 */
export function calculateTeamMetrics(
  team: TeamWeek,
  b2bSet: Set<DayId>,
  maxGames: number
): TeamScheduleMetrics {
  const days = Object.keys(team.gamesByDay) as DayId[];
  let totalGames = 0, offNightGames = 0, b2bGames = 0;

  days.forEach(d => {
    const games = team.gamesByDay[d] || [];
    totalGames += games.length;

    // Count games with actual isOffNight flag
    games.forEach(game => {
      if (game.isOffNight) offNightGames += 1;
    });

    if (games.length > 0 && b2bSet.has(d)) b2bGames += 1;
  });

  const offNightPercentage = totalGames > 0 ? (offNightGames / totalGames) * 100 : 0;

  // Score calculation: 60% games volume + 40% off-night percentage
  const gamesScore = maxGames > 0 ? (totalGames / maxGames) * 100 : 0;
  const offNightScore = offNightPercentage;
  const scheduleScore = (gamesScore * 0.6) + (offNightScore * 0.4);

  return {
    totalGames,
    offNightGames,
    b2bGames,
    offNightPercentage,
    scheduleScore
  };
}

/**
 * Sort teams based on selected mode
 */
export function sortTeams(
  teams: TeamWeek[],
  sortMode: SortMode
): TeamWeekWithScore[] {
  // Calculate max games for normalization
  const maxGames = Math.max(...teams.map(team => {
    const days = Object.keys(team.gamesByDay) as DayId[];
    return days.reduce((sum, d) => sum + (team.gamesByDay[d]?.length ?? 0), 0);
  }), 1); // Ensure at least 1 to avoid division by zero

  // Add metrics to all teams
  const teamsWithMetrics: TeamWeekWithScore[] = teams.map(team => {
    const b2bSet = computeB2B(team);
    const metrics = calculateTeamMetrics(team, b2bSet, maxGames);
    return { ...team, metrics };
  });

  // Sort based on mode
  switch (sortMode) {
    case 'best':
      return teamsWithMetrics.sort((a, b) => {
        if (b.metrics.scheduleScore !== a.metrics.scheduleScore) {
          return b.metrics.scheduleScore - a.metrics.scheduleScore;
        }
        return a.team.localeCompare(b.team); // Alphabetical tiebreaker
      });

    case 'worst':
      return teamsWithMetrics.sort((a, b) => {
        if (a.metrics.scheduleScore !== b.metrics.scheduleScore) {
          return a.metrics.scheduleScore - b.metrics.scheduleScore;
        }
        return a.team.localeCompare(b.team); // Alphabetical tiebreaker
      });

    case 'alphabetical':
    default:
      return teamsWithMetrics.sort((a, b) => a.team.localeCompare(b.team));
  }
}

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
            start: startTime,
            isOffNight: game.isOffNight || false
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

// Weekly stats interface for game count totals and intensity classification
export interface WeeklyStats {
  totalGames: number;
  gamesPerDay: Partial<Record<DayId, number>>;
  intensity: 'light' | 'average' | 'busy';
  intensityPercentage: number;  // How this week compares to season average
}

/**
 * Calculate weekly game statistics and intensity classification
 * @param scheduleData - The weekly schedule data
 * @param seasonAverageGames - Average total games per week across the season
 */
export function calculateWeeklyStats(
  scheduleData: WeeklySchedule,
  seasonAverageGames: number = 90
): WeeklyStats {
  const gamesPerDay: Partial<Record<DayId, number>> = {};
  let totalGames = 0;

  scheduleData.days.forEach(day => {
    let dayGames = 0;
    scheduleData.teams.forEach(team => {
      dayGames += (team.gamesByDay[day.id]?.length ?? 0);
    });
    // Divide by 2 since each game has 2 teams
    gamesPerDay[day.id] = dayGames / 2;
    totalGames += dayGames;
  });

  // Divide total by 2 since each game has 2 teams
  totalGames = totalGames / 2;

  // Calculate intensity based on comparison to season average
  const intensityPercentage = (totalGames / seasonAverageGames) * 100;

  let intensity: 'light' | 'average' | 'busy';
  if (intensityPercentage < 80) {
    intensity = 'light';
  } else if (intensityPercentage > 120) {
    intensity = 'busy';
  } else {
    intensity = 'average';
  }

  return {
    totalGames,
    gamesPerDay,
    intensity,
    intensityPercentage
  };
}

/**
 * Calculate season-wide average games per week
 * Fetches all weeks from the season and calculates the actual average
 */
export async function calculateSeasonAverage(): Promise<number> {
  const weekOptions = getWeekOptions();

  let totalGames = 0;
  let validWeeks = 0;

  // Fetch all weeks in parallel for speed
  const weekPromises = weekOptions.map(async (weekOption) => {
    try {
      const weekData = await fetchWeeklyScheduleData(weekOption.value);
      let weekGames = 0;

      weekData.days.forEach(day => {
        weekData.teams.forEach(team => {
          weekGames += (team.gamesByDay[day.id]?.length ?? 0);
        });
      });

      // Divide by 2 since each game has 2 teams
      return weekGames / 2;
    } catch (error) {
      console.error(`Failed to fetch week ${weekOption.value}:`, error);
      return 0;
    }
  });

  const weekTotals = await Promise.all(weekPromises);

  weekTotals.forEach(games => {
    if (games > 0) {
      totalGames += games;
      validWeeks++;
    }
  });

  return validWeeks > 0 ? totalGames / validWeeks : 90; // Fallback to 90 if calculation fails
}