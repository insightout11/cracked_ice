import { describe, it, expect } from 'vitest';
import { computeWindowFppg, calculateFppgFromSkaterStats, calculateFppgFromGoalieStats } from '../scoring';
import type { PlayerStatsSnapshot, SkaterStats, GoalieStats } from '../../../context/stats';
import type { LeagueProfile } from '../types';

describe('Window FPPG Helpers', () => {
  const simpleLeague: LeagueProfile = {
    league_name: 'Test League',
    scoring_type: 'points',
    preset_name: 'Test',
    lineup_slots: { C: 2, LW: 2, RW: 2, D: 4, G: 2 },
    skater_scoring: {
      goals: 3,
      assists: 2,
      shots_on_goal: 0.5,
      hits: 0.3,
      blocks: 0.3
    },
    goalie_scoring: {
      wins: 5,
      saves: 0.3,
      goals_against: -1,
      shutouts: 3
    }
  };

  describe('calculateFppgFromSkaterStats', () => {
    it('should calculate FPPG for a skater with positive games played', () => {
      const stats: SkaterStats = {
        gamesPlayed: 10,
        goals: 5,
        assists: 8,
        shots: 30,
        hits: 20,
        blocks: 15,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
        gameWinningGoals: 0,
        otGoals: 0,
        faceoffWinPct: 0,
        timeOnIcePerGame: 0
      };

      // Expected: (5*3 + 8*2 + 30*0.5 + 20*0.3 + 15*0.3) / 10
      //         = (15 + 16 + 15 + 6 + 4.5) / 10 = 56.5 / 10 = 5.65
      const fppg = calculateFppgFromSkaterStats(stats, simpleLeague);
      expect(fppg).toBe(5.65);
    });

    it('should return 0 for a skater with 0 games played', () => {
      const stats: SkaterStats = {
        gamesPlayed: 0,
        goals: 5,
        assists: 8,
        shots: 30,
        hits: 20,
        blocks: 15,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
        gameWinningGoals: 0,
        otGoals: 0,
        faceoffWinPct: 0,
        timeOnIcePerGame: 0
      };

      const fppg = calculateFppgFromSkaterStats(stats, simpleLeague);
      expect(fppg).toBe(0);
    });

    it('should return 0 for undefined stats', () => {
      const fppg = calculateFppgFromSkaterStats(undefined, simpleLeague);
      expect(fppg).toBe(0);
    });
  });

  describe('calculateFppgFromGoalieStats', () => {
    it('should calculate FPPG for a goalie with positive games played', () => {
      const stats: GoalieStats = {
        gamesPlayed: 5,
        gamesStarted: 5,
        wins: 3,
        losses: 2,
        overtimeLosses: 0,
        shotsAgainst: 150,
        saves: 140,
        goalsAgainst: 10,
        savePercentage: 0.933,
        goalsAgainstAverage: 2.0,
        shutouts: 1,
        timeOnIce: 300
      };

      // Expected: (3*5 + 140*0.3 + 10*-1 + 1*3) / 5
      //         = (15 + 42 - 10 + 3) / 5 = 50 / 5 = 10.00
      const fppg = calculateFppgFromGoalieStats(stats, simpleLeague);
      expect(fppg).toBe(10);
    });

    it('should return 0 for a goalie with 0 games played', () => {
      const stats: GoalieStats = {
        gamesPlayed: 0,
        gamesStarted: 0,
        wins: 3,
        losses: 2,
        overtimeLosses: 0,
        shotsAgainst: 150,
        saves: 140,
        goalsAgainst: 10,
        savePercentage: 0.933,
        goalsAgainstAverage: 2.0,
        shutouts: 1,
        timeOnIce: 300
      };

      const fppg = calculateFppgFromGoalieStats(stats, simpleLeague);
      expect(fppg).toBe(0);
    });

    it('should return 0 for undefined stats', () => {
      const fppg = calculateFppgFromGoalieStats(undefined, simpleLeague);
      expect(fppg).toBe(0);
    });
  });

  describe('computeWindowFppg', () => {
    it('should calculate season FPPG for a skater snapshot', () => {
      const snapshot: PlayerStatsSnapshot = {
        skaterStats: {
          gamesPlayed: 20,
          goals: 10,
          assists: 15,
          shots: 60,
          hits: 40,
          blocks: 30,
          plusMinus: 0,
          ppGoals: 0,
          ppAssists: 0,
          ppPoints: 0,
          shGoals: 0,
          shAssists: 0,
          shPoints: 0,
          gameWinningGoals: 0,
          otGoals: 0,
          faceoffWinPct: 0,
          timeOnIcePerGame: 0
        }
      };

      // Expected: (10*3 + 15*2 + 60*0.5 + 40*0.3 + 30*0.3) / 20
      //         = (30 + 30 + 30 + 12 + 9) / 20 = 111 / 20 = 5.55
      const result = computeWindowFppg(snapshot, simpleLeague, 'season');
      expect(result.hasData).toBe(true);
      expect(result.value).toBe(5.55);
    });

    it('should calculate last30 FPPG for a skater snapshot', () => {
      const snapshot: PlayerStatsSnapshot = {
        last30SkaterStats: {
          gamesPlayed: 10,
          goals: 6,
          assists: 8,
          shots: 30,
          hits: 20,
          blocks: 15,
          plusMinus: 0,
          ppGoals: 0,
          ppAssists: 0,
          ppPoints: 0,
          shGoals: 0,
          shAssists: 0,
          shPoints: 0,
          gameWinningGoals: 0,
          otGoals: 0,
          faceoffWinPct: 0,
          timeOnIcePerGame: 0
        }
      };

      // Expected: (6*3 + 8*2 + 30*0.5 + 20*0.3 + 15*0.3) / 10
      //         = (18 + 16 + 15 + 6 + 4.5) / 10 = 59.5 / 10 = 5.95
      const result = computeWindowFppg(snapshot, simpleLeague, 'last30');
      expect(result.hasData).toBe(true);
      expect(result.value).toBe(5.95);
    });

    it('should calculate last7 FPPG for a goalie snapshot', () => {
      const snapshot: PlayerStatsSnapshot = {
        last7GoalieStats: {
          gamesPlayed: 3,
          gamesStarted: 3,
          wins: 2,
          losses: 1,
          overtimeLosses: 0,
          shotsAgainst: 90,
          saves: 85,
          goalsAgainst: 5,
          savePercentage: 0.944,
          goalsAgainstAverage: 1.67,
          shutouts: 0,
          timeOnIce: 180
        }
      };

      // Expected: (2*5 + 85*0.3 + 5*-1 + 0*3) / 3
      //         = (10 + 25.5 - 5 + 0) / 3 = 30.5 / 3 = 10.17
      const result = computeWindowFppg(snapshot, simpleLeague, 'last7');
      expect(result.hasData).toBe(true);
      expect(result.value).toBe(10.17);
    });

    it('should return hasData=false when window has no data', () => {
      const snapshot: PlayerStatsSnapshot = {
        skaterStats: {
          gamesPlayed: 20,
          goals: 10,
          assists: 15,
          shots: 60,
          hits: 40,
          blocks: 30,
          plusMinus: 0,
          ppGoals: 0,
          ppAssists: 0,
          ppPoints: 0,
          shGoals: 0,
          shAssists: 0,
          shPoints: 0,
          gameWinningGoals: 0,
          otGoals: 0,
          faceoffWinPct: 0,
          timeOnIcePerGame: 0
        }
        // No last30SkaterStats
      };

      const result = computeWindowFppg(snapshot, simpleLeague, 'last30');
      expect(result.hasData).toBe(false);
      expect(result.value).toBe(0);
    });

    it('should return hasData=false when games played is 0', () => {
      const snapshot: PlayerStatsSnapshot = {
        last7SkaterStats: {
          gamesPlayed: 0,
          goals: 0,
          assists: 0,
          shots: 0,
          hits: 0,
          blocks: 0,
          plusMinus: 0,
          ppGoals: 0,
          ppAssists: 0,
          ppPoints: 0,
          shGoals: 0,
          shAssists: 0,
          shPoints: 0,
          gameWinningGoals: 0,
          otGoals: 0,
          faceoffWinPct: 0,
          timeOnIcePerGame: 0
        }
      };

      const result = computeWindowFppg(snapshot, simpleLeague, 'last7');
      expect(result.hasData).toBe(false);
      expect(result.value).toBe(0);
    });

    it('should return hasData=false for undefined snapshot', () => {
      const result = computeWindowFppg(undefined, simpleLeague, 'season');
      expect(result.hasData).toBe(false);
      expect(result.value).toBe(0);
    });
  });
});
