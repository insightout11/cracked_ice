import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const season = JSON.parse(await fs.readFile(path.join(root, 'config', 'season.json'), 'utf8'));
const analysisPath = path.join(root, 'content', 'generated', season.label, 'schedule-analysis.json');
const data = JSON.parse(await fs.readFile(analysisPath, 'utf8'));
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}`;
const top = data.fullSeason.teams;
const playoffs = data.playoffs.teams;
const pairs = data.fullSeason.topPairs;
const tradeoffs = top.map((row) => ({ ...row, playoff: playoffs.find((team) => team.team === row.team) })).sort((a, b) => (b.playoff.offNights - b.offNights) - (a.playoff.offNights - a.offNights));

const article = `---
slug: ${season.label}-fantasy-hockey-off-night-bible
title: "The ${season.label} Fantasy Hockey Off-Night Bible"
excerpt: "Every team ranked by off-night volume, playoff schedule, back-to-backs, and schedule compatibility."
publishDate: 2026-08-15
status: draft
author: Cracked Ice Analytics
tags: [off-night-bible, schedule, playoffs, draft, ${season.label}]
---

# The ${season.label} Fantasy Hockey Off-Night Bible

Most season-long rankings answer one question: **how good is the player?** Fantasy managers also need to know how often that player can reach an active lineup. The ${season.label} NHL schedule creates measurable differences in off-night access, playoff volume, and same-position congestion.

This guide maps those differences. It does **not** assume that every player on a favorable team is valuable or available. Production, role, health, scoring settings, and roster context still come first.

## What counts as an off-night?

Cracked Ice labels a date an off-night when the NHL has **8 or fewer games**. That threshold is a transparent convention, not a universal law. Your actual usable starts are calculated separately from your league's lineup slots and roster.

The schedule contains ${data.fullSeason.teams.length} teams at ${season.gamesPerTeam} games each, from ${season.regularSeasonStart} through ${season.regularSeasonEnd}. The source schedule was refreshed ${data.sources.scheduleLastRefreshed}.

## Full-season off-night rankings

${table(['Rank', 'Team', 'Games', 'Off-nights', 'Off-night rate', 'B2Bs'], top.map((row, index) => [index + 1, row.team, row.games, row.offNights, `${row.offNightRate}%`, row.backToBacks]))}

## Fantasy playoff schedule

The site default playoff window is **${data.playoffs.start} through ${data.playoffs.end}**. Change this in My League before making decisions; many leagues end earlier.

${table(['Rank', 'Team', 'Playoff games', 'Off-nights', 'Busy nights'], playoffs.map((row, index) => [index + 1, row.team, row.games, row.offNights, row.busyNights]))}

## The best one-slot schedule pairings

For two players competing for one active slot, “usable dates” equals the union of their teams' game dates. A conflict is a date when both teams play. This is schedule opportunity—not a player recommendation.

${table(['Teams', 'Usable dates', 'Shared nights', 'Off-night dates', 'Complement rate'], pairs.slice(0, 20).map((row) => [`${row.teamA} + ${row.teamB}`, row.usableOneSlot, row.sharedNights, row.offNightDates, `${row.complementRate}%`]))}

## Pairings most likely to collide

${table(['Teams', 'Shared nights', 'Usable dates'], data.fullSeason.worstPairs.map((row) => [`${row.teamA} + ${row.teamB}`, row.sharedNights, row.usableOneSlot]))}

## Regular-season versus playoff tradeoffs

There is no single correct draft strategy. A playoff-heavy build can improve a contender's ceiling but sacrifice regular-season usability. A balanced build reduces that risk. These teams have the largest differences between full-season and playoff off-night profiles:

${table(['Team', 'Season off-nights', 'Playoff off-nights', 'Playoff games'], tradeoffs.slice(0, 15).map((row) => [row.team, row.offNights, row.playoff.offNights, row.playoff.games]))}

## How to use this without overfitting

1. Set your league scoring, positions, and real playoff dates once in My League.
2. Rank players primarily by projected production and role.
3. Use schedule fit to break ties within a tier.
4. Recalculate usable starts against your actual roster.
5. Check league availability before acting.

[Explore the full season schedule](/season) or [compare players in your league context](/compare).

> Owner review required before publication: verify schedule source, article date, claims, screenshots, internal links, and any player examples added during editing. Canonical artifact hash: ${data.sources.inputHash}.
`;
const out = path.join(root, 'content', 'drafts', `${season.label}-off-night-bible.md`);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, article);
console.log(`Generated owner-review draft: ${out}`);
