/**
 * CI guard: Yahoo injury status data must remain live after the nightly refresh.
 *
 * 1. injuryCount floor: at least 100 matched players must carry a non-empty 'injuryStatus'.
 * 2. value enum: every 'injuryStatus' must be a known Yahoo code.
 * 3. staleness guard: `updatedAt` must be within 36 hours of the local run.
 *
 * Does not test upstream correctness of the Yahoo feed itself; only our local snapshot sanity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(scriptDir, '..', '..', 'data');
const yahooPath = path.join(dataDir, 'yahoo-player-eligibility.json');
const EXPECTED_ENUM = new Set(['NA', 'O', 'DTD', 'IR', 'IR+', 'IR-LT', 'SU', 'SUS', 'S']);

test('eligibility file includes Yahoo injury status fields', () => {
  assert.ok(fs.existsSync(yahooPath), 'yahoo-player-eligibility.json must exist');
  const doc = JSON.parse(fs.readFileSync(yahooPath, 'utf8'));
  const values = Object.values(doc.players ?? {});
  const injured = values.filter((p) => p.injuryStatus);
  assert.ok(injured.length >= 100,
    `Expected at least 100 players with injuryStatus, got ${injured.length}.\n` +
    'Check whether the Yahoo refresh actually ran / the feed schema changed.');
  for (const [id, player] of Object.entries(doc.players)) {
    if (!player.injuryStatus) continue;
    assert.ok(EXPECTED_ENUM.has(player.injuryStatus),
      `${id}: unexpected injuryStatus "${player.injuryStatus}"`);
  }
});

test('eligibility file freshness within 36 hours', () => {
  const doc = JSON.parse(fs.readFileSync(yahooPath, 'utf8'));
  assert.ok(doc.updatedAt, 'updatedAt field must exist');
  const updated = new Date(doc.updatedAt).getTime();
  const msBehind = Date.now() - updated;
  const hours = msBehind / (60 * 60 * 1000);
  assert.ok(hours <= 36, `eligibility snapshot is ${Math.round(hours)}h stale (updatedAt: ${doc.updatedAt})`);
});
