import { describe, expect, it } from 'vitest';
import { calculateRoleTrend } from './roleTrend';

describe('calculateRoleTrend power-play share provenance', () => {
  it('uses direct season and recent team PP denominators when hydrated', () => {
    const result = calculateRoleTrend(
      { avgToiPerGame: 1000, ppTimeOnIcePerGame: 120 },
      { avgToiPerGame: 1050, ppTimeOnIcePerGame: 150, gamesPlayed: 4 },
      [],
      'UTA',
      { byTeam: new Map([['UTA', {
        ppTimeOnIcePerGame: 240,
        last7PpTimeOnIcePerGame: 300,
        last7PpGamesPlayed: 4,
      }]]) },
    );

    expect(result?.season.ppPct).toBe(50);
    expect(result?.last7.ppPct).toBe(50);
    expect(result?.ppShareSource).toEqual({ season: 'direct', last7: 'direct' });
  });

  it('labels teammate-derived recent PP share as estimated', () => {
    const result = calculateRoleTrend(
      { avgToiPerGame: 1000, ppTimeOnIcePerGame: 120 },
      { avgToiPerGame: 1050, ppTimeOnIcePerGame: 150, gamesPlayed: 4 },
      [{
        team: 'ANA',
        advancedStats: { ppTimeOnIcePerGame: 100 },
        advancedStatsWindow: { ppTimeOnIcePerGame: 100 },
      }],
      'ANA',
      { byTeam: new Map([['ANA', { ppTimeOnIcePerGame: 240 }]]) },
    );

    expect(result?.ppShareSource).toEqual({ season: 'direct', last7: 'estimated' });
  });
  it('returns null for goalies instead of a skater PP share', () => {
    // A goalie's on-ice time is the whole game, so dividing it by a skater's PP
    // workload used to yield a meaningless share pinned near 100%.
    const args = [
      { avgToiPerGame: 3540, ppTimeOnIcePerGame: 235 },
      { avgToiPerGame: 3600, ppTimeOnIcePerGame: 240, gamesPlayed: 4 },
      [{ team: 'ANA', advancedStats: { ppTimeOnIcePerGame: 240 } }],
      'ANA',
      { byTeam: new Map([['ANA', { ppTimeOnIcePerGame: 240 }]]) },
    ] as const;

    const skater = calculateRoleTrend(...args);
    expect(skater?.season.ppPct).toBeGreaterThan(90);

    const goalie = calculateRoleTrend(...args, { isGoalie: true });
    expect(goalie).toBeNull();
  });
});
