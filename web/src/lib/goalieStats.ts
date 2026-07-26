import type { RosterPlayer } from './coachSchemas';

export interface GoalieStatView {
  wins: number;
  losses: number;
  overtimeLosses: number;
  gamesStarted: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePercentage: number;
  goalsAgainstAverage: number;
  shutouts: number;
}

export function goalieStartShare(gamesStarted: number, teamGamesPlayed?: number): number | null {
  if (teamGamesPlayed === undefined || teamGamesPlayed <= 0) return null;
  return Math.min(100, Math.max(0, (gamesStarted / teamGamesPlayed) * 100));
}

function numberValue(stats: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = stats[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

export function goalieStatView(player: RosterPlayer): GoalieStatView {
  const stats = player.stats as Record<string, unknown>;
  const shotsAgainst = numberValue(stats, 'shots_against', 'shotsAgainst');
  const goalsAgainst = numberValue(stats, 'goals_against', 'goalsAgainst');
  const explicitSaves = numberValue(stats, 'saves');
  const saves = explicitSaves > 0 ? explicitSaves : Math.max(0, shotsAgainst - goalsAgainst);
  const explicitSavePct = numberValue(stats, 'save_percentage', 'savePct');
  const savePercentage = explicitSavePct > 0
    ? (explicitSavePct > 1 ? explicitSavePct / 100 : explicitSavePct)
    : shotsAgainst > 0 ? saves / shotsAgainst : 0;
  const explicitGaa = numberValue(stats, 'goals_against_average', 'goalsAgainstAverage', 'gaa');

  return {
    wins: numberValue(stats, 'wins'),
    losses: numberValue(stats, 'losses'),
    overtimeLosses: numberValue(stats, 'overtime_losses', 'overtimeLosses', 'otLosses'),
    gamesStarted: numberValue(stats, 'games_started', 'gamesStarted'),
    saves,
    shotsAgainst,
    goalsAgainst,
    savePercentage,
    goalsAgainstAverage: explicitGaa > 0
      ? explicitGaa
      : player.games_played > 0 ? goalsAgainst / player.games_played : 0,
    shutouts: numberValue(stats, 'shutouts'),
  };
}

