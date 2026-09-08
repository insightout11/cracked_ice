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

export const OFF_NIGHT_GAME_THRESHOLD = 8;

export function getCanonicalOffNightDates(sets: Map<string, Set<string>>): Set<string> {
  const teamsByDate = new Map<string, number>();
  for (const dates of sets.values()) {
    for (const date of dates) teamsByDate.set(date, (teamsByDate.get(date) ?? 0) + 1);
  }
  return new Set([...teamsByDate.entries()]
    .filter(([, teamCount]) => teamCount > 0 && Math.ceil(teamCount / 2) <= OFF_NIGHT_GAME_THRESHOLD)
    .map(([date]) => date));
}

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

export function pctOffNightNonOverlap(seed: Set<string>, other: Set<string>, offNightDates: Set<string>) {
  let non = 0, off = 0;
  for (const d of other) {
    if (!seed.has(d)) {
      non++;
      if (offNightDates.has(d)) off++;
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
  
  const offNightDates: Set<string> = scheduleContext.offNightDates
    ?? getCanonicalOffNightDates(scheduleContext.sets);
  let offNightCount = 0;
  for (const date of uniqueDates) {
    if (offNightDates.has(date)) {
      offNightCount++;
    }
  }
  
  return offNightCount / uniqueDates.size;
}
