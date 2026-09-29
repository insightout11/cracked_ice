import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bestPairings, sameGamesDifferentFit, seasonScheduleTable } from '../lib/seo-examples.mjs';

const root = new URL('../../', import.meta.url);
const json = (file) => readFile(new URL(file, root), 'utf8').then(JSON.parse);

const game = (date, isOffNight = false) => ({ date, isOffNight });
const schedule = {
  games: {
    AAA: [game('2026-10-01', true), game('2026-10-03', true)],
    BBB: [game('2026-10-02'), game('2026-10-04', true)],
    CCC: [game('2026-10-01'), game('2026-10-02')],
  },
};

test('schedule pairings rank the most nights covered with the fewest clashes first', () => {
  const [best] = bestPairings(schedule, '2026-10-01', '2026-10-07', 3);
  assert.deepEqual(best.teams, ['AAA', 'BBB']);
  assert.equal(best.nights, 4);
  assert.equal(best.clashes, 0);
  assert.equal(best.offNights, 3);
});

test('the schedule table counts off-night and fantasy-playoff games per team', () => {
  const season = { defaultFantasyPlayoffsStart: '2026-10-03', defaultFantasyPlayoffsEnd: '2026-10-04' };
  const [top] = seasonScheduleTable(schedule, season, 1);
  assert.deepEqual(top, { team: 'AAA', name: 'AAA', games: 2, offNightGames: 2, playoffGames: 1, playoffOffNightGames: 1 });
});

test('the comparison example finds two teams tied on games but not on off-nights', () => {
  const example = sameGamesDifferentFit(schedule, '2026-10-01', 7);
  assert.deepEqual(example.teams.map((team) => team.team), ['AAA', 'CCC']);
  assert.equal(example.games, 2);
  assert.equal(example.gap, 2);
});

test('duplicate URLs redirect permanently to the one canonical page', async () => {
  const vercel = await json('vercel.json');
  assert.equal(vercel.trailingSlash, false);
  assert.ok(vercel.redirects.some((rule) => rule.source === '/:path*/index.html' && rule.destination === '/:path*' && rule.permanent));
  assert.ok(vercel.rewrites.some((rule) => rule.source === '/methodology'));
});

test('every public page has one title, description and heading definition', async () => {
  const pages = await json('web/src/seo/pages.json');
  for (const path of ['/', '/season', '/optimizer', '/draft', '/compare', '/card', '/blog', '/methodology', '/privacy', '/terms', '/contact']) {
    assert.ok(pages[path]?.title && pages[path]?.description && pages[path]?.heading, `${path} is missing a title, description or heading`);
  }
  for (const path of ['/season', '/optimizer', '/draft', '/compare']) assert.ok(pages[path].guide?.paragraphs.length, `${path} has no guide`);
});
