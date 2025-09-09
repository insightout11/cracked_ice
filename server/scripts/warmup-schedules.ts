#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fetchWithTimeout, extractRegularSeasonDates, ClubScheduleSeason } from '../src/utils/schedule-utils';

const SEASON = '20252026';

interface NHLTeam {
  id: number;
  name: string;
  abbreviation: string;
}

interface GameDetails {
  date: string;
  opponent: string;
  isHome: boolean;
  gameId: number;
  venue: string;
  startTime?: string; // Full datetime from NHL API
}

interface SchedulePayload {
  season: string;
  teams: Record<string, string[]>;
  games: Record<string, GameDetails[]>;
  lastRefreshed: string;
}

async function fetchTeamList(): Promise<NHLTeam[]> {
  console.log('Fetching team list...');
  const response = await fetchWithTimeout('https://api.nhle.com/stats/rest/en/team');
  const data = await response.json();
  // Filter to current NHL teams and map the structure
  const currentTeams = data.data.filter((team: any) => 
    ['ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET','EDM','FLA',
     'LAK','MIN','MTL','NSH','NJD','NYI','NYR','OTT','PHI','PIT','SJS','SEA',
     'STL','TBL','TOR','UTA','VAN','VGK','WSH','WPG'].includes(team.triCode)
  );
  
  return currentTeams.map((team: any) => ({
    id: team.id,
    name: team.fullName,
    abbreviation: team.triCode
  }));
}

async function fetchTeamSchedule(triCode: string, teamId: number): Promise<{ dates: string[], games: GameDetails[] }> {
  console.log(`Fetching schedule for ${triCode}...`);
  
  const dates = new Set<string>();
  const games: GameDetails[] = [];
  
  // Fetch schedule data by week throughout the season
  // NHL 2025-2026 season runs from October 2025 to April 2026 (about 28 weeks)
  const seasonStart = new Date('2025-10-01');
  const seasonEnd = new Date('2026-04-30');
  
  let currentDate = new Date(seasonStart);
  
  while (currentDate <= seasonEnd) {
    try {
      const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log(`  Fetching ${triCode} games for week of ${dateStr}...`);
      
      const response = await fetchWithTimeout(`https://api-web.nhle.com/v1/schedule/${dateStr}`);
      const data = await response.json();
      
      // Process all games in the week data
      if (data.gameWeek && Array.isArray(data.gameWeek)) {
        for (const dayData of data.gameWeek) {
          if (dayData.games && Array.isArray(dayData.games)) {
            for (const game of dayData.games) {
              // Check if this game involves our team
              const homeTeam = game.homeTeam?.abbrev;
              const awayTeam = game.awayTeam?.abbrev;
              
              if (homeTeam === triCode || awayTeam === triCode) {
                const gameDate = dayData.date;
                const isHome = homeTeam === triCode;
                const opponent = isHome ? awayTeam : homeTeam;
                
                if (gameDate && opponent) {
                  dates.add(gameDate);
                  games.push({
                    date: gameDate,
                    opponent,
                    isHome,
                    gameId: game.id || 0,
                    venue: game.venue?.default || '',
                    startTime: game.startTimeUTC // Real NHL start time in UTC
                  });
                }
              }
            }
          }
        }
      }
      
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`  Failed to fetch ${triCode} for ${dateStr}: ${error}`);
    }
    
    // Advance by 7 days (1 week)
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return { 
    dates: [...dates].sort(), 
    games: games.sort((a, b) => a.date.localeCompare(b.date)) 
  };
}

async function main() {
  try {
    console.log(`Starting warmup for season ${SEASON}...`);
    
    // Fetch all teams
    const teams = await fetchTeamList();
    console.log(`Found ${teams.length} teams`);
    
    // Fetch schedules for each team
    const payload: SchedulePayload = {
      season: SEASON,
      teams: {},
      games: {},
      lastRefreshed: new Date().toISOString()
    };
    
    for (const team of teams) {
      const { dates, games } = await fetchTeamSchedule(team.abbreviation, team.id);
      payload.teams[team.abbreviation] = dates;
      payload.games[team.abbreviation] = games;
      console.log(`  ${team.abbreviation}: ${dates.length} games, ${games.length} detailed`);
    }
    
    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    mkdirSync(dataDir, { recursive: true });
    
    // Save to file
    const filePath = join(dataDir, `schedules-${SEASON}.json`);
    writeFileSync(filePath, JSON.stringify(payload, null, 2));
    
    console.log(`✅ Schedules saved to ${filePath}`);
    console.log(`Total teams: ${Object.keys(payload.teams).length}`);
    
  } catch (error) {
    console.error('❌ Warmup failed:', error);
    process.exit(1);
  }
}

main();