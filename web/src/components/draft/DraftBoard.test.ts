import { describe, expect, it } from 'vitest';
import { toggleDraftCompareSelection } from '../../lib/draftCompare';

describe('draft board compare selection', () => {
  it('selects at most two players and lets either player be removed', () => {
    const stone = { playerId: 'nhl:8475913', name: 'Mark Stone' };
    const sennecke = { playerId: '8484795', name: 'Beckett Sennecke' };
    const miller = { playerId: '8476468', name: 'J.T. Miller' };

    const one = toggleDraftCompareSelection([], stone);
    const two = toggleDraftCompareSelection(one, sennecke);

    expect(two).toEqual([stone, sennecke]);
    expect(toggleDraftCompareSelection(two, miller)).toEqual(two);
    expect(toggleDraftCompareSelection(two, { ...stone, playerId: '8475913' })).toEqual([sennecke]);
  });
});
