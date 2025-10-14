import { describe, expect, it } from 'vitest';
import { fillLineup, simulateSwap } from '../src/services/simulate';
import { loadLeagueProfile } from '../src/services/loaders';
import { getBlendedFppg } from '../src/services/stats';
import { Player, Window } from '../src/models/types';

const league = loadLeagueProfile('demo');

const window: Window = { start: '2025-10-13', end: '2025-10-14' };

const roster: Player[] = [
  { id: 'nhl:8478403', name: 'Tage Thompson', team: 'BUF', pos: ['C'] },
  { id: 'nhl:8479343', name: 'Robert Thomas', team: 'STL', pos: ['C'] },
  { id: 'nhl:8480801', name: 'Alexis Lafreniere', team: 'NYR', pos: ['LW', 'RW'] },
  { id: 'nhl:8480039', name: 'Joel Farabee', team: 'PHI', pos: ['LW', 'RW'] }
];

const slots = {
  C: 1,
  LW: 1,
  RW: 1,
  D: 0,
  G: 0,
  UTIL: 1
};

describe('fillLineup', () => {
  it('fills dual-eligibility and uses UTIL only after primary slots', () => {
    const result = fillLineup(roster, window, { ...league, rosterSlots: slots });

    expect(result.playableGp['nhl:8478403']).toBe(1);
    expect(result.playableGp['nhl:8479343']).toBe(1);
    expect(result.playableGp['nhl:8480039']).toBe(1);
    expect(result.playableGp['nhl:8480801']).toBe(1);
    expect(result.totalPoints).toBeGreaterThan(0);
  });
});

describe('simulateSwap', () => {
  it('computes lineup deltas consistently with fillLineup', () => {
    const wideWindow: Window = { start: '2025-10-13', end: '2025-10-20' };
    const baseRoster: Player[] = [
      { id: 'nhl:8478403', name: 'Tage Thompson', team: 'BUF', pos: ['C'] },
      { id: 'nhl:8478398', name: 'Rasmus Dahlin', team: 'BUF', pos: ['D'] },
      { id: 'nhl:8480801', name: 'Alexis Lafreniere', team: 'NYR', pos: ['LW', 'RW'] }
    ];

    const addPlayer: Player = { id: 'nhl:8479343', name: 'Robert Thomas', team: 'STL', pos: ['C'] };
    const dropPlayer: Player = { id: 'nhl:8480801', name: 'Alexis Lafreniere', team: 'NYR', pos: ['LW', 'RW'] };

    const baseline = fillLineup(baseRoster, wideWindow, league);
    const swapped = fillLineup(baseRoster.filter((p) => p.id !== dropPlayer.id).concat(addPlayer), wideWindow, league);
    const result = simulateSwap(baseRoster, addPlayer, dropPlayer, wideWindow, league, baseline);

    const expectedDeltaGp = (swapped.playableGp[addPlayer.id] ?? 0) - (baseline.playableGp[dropPlayer.id] ?? 0);
    const expectedDeltaPoints = Number((swapped.totalPoints - baseline.totalPoints).toFixed(2));
    const expectedLostPoints = Number(((baseline.playableGp[dropPlayer.id] ?? 0) * getBlendedFppg(dropPlayer.id)).toFixed(2));

    expect(result.deltaGp).toBe(expectedDeltaGp);
    expect(result.deltaPoints).toBe(expectedDeltaPoints);
    expect(result.lostPoints).toBeCloseTo(expectedLostPoints, 2);
  });
});