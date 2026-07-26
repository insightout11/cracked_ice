import { describe, expect, it } from 'vitest';
import type { DraftPlayer } from './playerSearch';
import { buildNextSeasonProjection, buildNextSeasonProjectionMap } from './draftProjection';

function player(id: string, fppg: number, games: number, options: Partial<DraftPlayer> = {}): DraftPlayer {
  return {
    id,
    name: id,
    team: 'ANA',
    pos: ['C'],
    aliases: [],
    blendedFppg: fppg,
    productionValue: fppg,
    productionLabel: 'FPPG',
    nhlGamesPlayed: games,
    scoringBreakdown: null,
    ...options,
  };
}

describe('next-season draft projection', () => {
  it('applies a capped rising trend, age curve, and strong role without hiding the baseline', () => {
    const rising = player('rising', 4, 75, {
      birthDate: '2004-01-01',
      avgToiPerGame: 20.5 * 60,
      ppTimeOnIcePerGame: 3.5 * 60,
      recentSeasons: [
        { season: '20252026', gamesPlayed: 75, pointsPerGame: 1.0 },
        { season: '20242025', gamesPlayed: 70, pointsPerGame: 0.7 },
        { season: '20232024', gamesPlayed: 65, pointsPerGame: 0.6 },
      ],
    });
    const peers = [rising, player('peer1', 3, 70), player('peer2', 3.2, 72)];
    const projection = buildNextSeasonProjection(rising, peers, '2026-10-01');

    expect(projection.baselineFppg).toBe(4);
    expect(projection.projectedFppg).toBeGreaterThan(4);
    expect(projection.trajectory).toBe('rising');
    expect(projection.confidence).toBe('high');
    expect(projection.reasons.join(' ')).toContain('scoring trend');
    expect(projection.reasons.join(' ')).toContain('power-play role');
  });

  it('regresses a small skater sample toward positional peers', () => {
    const small = player('small', 6, 8, { recentSeasons: [{ season: '20252026', gamesPlayed: 8, pointsPerGame: 1.2 }] });
    const directory = [small, player('peer1', 3, 70), player('peer2', 3.2, 72), player('peer3', 2.8, 65)];
    const projection = buildNextSeasonProjection(small, directory, '2026-10-01');

    expect(projection.projectedFppg).toBeLessThan(5);
    expect(projection.reliability).toBeLessThan(0.4);
    expect(projection.confidence).toBe('low');
    expect(projection.reasons.join(' ')).toContain('regression');
  });

  it('uses workload, save-percentage volatility, and stronger regression for goalies', () => {
    const breakout = player('breakout', 5, 10, {
      pos: ['G'],
      recentSeasons: [{ season: '20252026', gamesPlayed: 10, savePct: 0.925 }],
    });
    const starter = player('starter', 4, 55, {
      pos: ['G'],
      recentSeasons: [
        { season: '20252026', gamesPlayed: 55, savePct: 0.912 },
        { season: '20242025', gamesPlayed: 52, savePct: 0.909 },
        { season: '20232024', gamesPlayed: 49, savePct: 0.914 },
      ],
    });
    const peer = player('peer', 3, 40, { pos: ['G'], recentSeasons: [{ season: '20252026', gamesPlayed: 40, savePct: 0.905 }] });
    const projections = buildNextSeasonProjectionMap([breakout, starter, peer], '2026-10-01');

    expect(projections.get('starter')!.projectedFppg).toBeGreaterThan(projections.get('breakout')!.projectedFppg);
    expect(projections.get('starter')!.projectedGames).toBeGreaterThan(projections.get('breakout')!.projectedGames);
    expect(projections.get('breakout')).toMatchObject({ confidence: 'low', volatility: 'high' });
    expect(projections.get('starter')!.reasons.join(' ')).toContain('appearances');
  });
});
