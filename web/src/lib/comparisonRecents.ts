export interface RecentComparisonPlayer {
  id: string;
  name: string;
}

export interface RecentComparison {
  playerA: RecentComparisonPlayer;
  playerB: RecentComparisonPlayer;
  savedAt: string;
}

const KEY_PREFIX = 'cracked-ice:recent-comparison:';

export function loadRecentComparison(leagueId: string): RecentComparison | null {
  try {
    const value = localStorage.getItem(`${KEY_PREFIX}${leagueId}`);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<RecentComparison>;
    return parsed.playerA?.id && parsed.playerA.name && parsed.playerB?.id && parsed.playerB.name && parsed.savedAt
      ? parsed as RecentComparison
      : null;
  } catch {
    return null;
  }
}

export function saveRecentComparison(leagueId: string, comparison: Omit<RecentComparison, 'savedAt'>): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${leagueId}`, JSON.stringify({ ...comparison, savedAt: new Date().toISOString() }));
  } catch {
    // Recent comparison context is a convenience; URL state remains canonical.
  }
}
