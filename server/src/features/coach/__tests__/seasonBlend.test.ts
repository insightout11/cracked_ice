import { describe, expect, it } from 'vitest';
import {
  blendedSeasonFppg,
  calculateFppgFromSkaterStats,
  calculatePlayerFppg,
  computeWindowFppg,
  goalieStartShare,
  PRIOR_WEIGHT_GAMES,
  ratingWindowFppg,
  statsContextPool,
} from '../scoring';
import type { PlayerStatsSnapshot, SkaterStats, StatsContext } from '../../../context/stats';

// Skater lines scored with the default weights; `rate` goals per game sets the FPPG.
const line = (gamesPlayed: number, goalsPerGame: number): SkaterStats => ({
  gamesPlayed,
  goals: Math.round(gamesPlayed * goalsPerGame),
  assists: 0,
  points: Math.round(gamesPlayed * goalsPerGame),
  shots: 0,
  shootingPct: 0,
  blocks: 0,
  plusMinus: 0,
  ppGoals: 0,
  ppAssists: 0,
  ppPoints: 0,
  shGoals: 0,
  shAssists: 0,
  shPoints: 0,
  hits: 0,
  gameWinningGoals: 0,
  toi: '0:00',
} as SkaterStats);

const fppg = (stats: SkaterStats) => calculateFppgFromSkaterStats(stats, null);

function context(extra: Record<string, Partial<PlayerStatsSnapshot>>): StatsContext {
  const players = new Map<string, PlayerStatsSnapshot>();
  // Forty forward regulars from last season, 0.1 to 0.49 goals per game.
  for (let index = 0; index < 40; index += 1) {
    players.set(`nhl:${index}`, { positionGroup: 'F', priorSeason: '20252026', priorSkaterStats: line(60, 0.1 + index / 100) } as PlayerStatsSnapshot);
  }
  Object.entries(extra).forEach(([id, snapshot]) => players.set(id, snapshot as PlayerStatsSnapshot));
  return { meta: { schemaVersion: null, generatedAt: 't', source: null, sourcePath: null, playerCount: players.size }, players };
}

describe('early-season blend', () => {
  const baseline = fppg(line(60, 0.1 + 12 / 100)); // 30th percentile of the forty regulars

  it('rates a veteran on last season before he plays, then moves toward this season', () => {
    const star = { positionGroup: 'F', priorSeason: '20252026', priorSkaterStats: line(82, 0.6) } as PlayerStatsSnapshot;
    const pool = statsContextPool(context({ star }));
    expect(blendedSeasonFppg(star, null, pool)).toEqual({ value: fppg(line(82, 0.6)), hasData: true });

    const twentyGames = { ...star, skaterStats: line(PRIOR_WEIGHT_GAMES, 0.2) };
    const midpoint = (fppg(line(20, 0.2)) + fppg(line(82, 0.6))) / 2;
    expect(blendedSeasonFppg(twentyGames, null, pool).value).toBeCloseTo(midpoint, 1);
  });

  it('keeps a rookie\'s hot start from outranking established players', () => {
    const rookie = { positionGroup: 'F', priorSeason: '20252026', skaterStats: line(3, 2) } as PlayerStatsSnapshot;
    const star = { positionGroup: 'F', priorSeason: '20252026', priorSkaterStats: line(82, 0.6) } as PlayerStatsSnapshot;
    const pool = statsContextPool(context({ rookie, star }));
    const rookieRate = blendedSeasonFppg(rookie, null, pool).value;
    expect(rookieRate).toBeCloseTo((3 * fppg(line(3, 2)) + PRIOR_WEIGHT_GAMES * baseline) / (3 + PRIOR_WEIGHT_GAMES), 1);
    expect(rookieRate).toBeLessThan(blendedSeasonFppg(star, null, pool).value);
  });

  it('tops up a short last season with the position baseline', () => {
    const callUp = { positionGroup: 'F', priorSeason: '20252026', priorSkaterStats: line(5, 1) } as PlayerStatsSnapshot;
    const pool = statsContextPool(context({ callUp }));
    const expected = (5 * fppg(line(5, 1)) + 15 * baseline) / 20;
    expect(blendedSeasonFppg(callUp, null, pool).value).toBeCloseTo(expected, 1);
  });

  it('leaves players with no NHL games in either season unrated', () => {
    const prospect = { positionGroup: 'F', priorSeason: '20252026' } as PlayerStatsSnapshot;
    expect(blendedSeasonFppg(prospect, null, statsContextPool(context({ prospect })))).toEqual({ value: 0, hasData: false });
  });

  it('changes nothing before the season switch', () => {
    const lastSeason = { skaterStats: line(82, 0.5) } as PlayerStatsSnapshot;
    const stats = context({ 'nhl:99': lastSeason });
    expect(computeWindowFppg(lastSeason, null, 'season', stats)).toEqual(computeWindowFppg(lastSeason, null, 'season'));
  });

  it('feeds the blend to the shared player FPPG used by projections and rosters', () => {
    const star = { positionGroup: 'F', priorSeason: '20252026', priorSkaterStats: line(82, 0.6), skaterStats: line(1, 0) } as PlayerStatsSnapshot;
    const stats = context({ 'nhl:8478402': star });
    const player = { id: '8478402', position: 'C', games_played: 1, stats: {} } as any;
    const expected = (fppg(line(1, 0)) + PRIOR_WEIGHT_GAMES * fppg(line(82, 0.6))) / (1 + PRIOR_WEIGHT_GAMES);
    expect(calculatePlayerFppg(player, null, stats)).toBeCloseTo(expected, 2);
  });

  it('reads a goalie workload as starts per team game, leaning on last season early', () => {
    const goalieLine = (gamesStarted: number) => ({ gamesPlayed: gamesStarted, gamesStarted } as any);
    // Before the switch: last season's full line, as before (41 of 82).
    expect(goalieStartShare({ goalieStats: goalieLine(41) } as PlayerStatsSnapshot)).toBe(0.5);
    // A starter with 5 starts in 6 team games is still a starter (the old formula read 5/82).
    const starter = { priorSeason: '20252026', priorGoalieStats: goalieLine(60), goalieStats: goalieLine(5), teamGamesPlayed: 6 } as PlayerStatsSnapshot;
    // (5 + 20 x 60/82) / 26 = 0.755, held to the 75% workload cap.
    expect(goalieStartShare(starter)).toBe(0.75);
    // Midseason: 25 starts in 41 team games, not 25/82.
    const midseason = { ...starter, goalieStats: goalieLine(25), teamGamesPlayed: 41 } as PlayerStatsSnapshot;
    expect(goalieStartShare(midseason)).toBeCloseTo((25 + 20 * (60 / 82)) / 61, 5);
    // Opening day, no games yet: last season's share. A goalie with no NHL starts is treated as a backup.
    expect(goalieStartShare({ ...starter, goalieStats: undefined, teamGamesPlayed: 0 } as PlayerStatsSnapshot)).toBeCloseTo(60 / 82, 5);
    expect(goalieStartShare({ priorSeason: '20252026', teamGamesPlayed: 0 } as PlayerStatsSnapshot)).toBe(0.3);
  });

  it('shrinks recent form toward the season rate and ignores windows under three games', () => {
    const hot = line(3, 2);
    const rookie = { positionGroup: 'F', priorSeason: '20252026', skaterStats: hot, last7SkaterStats: hot, last30SkaterStats: hot } as PlayerStatsSnapshot;
    const seasonRate = 2.31;
    const expected = (3 * fppg(hot) + 10 * seasonRate) / 13;
    expect(ratingWindowFppg(rookie, null, 'last7', seasonRate).value).toBeCloseTo(expected, 1);
    const twoGames = { ...rookie, last7SkaterStats: line(2, 2) } as PlayerStatsSnapshot;
    expect(ratingWindowFppg(twoGames, null, 'last7', seasonRate)).toEqual({ value: seasonRate, hasData: false });
  });
});
