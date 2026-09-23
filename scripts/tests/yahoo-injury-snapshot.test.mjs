import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInjurySnapshot } from '../build-injury-snapshot.mjs';

test('injury snapshot keeps only players with a Yahoo status', () => {
  const snapshot = buildInjurySnapshot({
    updatedAt: '2026-09-23',
    players: {
      'nhl:1': { injuryStatus: 'O', injuryStatusFull: 'Out', injuryNote: 'Lower Body', injuryUpdatedAt: '2026-09-21T16:08:13.000Z' },
      'nhl:2': { injuryStatus: null },
      'nhl:3': { injuryStatus: 'DTD' },
    },
  });
  assert.equal(snapshot.count, 2);
  assert.deepEqual(snapshot.players['nhl:1'], { status: 'O', statusFull: 'Out', note: 'Lower Body', updatedAt: '2026-09-21T16:08:13.000Z' });
  assert.deepEqual(snapshot.players['nhl:3'], { status: 'DTD', statusFull: null, note: null, updatedAt: null });
  assert.equal(snapshot.players['nhl:2'], undefined);
});
