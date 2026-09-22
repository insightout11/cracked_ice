/**
 * CI guard: FantasyPros player-news pipeline sanity.
 *
 * 1. file must exist with >= 5 items (fresh fetch may legitimately be small in offseason, not zero)
 * 2. >= 90% of items must match a canonical directory playerId
 * 3. every item must have itemid, title, date (ISO), url
 * 4. no duplicate itemids
 * 5. freshness: updatedAt within 40 hours (nightly job + weekend buffer)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const newsPath = path.join(scriptDir, '..', '..', 'data', 'player-news.json');

test('player-news file exists and has enough items', () => {
  assert.ok(fs.existsSync(newsPath), 'data/player-news.json must exist (run scripts/fetch-player-news.mjs)');
  const doc = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  assert.ok(doc.items.length >= 5, `expected >= 5 news items, got ${doc.items.length} — check feed schema/redesign`);
});

test('player-news items are well-formed and mostly directory-matched', () => {
  const doc = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const ids = new Set();
  for (const it of doc.items) {
    assert.ok(it.itemid, `missing itemid: ${JSON.stringify(it).slice(0, 120)}`);
    assert.ok(it.title, `missing title on ${it.itemid}`);
    assert.ok(it.date && !Number.isNaN(Date.parse(it.date)), `bad date on ${it.itemid}`);
    assert.ok(it.url && it.url.startsWith('https://www.fantasypros.com/'), `bad url on ${it.itemid}`);
    assert.ok(!ids.has(it.itemid), `duplicate itemid ${it.itemid}`);
    ids.add(it.itemid);
  }
  const matched = doc.items.filter((i) => i.playerId).length;
  const rate = matched / doc.items.length;
  assert.ok(rate >= 0.9, `playerId match rate ${(rate * 100).toFixed(0)}% < 90% — slug/dir drift? (${matched}/${doc.items.length})`);
});

test('player-news freshness within 40 hours', () => {
  const doc = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  assert.ok(doc.updatedAt, 'updatedAt must exist');
  const hours = (Date.now() - Date.parse(doc.updatedAt)) / 3600000;
  assert.ok(hours <= 40, `player-news snapshot is ${Math.round(hours)}h stale (updatedAt: ${doc.updatedAt}) — hydrate job stuck?`);
});
