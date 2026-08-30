import { describe, expect, it } from 'vitest';
import type { DraftPlayer } from './playerSearch';
import { buildNextSeasonProjection, buildNextSeasonProjectionMap } from './draftProjection';

function player(id: string, fppg: number | null, games: number, options: Partial<DraftPlayer> = {}): DraftPlayer {
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
    expect(projection.reasons.join(' ')).toContain('Recent scoring history');
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

  it('derives a transparent category line consistent with projected FPPG and games', () => {
    const skater = player('skater', 3, 60, {
      scoringBreakdown: {
        gamesPlayed: 60,
        fppg: 3,
        contributions: [
          { key: 'goals', stat: 30, weight: 3, fantasyPoints: 90, fppg: 1.5 },
          { key: 'assists', stat: 45, weight: 2, fantasyPoints: 90, fppg: 1.5 },
        ],
      },
      recentSeasons: [{ season: '20252026', gamesPlayed: 60, pointsPerGame: 1.25 }],
    });
    const projection = buildNextSeasonProjection(skater, [skater], '2026-10-01');
    const projectedFantasyPoints = (projection.projectedStats.goals * 3) + (projection.projectedStats.assists * 2);

    expect(projection.projectedStats).toHaveProperty('goals');
    expect(projection.projectedStats).toHaveProperty('assists');
    expect(projectedFantasyPoints / projection.projectedGames).toBeCloseTo(projection.projectedFppg, 1);
  });

  it('does not present a category projection from a tiny NHL sample', () => {
    const prospect = player('prospect', 2, 2, {
      scoringBreakdown: {
        gamesPlayed: 2,
        fppg: 2,
        contributions: [{ key: 'goals', stat: 0, weight: 3, fantasyPoints: 0, fppg: 0 }],
      },
      recentSeasons: [{ season: '20252026', gamesPlayed: 2, pointsPerGame: 0.5 }],
    });

    expect(buildNextSeasonProjection(prospect, [prospect], '2026-10-01').projectedStats).toEqual({});
  });

  it('rebuilds an established skater after a missed season instead of projecting zero quality and 20 games', () => {
    const barkov = player('barkov', null, 0, {
      birthDate: '1995-09-02',
      yahooAdp: 52.3,
      recentSeasons: [
        { season: '20252026', gamesPlayed: 0 },
        { season: '20242025', gamesPlayed: 67, pointsPerGame: 1.09 },
        { season: '20232024', gamesPlayed: 73, pointsPerGame: 1.1 },
      ],
    });
    const peers = [
      barkov,
      player('peer1', 4.2, 78, { recentSeasons: [{ season: '20252026', gamesPlayed: 78, pointsPerGame: 1.05 }] }),
      player('peer2', 3.8, 80, { recentSeasons: [{ season: '20252026', gamesPlayed: 80, pointsPerGame: 0.95 }] }),
    ];
    const projection = buildNextSeasonProjection(barkov, peers, '2026-10-01');

    expect(projection.projectedFppg).toBeGreaterThan(3.5);
    expect(projection.projectedGames).toBeGreaterThanOrEqual(65);
    expect(projection.projectedGames).toBeLessThanOrEqual(74);
    expect(projection.confidence).not.toBe('low');
    expect(projection.reasons.join(' ')).toContain('baseline rebuilt');
  });

  it('uses a transparent market fallback when hydration has no current or career stats', () => {
    const barkov = player('barkov', null, 0, { yahooAdp: 52.3, recentSeasons: [] });
    const peers = [
      barkov,
      player('peer1', 4.2, 78, { yahooAdp: 48, recentSeasons: [{ season: '20252026', gamesPlayed: 78, pointsPerGame: 1.05 }] }),
      player('peer2', 3.8, 80, { yahooAdp: 58, recentSeasons: [{ season: '20252026', gamesPlayed: 80, pointsPerGame: 0.95 }] }),
      player('peer3', 3.9, 75, { yahooAdp: 65, recentSeasons: [{ season: '20252026', gamesPlayed: 75, pointsPerGame: 0.98 }] }),
    ];
    const projection = buildNextSeasonProjection(barkov, peers, '2026-10-01');

    expect(projection.projectedFppg).toBeGreaterThan(3.5);
    expect(projection.projectedGames).toBe(74);
    expect(projection.reasons.join(' ')).toContain('Yahoo draft values');
  });

  it('does not treat pre-rookie NHL cameos as an availability penalty', () => {
    const rookie = player('rookie', 3.4, 82, {
      birthDate: '2005-01-01',
      recentSeasons: [
        { season: '20252026', gamesPlayed: 82, pointsPerGame: 0.78 },
        { season: '20242025', gamesPlayed: 9, pointsPerGame: 0.44 },
        { season: '20232024', gamesPlayed: 2, pointsPerGame: 0 },
      ],
    });

    const projection = buildNextSeasonProjection(rookie, [rookie], '2026-10-01');

    expect(projection.projectedGames).toBeGreaterThanOrEqual(70);
    expect(projection.projectedGames).toBeLessThanOrEqual(80);
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
