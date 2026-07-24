import { filterDatesByRange } from './_lib/dates';
import { loadScheduleContext, SCHEDULES_NOT_LOADED } from './_lib/schedule';
import { SEASON_START, SEASON_END } from './_lib/season';
import { handleCors } from './_lib/respond';

export default function handler(req: any, res: any) {
  if (handleCors(req, res, ['POST'])) return;

  try {
    const { rosterTeamCodes, start, end, slotsPerDay = 2 } = req.body;

    if (!rosterTeamCodes || !Array.isArray(rosterTeamCodes)) {
      return res.status(400).json({ error: 'rosterTeamCodes is required and must be an array' });
    }

    // Normalize team codes to uppercase
    const normalizedRoster = rosterTeamCodes.map((code: string) => code.toUpperCase());

    const scheduleContext = loadScheduleContext();

    if (!scheduleContext) {
      return res.status(500).json(SCHEDULES_NOT_LOADED);
    }

    // Validate all roster teams exist
    for (const teamCode of normalizedRoster) {
      if (!scheduleContext.sets.has(teamCode)) {
        return res.status(400).json({ error: 'unknown_roster_team', team: teamCode });
      }
    }

    const rosterSet = new Set(normalizedRoster);

    // Helper function to get filtered team dates
    const getTeamDates = (teamCode: string) => {
      const teamDates = scheduleContext.sets.get(teamCode);
      if (!teamDates) {
        throw new Error(`Unknown team: ${teamCode}`);
      }
      return teamDates;
    };

    // Build occupancy from current roster
    const occupancy = new Map<string, number>();
    for (const team of normalizedRoster) {
      const dates = filterDatesByRange(getTeamDates(team), start || SEASON_START, end || SEASON_END);
      for (const date of dates) {
        occupancy.set(date, (occupancy.get(date) || 0) + 1);
      }
    }

    // Get all teams and filter out roster teams
    const allTeams = Array.from(scheduleContext.sets.keys());

    // Score every other team
    const rows = allTeams
      .filter(team => !rosterSet.has(team))
      .map(team => {
        const dates = filterDatesByRange(getTeamDates(team), start || SEASON_START, end || SEASON_END);
        let added = 0;
        for (const date of dates) {
          if ((occupancy.get(date) || 0) < slotsPerDay) {
            added++;
          }
        }
        return {
          team,
          candidateGamesInWindow: dates.size,
          usableStarts: added,
          teamName: scheduleContext.teamNameMap.get(team) || team,
          abbreviation: team
        };
      });

    res.json({ rows });

  } catch (error) {
    console.error('[added-starts-bulk] error:', error);
    res.status(500).json({ error: 'Failed to calculate bulk added starts' });
  }
}