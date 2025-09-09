// Schedule parsing and set math utilities

export type ClubScheduleSeason = { 
  games: Array<{ 
    gameType: 1 | 2 | 3; 
    gameDate: string; 
  }> 
};

export function extractRegularSeasonDates(json: ClubScheduleSeason): string[] {
  const s = new Set<string>();
  for (const g of json.games || []) {
    if (g.gameType === 2 && g.gameDate) {
      s.add(g.gameDate);
    }
  }
  return [...s].sort();
}

// Weekday helpers
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export function weekdayOf(dateStr: string) {
  return WD[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
}
export const OFF_NIGHTS = new Set(['Mon', 'Wed', 'Fri', 'Sun']);

// Timeout fetch
export async function fetchWithTimeout(url: string, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Set math operations
export function countIntersect(a: Set<string>, b: Set<string>) {
  let c = 0;
  for (const d of a) if (b.has(d)) c++;
  return c;
}

export function countAminusB(a: Set<string>, b: Set<string>) {
  let c = 0;
  for (const d of a) if (!b.has(d)) c++;
  return c;
}

export function pctOffNightNonOverlap(seed: Set<string>, other: Set<string>) {
  let non = 0, off = 0;
  for (const d of other) {
    if (!seed.has(d)) {
      non++;
      if (OFF_NIGHTS.has(weekdayOf(d))) off++;
    }
  }
  return non ? off / non : 0;
}

export function filterByRange(s: Set<string>, start: string, end: string): Set<string> {
  const o = new Set<string>();
  for (const d of s) if (d >= start && d <= end) o.add(d);
  return o;
}

export function unionSets(...sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const s of sets) {
    for (const item of s) result.add(item);
  }
  return result;
}

export function calculateUsableStarts(teamCombination: string[], scheduleContext: any, slotsPerDay = 2): number {
  const perDayCount: Record<string, number> = {};
  
  // Build per-day counts for the combination
  for (const teamCode of teamCombination) {
    const teamDates = scheduleContext.sets.get(teamCode);
    if (!teamDates) continue;
    
    for (const date of teamDates) {
      perDayCount[date] = (perDayCount[date] || 0) + 1;
    }
  }
  
  // Calculate slot-aware score
  let score = 0;
  for (const count of Object.values(perDayCount)) {
    score += Math.min(slotsPerDay, count);
  }
  
  return score;
}

export function calculateOffNightPct(teamCombination: string[], scheduleContext: any): number {
  const uniqueDates = new Set<string>();
  
  // Collect all unique dates from the combination
  for (const teamCode of teamCombination) {
    const teamDates = scheduleContext.sets.get(teamCode);
    if (!teamDates) continue;
    
    for (const date of teamDates) {
      uniqueDates.add(date);
    }
  }
  
  if (uniqueDates.size === 0) return 0;
  
  let offNightCount = 0;
  for (const date of uniqueDates) {
    if (OFF_NIGHTS.has(weekdayOf(date))) {
      offNightCount++;
    }
  }
  
  return offNightCount / uniqueDates.size;
}