import { filterDatesByRange } from './_lib/dates';
import { loadScheduleContext, SCHEDULES_NOT_LOADED, calculateBeforePlayoffsEndDate } from './_lib/schedule';
import { SEASON_START } from './_lib/season';
import { handleCors } from './_lib/respond';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  try {
    const { start, end } = req.query;

    // Load schedule data
    const scheduleContext = loadScheduleContext();

    if (!scheduleContext) {
      return res.status(500).json(SCHEDULES_NOT_LOADED);
    }

    // Step 1: Calculate which days are off-nights (≤ 8 total games)
    const gameCounts = new Map<string, number>();

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start as string, end as string);
      for (const date of filteredDates) {
        gameCounts.set(date, (gameCounts.get(date) || 0) + 1);
      }
    }

    // Since each game involves 2 teams, divide by 2 to get actual game count
    const actualGameCounts = new Map<string, number>();
    for (const [date, teamCount] of gameCounts.entries()) {
      actualGameCounts.set(date, Math.floor(teamCount / 2));
    }

    // Identify off-night dates (≤ 8 games total)
    const offNightDates = new Set<string>();
    for (const [date, gameCount] of actualGameCounts.entries()) {
      if (gameCount <= 8) {
        offNightDates.add(date);
      }
    }

    // Step 2: Count off-nights per team
    const results = [];
    const today = new Date().toISOString().split('T')[0];
    const beforePlayoffsEnd = calculateBeforePlayoffsEndDate();

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start as string, end as string);

      let totalOffNights = 0;
      let remainingOffNights = 0;

      for (const date of filteredDates) {
        if (offNightDates.has(date)) {
          totalOffNights++;
          if (date >= today) {
            remainingOffNights++;
          }
        }
      }

      // Calculate games before playoffs (season start to end of Week 21)
      const beforePlayoffsDates = filterDatesByRange(teamDates, SEASON_START, beforePlayoffsEnd);
      const gamesBeforePlayoffs = beforePlayoffsDates.size;

      const totalGames = filteredDates.size;
      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        totalOffNights,
        remainingOffNights,
        totalGames,
        gamesBeforePlayoffs
      });
    }

    // Sort by total off-nights descending, then remaining off-nights descending
    results.sort((a, b) =>
      b.totalOffNights - a.totalOffNights ||
      b.remainingOffNights - a.remainingOffNights
    );

    res.json(results);

  } catch (error) {
    console.error('[offnights] error:', error);
    res.status(500).json({ error: 'Failed to calculate off-nights' });
  }
}