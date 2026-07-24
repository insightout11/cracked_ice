import { describe, expect, it } from 'vitest';
import { findQuickDraftPlayers, previewManualDraftImport, splitDraftImportText } from './draftManualTracking';
import type { DraftPlayer } from './playerSearch';

const players: DraftPlayer[] = [
  { id: 'nhl:1', name: 'Nikita Kucherov', team: 'TBL', pos: ['RW'], aliases: [], blendedFppg: 5, productionValue: 5, productionLabel: 'FPPG', scoringBreakdown: null },
  { id: 'nhl:2', name: 'Nathan MacKinnon', team: 'COL', pos: ['C'], aliases: [], blendedFppg: 6, productionValue: 6, productionLabel: 'FPPG', scoringBreakdown: null },
  { id: 'nhl:3', name: 'Connor McDavid', team: 'EDM', pos: ['C'], aliases: [], blendedFppg: 7, productionValue: 7, productionLabel: 'FPPG', scoringBreakdown: null },
];

describe('manual draft tracking', () => {
  it('supports pasted rows as well as comma-separated names', () => {
    expect(splitDraftImportText('1. Nikita Kucherov\tTBL\n2. Nathan MacKinnon\tCOL')).toHaveLength(2);
    expect(splitDraftImportText('Nikita Kucherov, Nathan MacKinnon')).toEqual(['Nikita Kucherov', 'Nathan MacKinnon']);
  });

  it('previews copied draft rows without guessing unresolved names', () => {
    const rows = previewManualDraftImport('1 | Nikita Kucherov | TBL\nMystery Player\n2 | Nathan MacKinnon | COL', players, ['2']);
    expect(rows.map((row) => [row.state, row.player?.id])).toEqual([
      ['matched', 'nhl:1'],
      ['unresolved', undefined],
      ['already-drafted', 'nhl:2'],
    ]);
  });

  it('marks repeated players as duplicates within one preview', () => {
    const rows = previewManualDraftImport('Nikita Kucherov\n1. Nikita Kucherov TBL', players, []);
    expect(rows.map((row) => row.state)).toEqual(['matched', 'duplicate']);
  });

  it('ranks quick results by match quality and excludes drafted players', () => {
    expect(findQuickDraftPlayers('n', players, []).map((player) => player.name)).toEqual([]);
    expect(findQuickDraftPlayers('Nathan', players, []).map((player) => player.name)).toEqual(['Nathan MacKinnon']);
    expect(findQuickDraftPlayers('Mc', players, ['3']).map((player) => player.name)).toEqual([]);
    expect(findQuickDraftPlayers('C', players, []).map((player) => player.name)).toEqual([]);
  });
});
