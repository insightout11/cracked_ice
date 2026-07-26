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
  it('tempers a one-season breakout while retaining age and role upside', () => {
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
    expect(projection.projectedFppg).toBeLessThan(4.2);
    expect(projection.trajectory).toBe('stable');
    expect(projection.confidence).toBe('high');
    expect(projection.reasons.join(' ')).toContain('scoring baseline');
    expect(projection.reasons.join(' ')).toContain('power-play role');
  });

  it('keeps proven stars ahead of one-season breakouts and does not punish elite mean reversion', () => {
    const raddysh = player('raddysh', 4.13, 80, {
      pos: ['D'],
      birthDate: '1996-02-22',
      avgToiPerGame: 21 * 60,
      ppTimeOnIcePerGame: 3.2 * 60,
      recentSeasons: [
        { season: '20252026', gamesPlayed: 80, pointsPerGame: 0.959 },
        { season: '20242025', gamesPlayed: 80, pointsPerGame: 0.507 },
        { season: '20232024', gamesPlayed: 82, pointsPerGame: 0.402 },
      ],
    });
    const makar = player('makar', 4.57, 80, {
      pos: ['D'],
      birthDate: '1998-10-30',
      avgToiPerGame: 25 * 60,
      ppTimeOnIcePerGame: 4 * 60,
      recentSeasons: [
        { season: '20252026', gamesPlayed: 80, pointsPerGame: 1.053 },
        { season: '20242025', gamesPlayed: 80, pointsPerGame: 1.15 },
        { season: '20232024', gamesPlayed: 77, pointsPerGame: 1.169 },
      ],
    });
    const kaprizov = player('kaprizov', 4.65, 70, {
      pos: ['LW'],
      birthDate: '1997-04-26',
      avgToiPerGame: 21 * 60,
      ppTimeOnIcePerGame: 4 * 60,
      recentSeasons: [
        { season: '20252026', gamesPlayed: 70, pointsPerGame: 1.141 },
        { season: '20242025', gamesPlayed: 41, pointsPerGame: 1.366 },
        { season: '20232024', gamesPlayed: 75, pointsPerGame: 1.28 },
      ],
    });
    const directory = [raddysh, makar, kaprizov, player('d-peer', 3.2, 75, { pos: ['D'] }), player('lw-peer', 3, 75, { pos: ['LW'] })];
    const projections = buildNextSeasonProjectionMap(directory, '2026-10-01');

    expect(projections.get('makar')!.projectedFppg).toBeGreaterThan(projections.get('raddysh')!.projectedFppg);
    expect(projections.get('raddysh')!.deltaPercent).toBeLessThanOrEqual(0);
    expect(projections.get('makar')!.deltaPercent).toBeGreaterThan(-5);
    expect(projections.get('kaprizov')!.deltaPercent).toBeGreaterThan(-5);
  });

  it('does not let a single rebound season move McAvoy ahead of established peers', () => {
    const defenseman = (id: string, fppg: number, ppg: number[], games = 70) => player(id, fppg, games, {
      pos: ['D'],
      birthDate: '1998-01-01',
      avgToiPerGame: 24 * 60,
      ppTimeOnIcePerGame: 3.5 * 60,
      recentSeasons: ppg.map((pointsPerGame, index) => ({ season: `${2025 - index}${2026 - index}`, gamesPlayed: games, pointsPerGame })),
    });
    const mcavoy = defenseman('mcavoy', 3.86, [0.884, 0.46, 0.635]);
    const dahlin = defenseman('dahlin', 3.94, [0.961, 0.932, 0.728]);
    const fox = defenseman('fox', 3.78, [0.964, 0.824, 1.014], 55);
    const projections = buildNextSeasonProjectionMap([mcavoy, dahlin, fox], '2026-10-01');

    expect(projections.get('dahlin')!.projectedFppg).toBeGreaterThan(projections.get('mcavoy')!.projectedFppg);
    expect(projections.get('fox')!.projectedFppg).toBeGreaterThan(projections.get('mcavoy')!.projectedFppg);
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
