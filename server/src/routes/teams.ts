import { Router } from 'express';
import { format, addDays, startOfISOWeek, parseISO } from 'date-fns';

export const teamRoutes = Router();

teamRoutes.get('/', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ 
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    // Build teams list from loaded schedule data
    const teams = [];
    let id = 1;
    
    for (const [triCode, teamName] of scheduleContext.teamNameMap.entries()) {
      // Try to find the actual team ID for this triCode
      let teamId = id++;
      for (const [actualId, actualTriCode] of scheduleContext.idToTriCodeMap.entries()) {
        if (actualTriCode === triCode) {
          teamId = actualId;
          break;
        }
      }
      
      teams.push({
        id: teamId,
        name: teamName,
        abbreviation: triCode,
        triCode: triCode
      });
    }

    // Sort by abbreviation for consistency
    teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
    
    res.json(teams);
  } catch (error) {
    console.error('Error building teams list:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

// Weekly schedule endpoint
teamRoutes.get('/schedule/weekly', async (req, res) => {
  try {
    const scheduleContext = req.app.locals.schedules;
    
    if (!scheduleContext) {
      return res.status(500).json({ 
        error: 'schedules_not_warmed',
        message: 'Missing data/schedules-20252026.json — please warm schedules.'
      });
    }

    const weekIso = req.query.week as string || getCurrentWeekIso();
    
    // Parse the week and generate the 7 days
    const weekStart = startOfISOWeek(parseISO(weekIso));
    const days = [
      { id: 'Mon' as const, date: format(weekStart, 'MMM d') },
      { id: 'Tue' as const, date: format(addDays(weekStart, 1), 'MMM d') },
      { id: 'Wed' as const, date: format(addDays(weekStart, 2), 'MMM d') },
      { id: 'Thu' as const, date: format(addDays(weekStart, 3), 'MMM d') },
      { id: 'Fri' as const, date: format(addDays(weekStart, 4), 'MMM d') },
      { id: 'Sat' as const, date: format(addDays(weekStart, 5), 'MMM d') },
      { id: 'Sun' as const, date: format(addDays(weekStart, 6), 'MMM d') }
    ];

    // Build teams with their schedule data
    const teams = [];
    
    for (const [triCode, teamName] of scheduleContext.teamNameMap.entries()) {
      const teamSchedule = scheduleContext.sets.get(triCode);
      if (!teamSchedule) continue;
      
      const gamesByDay: Record<string, any[]> = {
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
        
        if (teamSchedule.has(dayDate)) {
          gamesByDay[day.id].push({
            opponent: 'TBD', // We'll need opponent data later
            opponentLogo: `https://assets.nhle.com/logos/nhl/svg/TBL_light.svg`,
            home: Math.random() > 0.5, // Random for now, need actual venue data
            start: `${dayDate}T19:00:00.000Z`
          });
        }
      });
      
      teams.push({
        team: triCode,
        teamName: teamName,
        logo: `https://assets.nhle.com/logos/nhl/svg/${triCode}_light.svg`,
        gamesByDay
      });
    }
    
    // Sort teams alphabetically by city name
    teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
    
    res.json({
      weekOf: weekIso,
      days,
      teams
    });
  } catch (error) {
    console.error('Error building weekly schedule:', error);
    res.status(500).json({ error: 'Failed to get weekly schedule' });
  }
});

function getCurrentWeekIso(): string {
  // Start the season at the first Monday in October 2025
  const seasonStart = new Date('2025-10-06'); // First Monday of October 2025
  return format(seasonStart, 'yyyy-MM-dd');
}