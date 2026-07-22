import { describe, expect, it } from 'vitest';
import { inferDailySlots, rankPlayerMatches, type DraftPlayer } from './playerSearch';

const players: DraftPlayer[] = [
  { id: '1', name: 'Connor McDavid', team: 'EDM', pos: ['C'], aliases: ['C. McDavid'], blendedFppg: 4.8, productionValue: 4.8, productionLabel: 'FPPG' },
  { id: '2', name: 'Charlie McAvoy', team: 'BOS', pos: ['D'], aliases: ['C. McAvoy'], blendedFppg: 2.6, productionValue: 2.6, productionLabel: 'FPPG' },
  { id: '3', name: 'Cale Makar', team: 'COL', pos: ['D'], aliases: ['C. Makar'], blendedFppg: 3.9, productionValue: 3.9, productionLabel: 'FPPG' }
];

describe('rankPlayerMatches', () => {
  it('prioritizes exact and prefix name matches', () => {
    expect(rankPlayerMatches(players, 'McDavid').map((player) => player.name)).toEqual(['Connor McDavid']);
    expect(rankPlayerMatches(players, 'C').length).toBe(0);
  });
});

describe('inferDailySlots', () => {
  it('uses four slots only when every anchor is defense-only', () => {
    expect(inferDailySlots([players[1], players[2]])).toBe(4);
    expect(inferDailySlots([players[0], players[1]])).toBe(2);
  });
});
