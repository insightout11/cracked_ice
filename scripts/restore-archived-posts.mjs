import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceCommit = '7e3418f';
const legacyPath = 'web/src/pages/BlogArticlePage.tsx';
const legacy = execFileSync('git', ['show', `${sourceCommit}:${legacyPath}`], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 4 * 1024 * 1024,
});

const articles = [
  {
    slug: 'player-battles-schedule-math-draft-picks-2025',
    title: 'Player Battles: Schedule Math That Decides Draft Picks',
    excerpt: 'The Draft Room Insanity Nobody Talks About. Stop arguing about talent and start using the schedule data that wins championships. Ten draft battles where math provides the objective answer.',
    publishDate: '2025-09-29',
    tags: ['draft', 'player-battles', 'schedule-math', 'championship', 'strategy', 'archive'],
    imageUrl: '/0.png',
    currentLink: '[Compare two players with current data](/compare)',
  },
  {
    slug: 'zero-bench-mock-draft-2025',
    title: 'Zero Bench: A Championship-Winning Mock Draft Using ONLY Schedule Math',
    excerpt: 'While your opponents memorize ADP rankings, engineer a roster that peaks when everyone else crumbles. Stop drafting for September—start drafting for March.',
    publishDate: '2025-09-24',
    tags: ['draft', 'strategy', 'mock-draft', 'championship', 'schedule-math', 'archive'],
    imageUrl: '/zeroBench.png',
    currentLink: '[Build a current 2026–27 draft board](/team?view=draft-board)',
  },
  {
    slug: 'position-group-stacks-2025',
    title: 'Best Position Group Stacks for Fantasy Hockey 2025–26',
    excerpt: 'Stop benching good players and start weaponizing the NHL schedule. Learn the mathematical strategy that separates winners from those who draft with feelings.',
    publishDate: '2025-09-18',
    tags: ['strategy', 'draft', 'position-stacks', 'advanced', 'archive'],
    imageUrl: '/blog1.png',
    currentLink: '[Find current schedule partners](/)',
  },
];

function extractBody(slug) {
  const marker = `id === '${slug}'`;
  const start = legacy.indexOf(marker);
  if (start < 0) throw new Error(`Archived article not found: ${slug}`);
  const next = legacy.indexOf("} else if (id === '", start + marker.length);
  const block = legacy.slice(start, next < 0 ? legacy.indexOf('// Simulate API delay', start) : next);
  const match = block.match(/content:\s*`([\s\S]*?)`\.trim\(\)/);
  if (!match) throw new Error(`Archived article body not found: ${slug}`);

  const markdown = match[1]
    .trim()
    .replace(/<img\s+src="([^"]+)"\s+alt="([^"]*)"[^>]*\/>/g, '![$2]($1)')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1')
    .replace(/\r\n?/g, '\n');
  if (/<(?:img|span)\b/i.test(markdown)) throw new Error(`Unconverted legacy markup remains in ${slug}`);
  return markdown;
}

function frontmatter(article) {
  return `---
slug: ${article.slug}
title: "${article.title}"
excerpt: "${article.excerpt}"
publishDate: ${article.publishDate}
updatedDate: 2026-08-06
status: published
author: Cracked Ice Analytics
tags: [${article.tags.join(', ')}]
imageUrl: ${article.imageUrl}
---`;
}

for (const article of articles) {
  const archiveNote = `> Archive note: This is the complete original article, preserved as published for the 2025–26 season. Player teams, roles, eligibility, projections, and schedule conclusions may have changed. ${article.currentLink}.`;
  const output = `${frontmatter(article)}\n\n${archiveNote}\n\n${extractBody(article.slug)}\n`;
  const outputPath = path.join(root, 'content', 'posts', `${article.slug}.md`);
  await fs.writeFile(outputPath, output, 'utf8');
  console.log(`Restored ${article.slug} from ${sourceCommit}:${legacyPath}`);
}
