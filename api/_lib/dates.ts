// Shared date/set math for schedule analysis endpoints.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Off-nights: lighter NHL slates where streaming/extra starts are easiest.
export const OFF_NIGHTS = new Set(['Mon', 'Wed', 'Fri', 'Sun']);

export function weekdayOf(dateStr: string): string {
  return WD[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
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

export function pctOffNightNonOverlap(seedSet: Set<string>, candidateSet: Set<string>): number {
  const nonOverlapDates = [...candidateSet].filter(d => !seedSet.has(d));
  if (nonOverlapDates.length === 0) return 0;

  const offNightCount = nonOverlapDates.filter(d => OFF_NIGHTS.has(weekdayOf(d))).length;
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
