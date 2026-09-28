/**
 * The Monday schedule post: this week's quiet and packed nights and the best streaming
 * schedules, from the NHL schedule alone (no simulation). Writes three things:
 *
 *   content/drafts/week-<start>-off-nights.md                 search-friendly article (draft)
 *   content/social/<season>/week-<start>-schedule-reddit.md   short Reddit post + first comment
 *   week-<start>-nights.png                                   one graphic (site + social assets)
 *
 * Both point readers at the full grid on /season. The week ranking matches the site's
 * "Best Schedule First" sort (scripts/lib/week-schedule.mjs).
 *
 * Usage: node scripts/weekly/schedule-week.mjs --start 2026-10-05
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addDays, buildWeek, dayLabel, PACKED_NIGHT, QUIET_NIGHT, teamNote, weekday } from '../lib/week-schedule.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const season = JSON.parse(fs.readFileSync(path.join(root, 'config/season.json'), 'utf8'));
const start = process.argv[process.argv.indexOf('--start') + 1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') || new Date(`${start}T12:00:00Z`).getUTCDay() !== 1) throw new Error('--start must be a Monday (YYYY-MM-DD)');

const schedule = JSON.parse(fs.readFileSync(path.join(root, 'web', 'public', season.scheduleFile), 'utf8'));
const week = buildWeek(schedule, start);
const origin = 'https://www.crackedicehockey.com';
const gridUrl = `${origin}/season?start=${start}`;

const seasonMonday = (() => { const date = new Date(`${season.regularSeasonStart}T12:00:00Z`); return addDays(season.regularSeasonStart, -((date.getUTCDay() + 6) % 7)); })();
const weekNumber = Math.round((new Date(`${start}T12:00:00Z`) - new Date(`${seasonMonday}T12:00:00Z`)) / (7 * 86_400_000)) + 1;
const year = start.slice(0, 4);
const monthDay = (date) => dayLabel(date, { month: 'short', day: 'numeric' });
const slug = `nhl-off-nights-this-week-${week.label.toLowerCase().replace(/[–\s]+/g, '-').replace(/[^a-z0-9-]/g, '')}-${year}`;
const articleUrl = `${origin}/blog/${slug}`;

const listDays = (nights) => nights.map((night) => weekday(night.date));
const joinWords = (words) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);
const nightList = (nights) => nights.map((night) => `${weekday(night.date)} (${night.games})`).join(', ');
const quietWords = joinWords(listDays(week.quietNights));
const packed = week.packedNights[0];

// ---------------------------------------------------------------------------
// Article (search: "NHL off nights this week")
// ---------------------------------------------------------------------------
const quickAnswer = [
  `- **Off-nights (${QUIET_NIGHT} or fewer games):** ${nightList(week.quietNights) || 'none this week'}`,
  `- **Packed nights (${PACKED_NIGHT}+ games):** ${nightList(week.packedNights) || 'none this week'}`,
  `- **Best streaming schedules:** ${week.best.slice(0, 4).map((team) => `${team.name} (${teamNote(team)})`).join('; ')}`,
  week.fourGameTeams.length ? `- **Four-game weeks:** ${joinWords(week.fourGameTeams.map((team) => team.name))}` : null,
  week.quietBackToBacks.length ? `- **Back-to-backs on two off-nights:** ${week.quietBackToBacks.map((b2b) => `${b2b.name} (${weekday(b2b.dates[0])}/${weekday(b2b.dates[1])})`).join(', ')}` : null,
  `- **Toughest schedules:** ${week.toughest.map((team) => `${team.name} (${teamNote(team)})`).join('; ')}`,
].filter(Boolean).join('\n');

const table = [
  '| Team | Games | On off-nights | Nights |',
  '|---|---|---|---|',
  ...week.teams.map((team) => `| ${team.name} | ${team.games} | ${team.offNightGames} | ${team.dates.map(weekday).join(', ') || '—'} |`),
].join('\n');

const intro = `Week ${weekNumber} (${week.label}) has ${week.totalGames} NHL games. ${week.quietNights.length ? `The off-nights are ${quietWords}, when most fantasy lineups have open spots.` : 'There are no true off-nights this week.'}${packed ? ` ${dayLabel(packed.date, { weekday: 'long' })} is packed with ${packed.games} games, so most lineups are already full and a streamer added just for it usually sits.` : ''}`;

const article = `---
slug: ${slug}
title: "NHL Off-Nights This Week (${week.label}): Best Teams to Stream for Fantasy Hockey"
excerpt: "The Week ${weekNumber} NHL off-nights, packed nights, four-game weeks and best streaming schedules for fantasy hockey, ${week.label}."
publishDate: ${start}
status: draft
author: Cracked Ice Analytics
tags: [off-nights, weekly-schedule, streaming, ${season.label}]
imageUrl: /blog-assets/week-${start}-nights.png
---

# NHL off-nights this week: ${week.label}

${intro}

![Week ${weekNumber} NHL off-nights: games each night and the best streaming schedules](/blog-assets/week-${start}-nights.png)

## Quick answer

${quickAnswer}

See every team, every night on [the Week ${weekNumber} schedule grid](/season?start=${start}).

## Every team's week

Sorted by schedule for streaming: more games, and more of them on off-nights.

${table}

## What the nights mean

An off-night is a night with ${QUIET_NIGHT} or fewer NHL games. Fewer teams play, so most fantasy rosters have open lineup spots, and a streamer's game actually counts. On a packed night (${PACKED_NIGHT} or more games) most lineups are already full, so an extra game there usually sits on your bench. Four games only help if they land on nights you have room.

## Do it for your own roster

This list is for an average roster. [The schedule grid](/season?start=${start}) shows every team night by night, and [My Team](/team) finds the nights *your* lineup has room and the best teams to stream into them.
`;

// ---------------------------------------------------------------------------
// Reddit (title avoids the words the sub's post guidance treats as team-help requests)
// ---------------------------------------------------------------------------
const redditTitle = packed
  ? `Week ${weekNumber} off-nights: ${quietWords} ${week.quietNights.length === 1 ? 'is' : 'are'} quiet, ${dayLabel(packed.date, { weekday: 'long' })} has ${packed.games} games`
  : `Week ${weekNumber} off-nights: ${quietWords} ${week.quietNights.length === 1 ? 'is' : 'are'} quiet`;
const reddit = `# Reddit post: Week ${weekNumber} schedule (${week.label})

**Status:** Draft. Generated by \`scripts/weekly/schedule-week.mjs\`; publish the article first so its link works.

**Image:** \`assets/week-${start}-nights.png\`

## Title

${redditTitle}

## Post

Quick schedule rundown for Week ${weekNumber} (${week.label}), ${week.totalGames} games.

**Quiet nights (${QUIET_NIGHT} or fewer games):** ${nightList(week.quietNights) || 'none'}. Most fantasy lineups have open spots these nights.
${packed ? `\n**Packed:** ${nightList(week.packedNights)}. Most lineups are already full, so a streamer added just for it usually sits.\n` : ''}
**Best streaming schedules**

${week.best.slice(0, 4).map((team) => `- **${team.name}:** ${teamNote(team)}`).join('\n')}
${week.fourGameTeams.length ? `\n**Four-game weeks:** ${joinWords(week.fourGameTeams.map((team) => team.name))}\n` : ''}${week.quietBackToBacks.length ? `\n**Back-to-backs on two quiet nights:** ${week.quietBackToBacks.map((b2b) => `${b2b.name} (${weekday(b2b.dates[0])}/${weekday(b2b.dates[1])})`).join(', ')}\n` : ''}
**Toughest schedules:** ${week.toughest.map((team) => `${team.name} (${teamNote(team)})`).join('; ')}

Every team, every night: ${gridUrl}

All 32 teams in one table: ${articleUrl}

## First comment

How this is counted: a quiet night has ${QUIET_NIGHT} or fewer NHL games, a packed night ${PACKED_NIGHT} or more. Teams are ranked by games, weighted toward the ones on quiet nights, since those are the games that fit a lineup. The Sunday Weekly Edge post goes deeper (simulated lineups, pickup options by ownership); this is the quick schedule version.
`;

// ---------------------------------------------------------------------------
// Graphic
// ---------------------------------------------------------------------------
const C = { bg: '#071522', panel: '#0d2032', line: '#24465c', ink: '#f1f8ff', dim: '#9cb6c7', mute: '#6f8ea3', ice: '#63e6ff', red: '#ff7d8b', green: '#84f7a6' };
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const logo = (team, x, y, size) => `<image href="https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
function graphic() {
  const width = 1200; const height = 675;
  const tileW = 144; const gap = 10; const x0 = 60; const y0 = 180;
  const maxGames = Math.max(...week.nights.map((night) => night.games), 1);
  const tiles = week.nights.map((night, index) => {
    const x = x0 + index * (tileW + gap);
    const quiet = night.games > 0 && night.games <= QUIET_NIGHT;
    const isPacked = night.games >= PACKED_NIGHT;
    const color = isPacked ? C.red : quiet ? C.ice : C.dim;
    const barH = Math.round((130 * night.games) / maxGames);
    return `<g transform="translate(${x} ${y0})">
<rect width="${tileW}" height="230" rx="16" fill="${isPacked ? '#3a1622' : quiet ? '#0f3346' : C.panel}" stroke="${isPacked ? C.red : quiet ? C.ice : C.line}" stroke-width="${isPacked || quiet ? 2 : 1}"/>
<text x="16" y="34" class="t" fill="${C.ink}" font-size="19" font-weight="700">${esc(weekday(night.date))}</text>
<text x="16" y="56" class="t" fill="${C.mute}" font-size="14">${esc(monthDay(night.date))}</text>
<rect x="16" y="${212 - barH}" width="${tileW - 32}" height="${barH}" rx="6" fill="${color}" opacity=".85"/>
<text x="${tileW - 16}" y="${204 - barH}" text-anchor="end" class="d" fill="${color}" font-size="34">${night.games}</text>
</g>`;
  }).join('\n');
  const best = week.best.slice(0, 4).map((team, index) => {
    const x = 60 + index * 272;
    return `<g transform="translate(${x} 480)">
<rect width="258" height="110" rx="14" fill="${C.panel}" stroke="${C.line}"/>
${logo(team.team, 16, 27, 56)}
<text x="86" y="44" class="t" fill="${C.ink}" font-size="21" font-weight="700">${esc(team.name)}</text>
<text x="86" y="70" class="t" fill="${C.dim}" font-size="15">${esc(`${team.games} games${team.backToBacks.length ? ', back-to-back' : ''}`)}</text>
<text x="86" y="92" class="t" fill="${C.mute}" font-size="15">${esc(`${team.offNightGames === team.games ? 'all' : team.offNightGames} on off-nights`)}</text>
</g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;family=Orbitron:wght@700;800&amp;display=block');
.d{font-family:Orbitron,Arial,sans-serif;font-weight:800}
.t{font-family:Inter,Arial,sans-serif}
</style>
<radialGradient id="glow" cx="15%" cy="0%" r="70%"><stop offset="0" stop-color="#63e6ff" stop-opacity=".16"/><stop offset="1" stop-color="#63e6ff" stop-opacity="0"/></radialGradient></defs>
<rect width="${width}" height="${height}" fill="${C.bg}"/><rect width="${width}" height="${height}" fill="url(#glow)"/>
<text x="60" y="64" class="t" fill="${C.ice}" font-size="17" font-weight="700" letter-spacing="2.5">CRACKED ICE · WEEK ${weekNumber} SCHEDULE</text>
<text x="60" y="112" class="d" fill="${C.ink}" font-size="38">${esc(`${week.label}: the off-nights`)}</text>
<text x="60" y="146" class="t" fill="${C.dim}" font-size="19">${esc(`${week.totalGames} games. Blue: ${QUIET_NIGHT} or fewer (lineups have room). Red: ${PACKED_NIGHT}+ (lineups are full).`)}</text>
${tiles}
<text x="60" y="462" class="t" fill="${C.ice}" font-size="17" font-weight="700" letter-spacing="2">BEST STREAMING SCHEDULES</text>
${best}
<text x="60" y="${height - 30}" class="t" fill="${C.mute}" font-size="15">${esc(`crackedicehockey.com/season · every team, every night`)}</text>
</svg>`;
}

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((candidate) => fs.existsSync(candidate));

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
const draftPath = path.join(root, 'content', 'drafts', `week-${start}-off-nights.md`);
const redditPath = path.join(root, 'content', 'social', season.label, `week-${start}-schedule-reddit.md`);
fs.writeFileSync(draftPath, article);
fs.writeFileSync(redditPath, reddit);
console.log(`Wrote ${path.relative(root, draftPath)} and ${path.relative(root, redditPath)}`);

if (!CHROME) {
  console.warn('Chrome or Edge not found: skipped the graphic.');
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-week-'));
  const svg = graphic();
  const svgPath = path.join(tmp, 'nights.svg');
  const htmlPath = path.join(tmp, 'nights.html');
  const pngPath = path.join(tmp, 'nights.png');
  fs.writeFileSync(svgPath, svg);
  fs.writeFileSync(htmlPath, `<!doctype html><html><head><style>html,body{margin:0;background:${C.bg}}</style></head><body>${svg}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=1200,675', '--virtual-time-budget=20000', `--screenshot=${pngPath}`, pathToFileURL(htmlPath).href], { stdio: 'ignore' });
  const outDirs = [path.join(root, 'web', 'public', 'blog-assets'), path.join(root, 'content', 'social', season.label, 'assets')];
  for (const dir of outDirs) fs.copyFileSync(pngPath, path.join(dir, `week-${start}-nights.png`));
  fs.copyFileSync(svgPath, path.join(outDirs[1], `week-${start}-nights.svg`));
  console.log(`week-${start}-nights.png (1200x675 @2x)`);
}
