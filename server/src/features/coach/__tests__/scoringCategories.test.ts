import { describe, expect, it } from 'vitest';
import { calculateFppgFromGoalieStats, calculateFppgFromSkaterStats, calculateSkaterFppgBreakdown } from '../scoring';

const skater = {
  goals: 10, assists: 10, points: 20, gamesPlayed: 10, shots: 30, shootingPct: 33, blocks: 0, plusMinus: 0,
  ppGoals: 0, ppAssists: 0, ppPoints: 0, shGoals: 0, shAssists: 0, shPoints: 0, hits: 0, gameWinningGoals: 0, toi: '15:00',
  pim: 20, faceoffsWon: 100, faceoffsLost: 80,
};
const league = (skater_scoring: Record<string, number>, goalie_scoring: Record<string, number> = {}) =>
  ({ league_name: 'Test', scoring_type: 'points', skater_scoring, goalie_scoring } as any);

describe('scoring categories', () => {
  it('scores penalty minutes and faceoffs won and lost, under either spelling', () => {
    // (20 PIM x 0.5 + 100 FW x 0.1 - 80 FL x 0.1) / 10 games
    expect(calculateFppgFromSkaterStats(skater, league({ penalty_minutes: 0.5, faceoffs_won: 0.1, faceoffs_lost: -0.1 }))).toBe(1.2);
    expect(calculateFppgFromSkaterStats(skater, league({ pim: 0.5, faceoff_wins: 0.1, faceoff_losses: -0.1 }))).toBe(1.2);
  });

  it('lists the new categories in the breakdown', () => {
    const breakdown = calculateSkaterFppgBreakdown(skater, league({ penalty_minutes: 1 }));
    expect(breakdown?.contributions).toEqual([expect.objectContaining({ key: 'penalty_minutes', stat: 20, fppg: 2 })]);
  });

  it('scores goalie shots against', () => {
    const goalie = { wins: 0, losses: 0, overtimeLosses: 0, gamesPlayed: 2, gamesStarted: 2, saves: 55, shotsAgainst: 60, goalsAgainst: 5, savePct: 0.917, gaa: 2.5, shutouts: 0, toi: '120:00' };
    expect(calculateFppgFromGoalieStats(goalie, league({}, { shots_against: 0.1 }))).toBe(3);
  });
});
