import { describe, expect, it } from 'vitest';
import { calculateTimeWindowStats, mergeSeasonStints } from '../../../../../apps/api/src/services/providers/nhl_api_web';

describe('NHL provider: season history', () => {
  it("sums a traded skater's stints into one season, teams in the order played", () => {
    // Nazem Kadri, 2025-26: 61 games in Calgary, then 16 in Colorado.
    const merged = mergeSeasonStints([
      { season: 20252026, sequence: 2, gamesPlayed: 16, goals: 4, assists: 5, points: 9, teamName: { default: 'Colorado Avalanche' } },
      { season: 20252026, sequence: 1, gamesPlayed: 61, goals: 18, assists: 23, points: 41, teamName: { default: 'Calgary Flames' } },
      { season: 20242025, sequence: 1, gamesPlayed: 82, goals: 35, assists: 32, points: 67, teamName: { default: 'Calgary Flames' } },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({ season: '20252026', gamesPlayed: 77, goals: 22, assists: 28, points: 50, teams: ['Calgary Flames', 'Colorado Avalanche'] });
  });

  it("combines a traded goalie's stints with time on ice and shots for GAA and save %", () => {
    const [season] = mergeSeasonStints([
      { season: 20252026, sequence: 1, gamesPlayed: 2, goalsAgainst: 2, shotsAgainst: 60, timeOnIce: '60:00', goalsAgainstAvg: 2, savePctg: 0.967, teamAbbrev: 'AAA' },
      { season: 20252026, sequence: 2, gamesPlayed: 1, goalsAgainst: 1, shotsAgainst: 30, timeOnIce: '30:00', goalsAgainstAvg: 2, savePctg: 0.967, teamAbbrev: 'BBB' },
    ]);
    // 3 goals over 90 minutes: the NHL's GAA is 2.00 however the minutes split into appearances.
    expect(season).toMatchObject({ gamesPlayed: 3, goalsAgainst: 3, shotsAgainst: 90, toiSeconds: 5400 });
    expect((season.goalsAgainst * 3600) / season.toiSeconds).toBeCloseTo(2);
  });
});

describe('NHL provider: recent-form windows', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const log = [
    { gameId: 1, gameDate: '2026-11-18', goals: 1, assists: 2, points: 3, shots: 4, plusMinus: 2, pim: 2, powerPlayGoals: 1, powerPlayPoints: 2, shorthandedGoals: 0, shorthandedPoints: 1, gameWinningGoals: 1 },
    { gameId: 2, gameDate: '2026-11-16', goals: 0, assists: 1, points: 1, shots: 2, plusMinus: -1, pim: 0, powerPlayGoals: 0, powerPlayPoints: 1, shorthandedGoals: 0, shorthandedPoints: 0 },
    { gameId: 3, gameDate: '2026-09-01', goals: 5, assists: 0, points: 5, shots: 9, plusMinus: 3, pim: 10, powerPlayGoals: 0, powerPlayPoints: 0, shorthandedGoals: 0, shorthandedPoints: 0 },
  ];

  it('keeps +/-, PIM and PP/SH assists, with hits and blocks from the game-by-game rows', () => {
    const realtime = new Map([[1, { hits: 3, blockedShots: 1 }], [2, { hits: 2, blockedShots: 0 }]]);
    const { skater } = calculateTimeWindowStats(log, 30, { realtime, now });
    expect(skater).toMatchObject({ gamesPlayed: 2, plusMinus: 1, pim: 2, ppGoals: 1, ppAssists: 2, shAssists: 1, gameWinningGoals: 1, hits: 5, blocks: 1 });
  });

  it("falls back to the season's per-game hits and blocks when the game rows are missing", () => {
    const { skater } = calculateTimeWindowStats(log, 30, { season: { hits: 100, blocks: 40, gamesPlayed: 20 }, now });
    expect(skater).toMatchObject({ hits: 10, blocks: 4 });
  });
});
