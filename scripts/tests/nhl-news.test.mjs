import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { articleText, buildEntries, categorizeStory, playerIdsOf, storyUrl, summarise, TEAM_SITE_BY_ID } from '../fetch-nhl-news.mjs';

const snapshotPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'public', 'player-news.json');

const story = (overrides = {}) => ({
  _entityId: 'story-1',
  slug: 'babcock-mcdavid-draisaitl-same-line',
  headline: 'Babcock to start season with McDavid, Draisaitl on same line for Oilers',
  summary: 'EDMONTON -- Mike Babcock is keeping things simple.',
  contentDate: '2026-09-17T18:00:00Z',
  lastUpdatedDate: '2026-09-17T18:05:00Z',
  context: { slug: 'nhl' },
  tags: [{ slug: 'teamid-22' }, { slug: 'playerid-8478402' }, { slug: 'playerid-8477934' }],
  ...overrides,
});

test('story URLs use nhl.com/news for league stories and the team site path otherwise', () => {
  assert.equal(storyUrl(story()), 'https://www.nhl.com/news/babcock-mcdavid-draisaitl-same-line');
  assert.equal(storyUrl(story({ context: { slug: 'teamid-10' } })), 'https://www.nhl.com/mapleleafs/news/babcock-mcdavid-draisaitl-same-line');
  assert.equal(storyUrl(story({ context: { slug: 'teamid-999' } })), null);
  assert.equal(Object.keys(TEAM_SITE_BY_ID).length, 32);
});

test('player ids come from playerid tags in canonical nhl: form', () => {
  assert.deepEqual(playerIdsOf(story()), ['nhl:8478402', 'nhl:8477934']);
});

test('categories follow the headline; summaries only add injury news', () => {
  assert.equal(categorizeStory('Babcock to start season with McDavid, Draisaitl on same line for Oilers', ''), 'lineup');
  assert.equal(categorizeStory('Steel signs 4-year, $14.8 million contract with Stars', ''), 'transaction');
  assert.equal(categorizeStory('Engvall Eager to Return After Year-Long Injury', ''), 'injury');
  assert.equal(categorizeStory('Wood, Nilsson Lead Preds to Overtime Victory Against Lightning', 'played 18 minutes'), 'performance');
  // A feature whose summary mentions a signing stays a feature.
  assert.equal(categorizeStory('Canadiens have what it takes to end Stanley Cup drought', 'signing forward Chris Kreider'), 'feature');
  assert.equal(categorizeStory('Swedish Isles Embracing Eklund', 'he missed time with a lower-body injury'), 'injury');
  // Whole words only: "Red Wings" is not a win, "signal" is not a signing.
  assert.equal(categorizeStory("Red Wings season preview: Larkin's future, front office changes among challenges", ''), 'feature');
  assert.equal(categorizeStory('Coach sends a signal with camp groups', ''), 'feature');
  assert.equal(categorizeStory('Larkin addresses trade request on Day 1 of camp', ''), 'transaction');
});

test('article text keeps prose and drops markdown and images', () => {
  const text = articleText({ parts: [
    { type: 'photo', content: { url: 'x' } },
    { type: 'markdown', content: '**EDMONTON --** Babcock said [McDavid](https://nhl.com/x) will play.' },
    { type: 'markdown', content: '![img](https://a/b.png) Draisaitl too.' },
  ] });
  assert.equal(text, 'EDMONTON -- Babcock said McDavid will play.\n\n Draisaitl too.');
});

test('entries drop untagged, unknown-player and out-of-window stories, and reuse takeaways', () => {
  const known = new Set(['nhl:8478402']);
  const since = '2026-09-10T00:00:00Z';
  const previousById = new Map([['story-1', { updatedAt: '2026-09-17T18:05:00Z', fantasyTakeaway: 'McDavid stays with Draisaitl.', takeawayStatus: 'ok' }]]);
  const entries = buildEntries([
    story(),
    story({ _entityId: 'old', contentDate: '2026-09-01T00:00:00Z' }),
    story({ _entityId: 'untagged', tags: [{ slug: 'teamid-22' }] }),
    story({ _entityId: 'edited', lastUpdatedDate: '2026-09-18T00:00:00Z' }),
  ], { knownPlayerIds: known, previousById: new Map([...previousById, ['edited', { updatedAt: 'older', fantasyTakeaway: 'stale', takeawayStatus: 'ok' }]]), since });
  assert.deepEqual(entries.map((e) => e.id).sort(), ['edited', 'story-1']);
  const reused = entries.find((e) => e.id === 'story-1');
  assert.deepEqual(reused.playerIds, ['nhl:8478402']);
  assert.equal(reused.fantasyTakeaway, 'McDavid stays with Draisaitl.');
  assert.equal(entries.find((e) => e.id === 'edited').takeawayStatus, 'pending');
});

const stubClient = (response) => ({ messages: { create: async (params) => ({ ...response, params }) } });
const entry = { headline: 'h', nhlSummary: 's' };

test('Haiku takeaways: text, NONE and refusals', async () => {
  assert.deepEqual(
    await summarise(stubClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: ' McDavid opens on the top line. ' }] }), entry, 'article', ['Connor McDavid']),
    { status: 'ok', text: 'McDavid opens on the top line.' },
  );
  assert.deepEqual(
    await summarise(stubClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'NONE' }] }), entry, 'article', []),
    { status: 'none', text: null },
  );
  assert.deepEqual(
    await summarise(stubClient({ stop_reason: 'refusal', content: [] }), entry, 'article', []),
    { status: 'skipped', text: null },
  );
});

test('committed player-news snapshot is well-formed', () => {
  // Shape only: the nightly job keeps it fresh, and a stale snapshot must not fail CI.
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.ok(Array.isArray(snapshot.stories) && snapshot.stories.length > 0, 'expected stories');
  const ids = new Set();
  for (const s of snapshot.stories) {
    assert.ok(s.id && !ids.has(s.id), `duplicate or missing id ${s.id}`);
    ids.add(s.id);
    assert.match(s.url, /^https:\/\/www\.nhl\.com\/(news|[a-z]+\/news)\//, `bad url ${s.url}`);
    assert.doesNotMatch(s.url, /teamid-/, `unmapped team url ${s.url}`);
    assert.ok(s.playerIds.length > 0 && s.playerIds.every((id) => /^nhl:\d+$/.test(id)), `bad playerIds on ${s.id}`);
    assert.ok(['injury', 'lineup', 'transaction', 'performance', 'feature'].includes(s.category));
    assert.ok(!Number.isNaN(Date.parse(s.date)));
  }
});
