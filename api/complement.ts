import { countIntersect, countAminusB, pctOffNightNonOverlap, filterDatesByRange } from './_lib/dates';
import { loadScheduleContext, SCHEDULES_NOT_LOADED } from './_lib/schedule';
import { handleCors } from './_lib/respond';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['GET'])) return;

  try {
    const { seedTeamCode, start, end } = req.query;

    if (!seedTeamCode) {
      return res.status(400).json({ error: 'seedTeamCode parameter is required' });
    }

    const scheduleContext = loadScheduleContext();

    if (!scheduleContext) {
      return res.status(500).json(SCHEDULES_NOT_LOADED);
    }

    const seedTeamCodeUpper = String(seedTeamCode).toUpperCase();

    if (!scheduleContext.sets.has(seedTeamCodeUpper)) {
      return res.status(400).json({ error: 'unknown_team', team: seedTeamCodeUpper });
    }

    const seedTeamDates = scheduleContext.sets.get(seedTeamCodeUpper)!;
    const seedDatesFiltered = filterDatesByRange(seedTeamDates, start, end);

    if (seedDatesFiltered.size === 0) {
      return res.status(400).json({
        error: 'empty_seed_in_window',
        team: seedTeamCodeUpper,
        start,
        end,
        message: 'No games found for seed team in specified date range'
      });
    }

    // Calculate complements for all other teams
    const results = [];
    for (const [teamCode, teamDates] of scheduleContext.sets.entries()) {
      if (teamCode === seedTeamCodeUpper) continue;

      const teamDatesFiltered = filterDatesByRange(teamDates, start, end);

      const conflicts = countIntersect(seedDatesFiltered, teamDatesFiltered);
      const nonOverlap = countAminusB(teamDatesFiltered, seedDatesFiltered);
      const offNightShare = pctOffNightNonOverlap(seedDatesFiltered, teamDatesFiltered);

      results.push({
        teamCode,
        teamName: scheduleContext.teamNameMap.get(teamCode) || teamCode,
        conflicts,
        nonOverlap,
        offNightShare: Math.round(offNightShare * 1000) / 1000,
        // Legacy compatibility
        complement: nonOverlap,
        weightedComplement: nonOverlap,
        abbreviation: teamCode,
        datesComplement: [...teamDatesFiltered].filter(d => !seedDatesFiltered.has(d)).sort()
      });
    }

    // Sort by conflicts (asc), then nonOverlap (desc), then offNightShare (desc)
    results.sort((a, b) =>
      a.conflicts - b.conflicts ||
      b.nonOverlap - a.nonOverlap ||
      b.offNightShare - a.offNightShare
    );

    return res.json(results);
  } catch (error: any) {
    console.error('Complement endpoint error:', error);
    res.status(500).json({ error: 'Failed to calculate complements', details: error?.message });
  }
}
