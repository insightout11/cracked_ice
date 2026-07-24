import { filterDatesByRange, OFF_NIGHTS, weekdayOf } from './dates';
import type { ScheduleContext } from './schedule';

export interface PairingResult {
  team: string;
  teamName: string;
  addedStarts: number;
  separateNights: number;
  sharedNights: number;
  blockedGames: number;
  conflicts: number;
  offNightShare: number;
  addedDates: string[];
  gamesByDate: Record<string, true>;
}

export interface PairingsResponse {
  mode: 'pair-building' | 'added-starts';
  slotsPerDay: number;
  baseline: {
    usableStarts: number;
    teams: string[];
  };
  results: PairingResult[];
  anchorsGamesByDate: Record<string, string[]>;
}

export function calculatePairings(
  scheduleContext: ScheduleContext,
  anchorTeams: string[],
  start: string,
  end: string,
  slotsPerDay: number
): PairingsResponse {
  const normalizedAnchors = anchorTeams.map((team) => team.trim().toUpperCase()).filter(Boolean);
  const anchorSet = new Set(normalizedAnchors);
  const occupancy = new Map<string, number>();
  const anchorsGamesByDate: Record<string, string[]> = {};

  for (const team of normalizedAnchors) {
    const dates = filterDatesByRange(scheduleContext.sets.get(team)!, start, end);
    for (const date of dates) {
      occupancy.set(date, (occupancy.get(date) ?? 0) + 1);
      (anchorsGamesByDate[date] ??= []).push(team);
    }
  }

  const usableStarts = [...occupancy.values()].reduce(
    (total, starts) => total + Math.min(starts, slotsPerDay),
    0
  );
  const mode = normalizedAnchors.length < slotsPerDay ? 'pair-building' : 'added-starts';

  const results = [...scheduleContext.sets.entries()]
    .filter(([team]) => !anchorSet.has(team))
    .map(([team, schedule]) => {
      const dates = [...filterDatesByRange(schedule, start, end)].sort();
      const addedDates = dates.filter((date) => (occupancy.get(date) ?? 0) < slotsPerDay);
      const separateNights = dates.filter((date) => (occupancy.get(date) ?? 0) === 0).length;
      const sharedNights = dates.length - separateNights;
      const blockedGames = dates.filter((date) => (occupancy.get(date) ?? 0) >= slotsPerDay).length;
      const offNightStarts = addedDates.filter((date) => OFF_NIGHTS.has(weekdayOf(date))).length;

      return {
        team,
        teamName: scheduleContext.teamNameMap.get(team) ?? team,
        addedStarts: addedDates.length,
        separateNights,
        sharedNights,
        blockedGames,
        conflicts: blockedGames,
        offNightShare: addedDates.length
          ? Math.round((offNightStarts / addedDates.length) * 1000) / 1000
          : 0,
        addedDates,
        gamesByDate: Object.fromEntries(dates.map((date) => [date, true])) as Record<string, true>
      };
    })
    .sort((a, b) => mode === 'pair-building'
      ? a.sharedNights - b.sharedNights ||
        b.separateNights - a.separateNights ||
        b.offNightShare - a.offNightShare ||
        a.team.localeCompare(b.team)
      : b.addedStarts - a.addedStarts ||
        b.offNightShare - a.offNightShare ||
        a.blockedGames - b.blockedGames ||
        a.team.localeCompare(b.team)
    );

  return {
    mode,
    slotsPerDay,
    baseline: { usableStarts, teams: normalizedAnchors },
    results,
    anchorsGamesByDate: Object.fromEntries(
      Object.entries(anchorsGamesByDate).sort(([a], [b]) => a.localeCompare(b))
    )
  };
}
