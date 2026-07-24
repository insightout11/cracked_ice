import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { buildRosterImportRows, countRosterPositions, findRosterImportCandidates, getPositionLineupSlots, mergeRosterImportText } from './rosterImport';

const players: PlayerSearchResult[] = [
  { id: '1', name: 'Connor McDavid', team: 'EDM', pos: ['C'], aliases: ['C. McDavid'], blendedFppg: 4.2 },
  { id: '2', name: 'Jack Hughes', team: 'NJD', pos: ['C'], aliases: [], blendedFppg: 3.8 },
  { id: '3', name: 'Luke Hughes', team: 'NJD', pos: ['D'], aliases: [], blendedFppg: 2.1 },
  { id: '4', name: 'Tim Stützle', team: 'OTT', pos: ['C'], aliases: ['Tim Stutzle'], blendedFppg: 3.1 },
];

describe('roster import matching', () => {
  it('deduplicates overlapping screenshot extracts while preserving new names', () => {
    expect(mergeRosterImportText('Connor McDavid\nCale Makar', ['Cale Makar', 'Igor Shesterkin'])).toBe(
      'Connor McDavid\nCale Makar\nIgor Shesterkin',
    );
  });

  it('matches decorated rows and aliases without depending on accents', () => {
    const rows = buildRosterImportRows(players, '1. Connor McDavid\tEDM\tC\nTim Stutzle - OTT');

    expect(rows.map((row) => [row.status, row.selectedPlayerId])).toEqual([
      ['matched', '1'],
      ['matched', '4'],
    ]);
  });

  it('requires a choice for ambiguous last names', () => {
    const [row] = buildRosterImportRows(players, 'Hughes');

    expect(row.status).toBe('ambiguous');
    expect(row.selectedPlayerId).toBeNull();
    expect(row.candidates.map((player) => player.id)).toEqual(['2', '3']);
  });

  it('marks existing and repeated players as duplicates', () => {
    const rows = buildRosterImportRows(players, 'Connor McDavid\nConnor McDavid', ['1']);

    expect(rows.map((row) => row.status)).toEqual(['duplicate', 'duplicate']);
  });

  it('treats nhl-prefixed and numeric roster IDs as the same player', () => {
    const prefixed = [{ ...players[0], id: 'nhl:1' }];
    expect(buildRosterImportRows(prefixed, 'Connor McDavid', ['1'])[0].status).toBe('duplicate');
  });

  it('keeps unknown text unresolved and supports correction searches', () => {
    expect(buildRosterImportRows(players, 'Definitely Not A Player')[0].status).toBe('unmatched');
    expect(findRosterImportCandidates(players, 'McDavid')[0].id).toBe('1');
  });

  it('counts dual-eligible players in each applicable position group', () => {
    expect(countRosterPositions([
      { pos: ['C', 'LW'] },
      { pos: ['LW'] },
      { pos: ['G'] },
    ])).toEqual({ C: 1, LW: 2, RW: 0, D: 0, G: 1 });
  });

  it('uses league position, flex, and utility slots with sensible fallbacks', () => {
    const profile = {
      league_name: 'Test',
      scoring_type: 'points',
      lineup_slots: { C: 2, F: 1, UTIL: 1, D: 3, G: 2 },
    } as const;

    expect(getPositionLineupSlots('C', profile)).toBe(4);
    expect(getPositionLineupSlots('D', profile)).toBe(4);
    expect(getPositionLineupSlots('G', profile)).toBe(2);
    expect(getPositionLineupSlots('RW', null)).toBe(2);
  });
});
