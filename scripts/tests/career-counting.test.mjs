import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSeasonRows, seasonIdsFrom } from '../fetch-career-counting.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('season ids run from 2005-06 to the configured season', () => {
  assert.deepEqual(seasonIdsFrom(2023, '20262027'), ['20232024', '20242025', '20252026', '20262027']);
});

test('season rows merge shots on goal (summary) with hits and blocks (realtime)', () => {
  const merged = mergeSeasonRows(
    [
      { playerId: 8471214, gamesPlayed: 82, shots: 244, totalShotAttempts: 999 },
      { playerId: 1, gamesPlayed: 10, shots: 5 },
      { playerId: 2, gamesPlayed: 0, shots: 0 },
    ],
    [{ playerId: 8471214, hits: 134, blockedShots: 16 }, { playerId: 2, hits: 1, blockedShots: 1 }],
    new Set(['nhl:8471214', 'nhl:2']),
  );
  // nhl:1 is not in the directory; nhl:2 played no games.
  assert.deepEqual(merged, { 'nhl:8471214': [82, 244, 134, 16] });
});

test('committed career-counting snapshot is well-formed', () => {
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data', 'career-counting.json'), 'utf8'));
  assert.deepEqual(snapshot.columns, ['gamesPlayed', 'shots', 'hits', 'blocks']);
  assert.ok(snapshot.seasons['20052006'], 'backfill should start at 2005-06');
  for (const [season, players] of Object.entries(snapshot.seasons)) {
    assert.match(season, /^\d{8}$/);
    for (const row of Object.values(players)) assert.ok(row.length === 4 && row[0] > 0 && row.every((n) => Number.isInteger(n) && n >= 0));
  }
});
