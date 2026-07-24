import { filterDatesByRange } from './_lib/dates.js';
import { loadScheduleContext, SCHEDULES_NOT_LOADED } from './_lib/schedule.js';
import { handleCors } from './_lib/respond.js';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['POST'])) return;

  try {
    const { rosterTeamCodes, candidateTeamCode, start, end, slotsPerDay = 2 } = req.body;

    if (!rosterTeamCodes || !Array.isArray(rosterTeamCodes) || !candidateTeamCode) {
      return res.status(400).json({ error: 'rosterTeamCodes and candidateTeamCode are required' });
    }

    // Normalize team codes to uppercase
    const normalizedRoster = rosterTeamCodes.map((code: string) => code.toUpperCase());
    const normalizedCandidate = candidateTeamCode.toUpperCase();

    const scheduleContext = loadScheduleContext();

    if (!scheduleContext) {
      return res.status(500).json(SCHEDULES_NOT_LOADED);
    }

    // Validate all teams exist
    if (!scheduleContext.sets.has(normalizedCandidate)) {
      return res.status(400).json({ error: 'unknown_team', team: normalizedCandidate });
    }
    for (const teamCode of normalizedRoster) {
      if (!scheduleContext.sets.has(teamCode)) {
        return res.status(400).json({ error: 'unknown_roster_team', team: teamCode });
      }
    }

    // Helper function to get filtered team dates
    const getFilteredTeamDates = (teamCode: string): Set<string> => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return filterDatesByRange(teamDates, start, end);
    };

    // Build occupancy map from roster teams
    const occupiedPerDay = new Map<string, number>();
    for (const teamCode of normalizedRoster) {
      const teamDates = getFilteredTeamDates(teamCode);
      for (const date of teamDates) {
        occupiedPerDay.set(date, (occupiedPerDay.get(date) || 0) + 1);
      }
    }

    // Get candidate team's dates in the window
    const candidateDates = getFilteredTeamDates(normalizedCandidate);

    // Count only candidate dates that have available slots
    const addedDates: string[] = [];
    for (const date of candidateDates) {
      if ((occupiedPerDay.get(date) || 0) < slotsPerDay) {
        addedDates.push(date);
      }
    }

    res.json({
      addedStarts: addedDates.length,
      dates: addedDates.sort(),
      candidateGamesInWindow: candidateDates.size,
      sampleAddedDates: addedDates.slice(0, 10),
      diagnostics: {
        rosterTeams: normalizedRoster,
        candidateTeam: normalizedCandidate,
        dateRange: { start, end },
        slotsPerDay
      }
    });

  } catch (error) {
    console.error('[added-starts] error:', error);
    res.status(500).json({ error: 'Failed to calculate added starts' });
  }
}
