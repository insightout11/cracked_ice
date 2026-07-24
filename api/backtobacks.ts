import { filterDatesByRange } from './_lib/dates';
import { loadScheduleContext, SCHEDULES_NOT_LOADED, calculateBeforePlayoffsEndDate } from './_lib/schedule';
import { SEASON_START } from './_lib/season';
import { handleCors } from './_lib/respond';

interface BackToBackResult {
  teamCode: string;
  teamName: string;
  totalBackToBack: number;
  remainingBackToBack: number;
  totalGames: number;
  gamesBeforePlayoffs: number;
}

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  try {
    const scheduleContext = loadScheduleContext();

    if (!scheduleContext) {
      return res.status(500).json(SCHEDULES_NOT_LOADED);
    }

    const { start, end } = req.query;

    console.log(`[backtobacks] ${start || 'season-start'}->${end || 'season-end'}`);
    const t0 = Date.now();

    // Step 1: Calculate back-to-back games for each team
    const results: BackToBackResult[] = [];
    const today = new Date().toISOString().split('T')[0];
    const beforePlayoffsEnd = calculateBeforePlayoffsEndDate();

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start, end);
      const sortedDates = Array.from(filteredDates).sort();

      let totalBackToBack = 0;
      let remainingBackToBack = 0;

      // Check each consecutive pair of dates
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const currentDate = new Date(sortedDates[i]);
        const nextDate = new Date(sortedDates[i + 1]);

        const diffTime = nextDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // If the difference is exactly 1 day, it's a back-to-back
        if (diffDays === 1) {
          totalBackToBack++;
          // Count as remaining if the second game is today or later
          if (sortedDates[i + 1] >= today) {
            remainingBackToBack++;
          }
        }
      }

      // Calculate games before playoffs (season start to end of Week 21)
      const beforePlayoffsDates = filterDatesByRange(teamDates, SEASON_START, beforePlayoffsEnd);
      const gamesBeforePlayoffs = beforePlayoffsDates.size;

      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        totalBackToBack,
        remainingBackToBack,
        totalGames: filteredDates.size, // Total games in the date range
        gamesBeforePlayoffs
      });
    }

    // Sort by total back-to-back descending, then remaining back-to-back descending
    results.sort((a, b) =>
      b.totalBackToBack - a.totalBackToBack ||
      b.remainingBackToBack - a.remainingBackToBack
    );

    console.log(`[backtobacks] ok in ${Date.now() - t0}ms`);
    res.json(results);

  } catch (error: any) {
    console.error('[backtobacks] error:', error);
    res.status(500).json({ error: 'Failed to calculate back-to-back games' });
  }
}