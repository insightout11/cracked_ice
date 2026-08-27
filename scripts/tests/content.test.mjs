import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseMarkdownDocument, postFromDocument, renderMarkdown } from '../lib/content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('frontmatter and Markdown render into a safe post', () => {
  const source = `---
slug: safe-post
title: "Safe post"
excerpt: "A test"
publishDate: 2026-07-29
status: published
author: Cracked Ice
tags: [schedule, test]
---

# Heading

<script>alert(1)</script>

| Team | Games |
| --- | --- |
| WSH | 4 |
`;
  const post = postFromDocument(parseMarkdownDocument(source, 'test.md'), 'test.md');
  assert.equal(post.id, 'safe-post');
  assert.doesNotMatch(post.html, /<h1[ >]/);
  assert.doesNotMatch(post.html, /<script>/);
  assert.match(post.html, /<table>/);
});

test('unsafe link protocols are discarded', () => {
  assert.equal(renderMarkdown('[click](javascript:alert(1))'), '<p><a href="#">click</a>)</p>');
});

test('published article bodies do not repeat the page-level heading', () => {
  const source = `---\nslug: heading-test\ntitle: Heading Test\nexcerpt: Test heading hierarchy.\npublishDate: 2026-07-29\nstatus: published\nauthor: Cracked Ice Analytics\ntags: [test]\n---\n\nIntro copy.\n\n# Heading Test\n\n## First section\n\nBody copy.`;
  const post = postFromDocument(parseMarkdownDocument(source, 'heading-test.md'), 'heading-test.md');
  assert.doesNotMatch(post.html, /<h1[ >]/);
  assert.match(post.html, /<h2>First section<\/h2>/);
});

test('canonical analysis validates the complete 2026–27 schedule', () => {
  const analysis = JSON.parse(fs.readFileSync(path.join(root, 'content', 'generated', '2026-27', 'schedule-analysis.json'), 'utf8'));
  assert.equal(analysis.status, 'draft');
  assert.equal(analysis.fullSeason.teams.length, 32);
  assert.ok(analysis.fullSeason.teams.every((team) => team.games === 84));
  assert.equal(analysis.week.start, '2026-09-28');
  assert.match(analysis.methodology.availabilityRule, /No player is described as available/);
  assert.equal(analysis.playoffs.scenarios.length, 3);
  assert.equal(analysis.fullSeason.anchorComplements.TBL.best[0].partner, 'ANA');
  assert.equal(analysis.fullSeason.anchorComplements.TBL.worst[0].partner, 'TOR');
  assert.equal(analysis.sources.validation.scheduleTeams, 32);
  assert.equal(analysis.sources.validation.gamesPerTeam, 84);
  assert.equal(analysis.sources.validation.scheduleIndexesAgree, true);
  assert.equal(analysis.sources.validation.playerTeamsRecognized, true);
  assert.match(analysis.sources.inputHash, /^[a-f0-9]{64}$/);
});

test('published posts may intentionally omit a publication date', () => {
  const source = `---\nslug: undated-post\ntitle: Undated Post\nexcerpt: Preview before distribution.\nstatus: published\nauthor: Cracked Ice Analytics\ntags: [test]\n---\n\nFinal article body.`;
  const post = postFromDocument(parseMarkdownDocument(source, 'undated-post.md'), 'undated-post.md');
  assert.equal(post.publishDate, undefined);
  assert.match(post.html, /Final article body/);
});

test('published Bible keeps player-level and team-level schedule claims distinct', () => {
  const post = fs.readFileSync(path.join(root, 'content', 'posts', '2026-27-off-night-bible.md'), 'utf8');
  assert.match(post, /Nikita Kucherov and David Pastrnak/);
  assert.match(post, /Dorofeyev gets into this lineup \*\*15 more times\*\*/);
  assert.match(post, /17-date Tampa Bay example/);
  assert.match(post, /It is not the same calculation/);
  assert.match(post, /status: published/);
  assert.match(post, /^publishDate: 2026-08-12$/m);
  assert.match(post, /imageUrl: \/blog-assets\/off-night-bible-84-game-illusion-hero\.png/);
  assert.match(post, /\/blog-assets\/off-night-bible-third-rw\.png/);
  assert.match(post, /\/blog-assets\/off-night-bible-playoff-flip\.png/);
  assert.doesNotMatch(post, /The lesson is narrower|The more actionable edge|There is no universal/);
  assert.doesNotMatch(post, /refreshed July 21|reran the entire analysis on August 6/);
  for (const strategy of ['Balanced', 'Playoff edge', 'Make the playoffs', 'Stars and streamers', 'Custom']) {
    assert.match(post, new RegExp(`### ${strategy}`));
  }
});

test('generated article tables remain horizontally contained on mobile', () => {
  const css = fs.readFileSync(path.join(root, 'web', 'src', 'index.css'), 'utf8');
  const tailwind = fs.readFileSync(path.join(root, 'web', 'tailwind.config.js'), 'utf8');

  assert.match(css, /\.article-table-wrap\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/s);
  assert.match(tailwind, /safelist:\s*\[['"]article-table-wrap['"]\]/);
});

test('complete original articles remain preserved as published archives', () => {
  const expected = [
    ['player-battles-schedule-math-draft-picks-2025.md', 1500, 10],
    ['zero-bench-mock-draft-2025.md', 1300, 4],
    ['position-group-stacks-2025.md', 1200, 5],
  ];
  for (const [filename, minimumWords, minimumImages] of expected) {
    const post = fs.readFileSync(path.join(root, 'content', 'posts', filename), 'utf8');
    assert.ok(post.split(/\s+/).length >= minimumWords, `${filename} was unexpectedly shortened`);
    assert.ok((post.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length >= minimumImages, `${filename} lost inline images`);
    assert.match(post, /complete original article, preserved as published/);
    assert.match(post, /status: published/);
  }
});

test('machine drafts live outside protected editorial drafts', () => {
  const generated = path.join(root, 'content', 'generated', '2026-27', 'drafts');
  const bible = fs.readFileSync(path.join(generated, '2026-27-off-night-bible.generated.md'), 'utf8');
  assert.doesNotMatch(bible, /^publishDate:/m);
  assert.doesNotMatch(bible, /source schedule was refreshed|generated during the offseason/);
  for (const strategy of ['Balanced', 'Playoff edge', 'Make the playoffs', 'Stars and streamers', 'Custom']) {
    assert.match(bible, new RegExp(`### ${strategy}`));
  }
  assert.ok(fs.existsSync(path.join(generated, 'week-2026-09-28.generated.md')));
});

test('launch assets are deployable PNGs and unknown routes are not rewritten to the SPA shell', () => {
  const png = fs.readFileSync(path.join(root, 'web', 'public', 'blog-assets', 'off-night-bible-84-game-illusion.png'));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === '/team' && rewrite.destination === '/index.html'));
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === '/blog/:slug' && rewrite.destination === '/blog/:slug/index.html'));
  assert.ok(!vercel.rewrites.some((rewrite) => rewrite.source.includes('(?!api/.*)')));
});
