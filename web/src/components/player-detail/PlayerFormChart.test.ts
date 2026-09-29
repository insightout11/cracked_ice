import { describe, expect, it } from 'vitest';
import { fantasyPoints } from './PlayerFormChart';
import type { GameLogEntry, LeagueProfile } from '../../lib/coachSchemas';

const game: GameLogEntry = {
  gameDate: '2026-10-10', goals: 1, assists: 2, points: 3, shots: 4, plusMinus: 1, pim: 2, hits: 1, blocks: 0,
  powerPlayGoals: 1, powerPlayPoints: 2, shorthandedGoals: 0, shorthandedPoints: 1, gameWinningGoals: 1,
};

describe('form chart fantasy points', () => {
  it('counts points, PP/SH goals and assists, game-winners and PIM like the season rate does', () => {
    const profile = { league_name: 'Test', scoring_type: 'points', skater_scoring: {
      points: 1, powerplay_goals: 1, powerplay_assists: 1, shorthanded_assists: 2, game_winning_goals: 1, pim: 0.5,
    } } as unknown as LeagueProfile;
    // 3 points + 1 PPG + 1 PPA + 2 x 1 SHA + 1 GWG + 0.5 x 2 PIM
    expect(fantasyPoints(game, profile, false)).toBe(9);
  });

  it('scores goalie shots against', () => {
    const profile = { league_name: 'Test', scoring_type: 'points', skater_scoring: {}, goalie_scoring: { shots_against: 0.1, wins: 2 } } as unknown as LeagueProfile;
    expect(fantasyPoints({ ...game, decision: 'W', shotsAgainst: 30 }, profile, true)).toBe(5);
  });
});
