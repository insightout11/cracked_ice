// Shared date/set math for schedule analysis endpoints.

export const OFF_NIGHT_GAME_THRESHOLD = 8;

/** Derive low-volume dates from the validated league schedule (two teams/game). */
export function getCanonicalOffNightDates(sets: Map<string, Set<string>>): Set<string> {
  const teamsByDate = new Map<string, number>();
  for (const dates of sets.values()) {
    for (const date of dates) teamsByDate.set(date, (teamsByDate.get(date) ?? 0) + 1);
  }
  return new Set([...teamsByDate.entries()]
    .filter(([, teamCount]) => teamCount > 0 && Math.ceil(teamCount / 2) <= OFF_NIGHT_GAME_THRESHOLD)
    .map(([date]) => date));
}

export function countIntersect(setA: Set<string>, setB: Set<string>): number {
  let count = 0;
  for (const item of setA) {
    if (setB.has(item)) count++;
  }
  return count;
}

export function countAminusB(setA: Set<string>, setB: Set<string>): number {
  let count = 0;
  for (const item of setA) {
    if (!setB.has(item)) count++;
  }
  return count;
}

export function pctOffNightNonOverlap(seedSet: Set<string>, candidateSet: Set<string>, offNightDates: Set<string>): number {
  const nonOverlapDates = [...candidateSet].filter(d => !seedSet.has(d));
  if (nonOverlapDates.length === 0) return 0;

  const offNightCount = nonOverlapDates.filter(d => offNightDates.has(d)).length;
  return offNightCount / nonOverlapDates.length;
}

export function filterDatesByRange(dateSet: Set<string>, start?: string, end?: string): Set<string> {
  if (!start && !end) return dateSet;

  return new Set([...dateSet].filter(date => {
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }));
}
