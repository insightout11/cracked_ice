import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchers, matchPlayers, ownPosts, postUrl } from '../fetch-bluesky-posts.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const players = [
  { id: 'nhl:1', name: 'Olen Zellweger', team: 'BUF', aliases: [] },
  { id: 'nhl:2', name: 'Owen Power', team: 'BUF', aliases: [] },
  { id: 'nhl:3', name: 'Jack Hughes', team: 'NJD', aliases: [] },
  { id: 'nhl:4', name: 'Luke Hughes', team: 'NJD', aliases: [] },
  { id: 'nhl:5', name: 'Skyler Brind\'Amour', team: 'CAR', aliases: [] },
  { id: 'nhl:6', name: 'Bradly Nadeau', team: 'CAR', aliases: [] },
  { id: 'nhl:7', name: 'Tim Stützle', team: 'OTT', aliases: ['Tim Stutzle'] },
  { id: 'nhl:8', name: 'Kent Johnson', team: 'CBJ', aliases: [] },
];
const matchers = buildMatchers(players, { CAR: ["Brind'Amour"] });
const names = (ids) => ids.map((id) => players.find((p) => p.id === id).name);

test('full names match for any writer, surnames only for the writer\'s team', () => {
  assert.deepEqual(names(matchPlayers('Olen Zellweger has a concussion, per Lindy Ruff.', [], matchers)), ['Olen Zellweger']);
  assert.deepEqual(names(matchPlayers('Zellweger has a concussion.', ['BUF'], matchers)), ['Olen Zellweger']);
  assert.deepEqual(matchPlayers('Zellweger has a concussion.', ['CAR'], matchers), []);
  assert.deepEqual(matchPlayers('Zellweger has a concussion.', [], matchers), []);
});

test('surnames that are words or shared by teammates need the full name', () => {
  assert.deepEqual(matchPlayers('Power play was 0-for-4 tonight.', ['BUF'], matchers), []);
  assert.deepEqual(names(matchPlayers('Owen Power logged 24 minutes.', ['BUF'], matchers)), ['Owen Power']);
  assert.deepEqual(matchPlayers('Hughes skated with the top unit.', ['NJD'], matchers), []);
  assert.deepEqual(names(matchPlayers('Luke Hughes skated with the top unit.', ['NJD'], matchers)), ['Luke Hughes']);
});

test('a different first name before the surname is someone else', () => {
  // Staff list: the coach is Rod Brind'Amour, the player is Skyler.
  assert.deepEqual(names(matchPlayers('Brind’Amour on Nadeau: "He\'s a threat."', ['CAR'], matchers)), ['Bradly Nadeau']);
  assert.deepEqual(matchPlayers('Coach Ryan Johnson said the line stays.', ['CBJ'], matchers), []);
  assert.deepEqual(names(matchPlayers('Johnson still working with Marchenko.', ['CBJ'], matchers)), ['Kent Johnson']);
  assert.deepEqual(names(matchPlayers('Kent Johnson still working with Marchenko.', ['CBJ'], matchers)), ['Kent Johnson']);
});

test('accents and aliases are matched', () => {
  assert.deepEqual(names(matchPlayers('Tim Stutzle returns to practice', [], matchers)), ['Tim Stützle']);
  assert.deepEqual(names(matchPlayers('Stützle returns to practice', ['OTT'], matchers)), ['Tim Stützle']);
});

test('only the writer\'s own recent top-level posts are kept', () => {
  const since = '2026-09-16T00:00:00Z';
  const feed = [
    { post: { uri: 'at://a/app.bsky.feed.post/1', record: { text: 'own', createdAt: '2026-09-20T00:00:00Z' } } },
    { post: { uri: 'at://a/app.bsky.feed.post/2', record: { text: 'repost', createdAt: '2026-09-20T00:00:00Z' } }, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } },
    { post: { uri: 'at://a/app.bsky.feed.post/3', record: { text: 'reply', createdAt: '2026-09-20T00:00:00Z', reply: {} } } },
    { post: { uri: 'at://a/app.bsky.feed.post/4', record: { text: 'old', createdAt: '2026-09-01T00:00:00Z' } } },
  ];
  assert.deepEqual(ownPosts(feed, since).map((p) => p.record.text), ['own']);
  assert.equal(postUrl('billhoppe.bsky.social', 'at://did:plc:x/app.bsky.feed.post/3lxyz'), 'https://bsky.app/profile/billhoppe.bsky.social/post/3lxyz');
});

test('writer config is valid and team codes exist', () => {
  const { writers } = JSON.parse(fs.readFileSync(path.join(root, 'config', 'bluesky-writers.json'), 'utf8'));
  const teams = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data', 'players.json'), 'utf8')).players.map((p) => p.team));
  const handles = new Set();
  for (const writer of writers) {
    assert.ok(writer.handle && !handles.has(writer.handle), `duplicate or missing handle ${writer.handle}`);
    handles.add(writer.handle);
    assert.ok(writer.name && writer.outlet, `name/outlet missing for ${writer.handle}`);
    for (const team of writer.teams) assert.ok(teams.has(team), `unknown team ${team} for ${writer.handle}`);
  }
});

test('committed beat-posts snapshot is well-formed', () => {
  // Shape only: the nightly job keeps it fresh, and a stale snapshot must not fail CI.
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'web', 'public', 'beat-posts.json'), 'utf8'));
  assert.ok(Array.isArray(snapshot.posts));
  for (const post of snapshot.posts) {
    assert.match(post.url, /^https:\/\/bsky\.app\/profile\/[^/]+\/post\/[\w]+$/);
    assert.ok(post.text && post.author?.handle && !Number.isNaN(Date.parse(post.date)));
    assert.ok(post.playerIds.length > 0 && post.playerIds.every((id) => /^nhl:\d+$/.test(id)));
  }
});
