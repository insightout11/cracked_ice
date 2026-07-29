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
  assert.match(post.html, /<h1>Heading<\/h1>/);
  assert.doesNotMatch(post.html, /<script>/);
  assert.match(post.html, /<table>/);
});

test('unsafe link protocols are discarded', () => {
  assert.equal(renderMarkdown('[click](javascript:alert(1))'), '<p><a href="#">click</a>)</p>');
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
});

test('owner-review Bible keeps player-level and team-level schedule claims distinct', () => {
  const draft = fs.readFileSync(path.join(root, 'content', 'drafts', '2026-27-off-night-bible.md'), 'utf8');
  assert.match(draft, /Nikita Kucherov and David Pastrnak/);
  assert.match(draft, /Pavel Dorofeyev creates \*\*15 more usable starts\*\*/);
  assert.match(draft, /separate 17-date TBL team-partner extreme/);
  assert.match(draft, /it is not the same calculation/);
});
