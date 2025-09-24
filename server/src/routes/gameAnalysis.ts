import { Router } from 'express';

const router = Router();

// Calculate end of Week 23 (before Week 24 starts) for fantasy playoffs
function calculateBeforePlayoffsEndDate(playoffStartWeek: number = 24): string {
  // Season starts October 1, 2025 (Monday)
  // Week 1 starts on the first Monday on or after October 1
  const seasonStart = new Date('2025-10-01');

  // Find the first Monday on or after season start
  const firstMonday = new Date(seasonStart);
  const dayOfWeek = firstMonday.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToAdd = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7; // Days to next Monday
  firstMonday.setDate(firstMonday.getDate() + daysToAdd);

  // Week before playoffs ends on Sunday, (playoffStartWeek - 1 - 1) weeks after Week 1 starts
  const weekBeforePlayoffsEnd = new Date(firstMonday);
  weekBeforePlayoffsEnd.setDate(weekBeforePlayoffsEnd.getDate() + ((playoffStartWeek - 2) * 7) + 6); // (weeks - 1) + 6 days to get to Sunday

  return weekBeforePlayoffsEnd.toISOString().split('T')[0];
}

// Utility functions
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

// Off-nights endpoint
router.get('/offnights', (req, res) => {
  try {
    const { start, end } = req.query;
    const scheduleContext = (req.app.locals as any).schedules;

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_loaded',
        message: 'Missing schedule data.'
      });
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
      const beforePlayoffsDates = filterDatesByRange(teamDates, '2025-10-01', beforePlayoffsEnd);
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
});

// Back-to-backs endpoint
router.get('/backtobacks', (req, res) => {
  try {
    const { start, end } = req.query;
    const scheduleContext = (req.app.locals as any).schedules;

    if (!scheduleContext) {
      return res.status(500).json({
        error: 'schedules_not_loaded',
        message: 'Missing schedule data.'
      });
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];
    const beforePlayoffsEnd = calculateBeforePlayoffsEndDate();

    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      const filteredDates = filterDatesByRange(teamDates, start as string, end as string);
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
      const beforePlayoffsDates = filterDatesByRange(teamDates, '2025-10-01', beforePlayoffsEnd);
      const gamesBeforePlayoffs = beforePlayoffsDates.size;

      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        totalBackToBack,
        remainingBackToBack,
        totalGames: filteredDates.size,
        gamesBeforePlayoffs
      });
    }

    // Sort by total back-to-back descending, then remaining back-to-back descending
    results.sort((a, b) =>
      b.totalBackToBack - a.totalBackToBack ||
      b.remainingBackToBack - a.remainingBackToBack
    );

    res.json(results);

  } catch (error) {
    console.error('[backtobacks] error:', error);
    res.status(500).json({ error: 'Failed to calculate back-to-backs' });
  }
});

export { router as gameAnalysisRoutes };