import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const season = JSON.parse(await fs.readFile(path.join(root, 'config', 'season.json'), 'utf8'));
const analysisPath = path.join(root, 'content', 'generated', season.label, 'schedule-analysis.json');
const data = JSON.parse(await fs.readFile(analysisPath, 'utf8'));
const playerData = JSON.parse(await fs.readFile(path.join(root, 'data', 'players.json'), 'utf8'));
const statsData = JSON.parse(await fs.readFile(path.join(root, 'data', 'stats.json'), 'utf8'));
const scheduleData = JSON.parse(await fs.readFile(path.join(root, 'data', season.scheduleFile), 'utf8'));
const scoringPresets = JSON.parse(await fs.readFile(path.join(root, 'config', 'scoring-presets.json'), 'utf8'));
const publishDateIndex = process.argv.indexOf('--publish-date');
const publishDate = publishDateIndex >= 0 ? process.argv[publishDateIndex + 1] : '';
if (publishDate && !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) throw new Error('--publish-date must be YYYY-MM-DD');
const replaceEditorial = process.argv.includes('--replace-editorial');
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}`;
const top = data.fullSeason.teams;
const playoffs = data.playoffs.teams;
const pairs = data.fullSeason.topPairs;
const worstPairs = data.fullSeason.worstPairs;
const bestPair = pairs[0];
const worstPair = worstPairs[0];
const offNightSpread = top[0].offNights - top.at(-1).offNights;
const pairingSpread = bestPair.usableOneSlot - worstPair.usableOneSlot;
const tampa = data.fullSeason.anchorComplements.TBL;
const tampaSpread = tampa.best[0].usableOneSlot - tampa.worst[0].usableOneSlot;
const skaterWeights = scoringPresets.default.skater;
const playerByName = (name) => {
  const player = playerData.players.find((candidate) => candidate.name === name);
  if (!player) throw new Error(`Missing editorial player: ${name}`);
  return player;
};
const referenceFppg = (player) => {
  const stats = statsData.players[player.id]?.skaterStats;
  if (!stats?.gamesPlayed) return 0;
  const points =
    (stats.goals || 0) * skaterWeights.goals
    + (stats.assists || 0) * skaterWeights.assists
    + (stats.shots || 0) * skaterWeights.shots_on_goal
    + (stats.blocks || 0) * skaterWeights.blocks
    + (stats.ppPoints || 0) * skaterWeights.power_play_points;
  return points / stats.gamesPlayed;
};
const teamDates = Object.fromEntries(Object.entries(scheduleData.games).map(([team, games]) => [team, new Set(games.map((game) => game.date))]));
const premiumRightWings = [playerByName('Nikita Kucherov'), playerByName('David Pastrnak')];
const thirdRightWingOptions = [playerByName('Pavel Dorofeyev'), playerByName('Kirill Marchenko')].map((player) => ({
  ...player,
  referenceFppg: referenceFppg(player),
  usableStarts: [...teamDates[player.team]].filter((date) => premiumRightWings.filter((anchor) => teamDates[anchor.team].has(date)).length < 2).length,
}));
thirdRightWingOptions.sort((a, b) => b.usableStarts - a.usableStarts);
const thirdRightWingSwing = thirdRightWingOptions[0].usableStarts - thirdRightWingOptions[1].usableStarts;
const thirdRightWingPointSwing = thirdRightWingOptions[0].usableStarts * thirdRightWingOptions[0].referenceFppg
  - thirdRightWingOptions[1].usableStarts * thirdRightWingOptions[1].referenceFppg;
const configuredScenario = data.playoffs.scenarios.find((scenario) => scenario.id === 'configured');
const earlyScenario = data.playoffs.scenarios.find((scenario) => scenario.id === 'early-three-week');
const finalScenario = data.playoffs.scenarios.find((scenario) => scenario.id === 'championship-week');
const scenarioTeam = (scenario, team) => scenario.teams.find((row) => row.team === team);
const scenarioLeaders = data.playoffs.scenarios.map((scenario) => [scenario.label, `${scenario.start} to ${scenario.end}`, scenario.teams.slice(0, 4).map((team) => `${team.team} (${team.games} GP, ${team.offNights} off)`).join('; ')]);
const anchorRows = ['TBL', 'WSH', 'NYR', 'COL', 'SJS'].map((team) => {
  const options = data.fullSeason.anchorComplements[team];
  return [team, `${options.best[0].partner} · ${options.best[0].usableOneSlot} dates · ${options.best[0].sharedNights} conflicts`, `${options.worst[0].partner} · ${options.worst[0].usableOneSlot} dates · ${options.worst[0].sharedNights} conflicts`, options.best[0].usableOneSlot - options.worst[0].usableOneSlot];
});
const insightSvg = (eyebrow, title, subtitle, left, right, footer) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071522"/><stop offset="1" stop-color="#123347"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="9" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect width="1200" height="675" fill="url(#bg)"/><path d="M0 132H1200M0 590H1200" stroke="#28506a"/><circle cx="1085" cy="110" r="250" fill="#58dcf5" opacity=".06"/>
  <g font-family="Arial,sans-serif"><text x="64" y="62" fill="#58dcf5" font-size="18" font-weight="700" letter-spacing="3">${eyebrow}</text><text x="64" y="116" fill="#f1f8ff" font-size="42" font-weight="800">${title}</text><text x="64" y="157" fill="#bed0dc" font-size="21">${subtitle}</text>
  <g transform="translate(64 205)"><rect width="514" height="278" rx="24" fill="#091b2a" stroke="#28506a"/><text x="32" y="54" fill="#9cb6c7" font-size="18" font-weight="700" letter-spacing="2">${left.label}</text><text x="32" y="133" fill="#58dcf5" font-size="72" font-weight="900" filter="url(#glow)">${left.value}</text><text x="32" y="178" fill="#f1f8ff" font-size="25" font-weight="700">${left.title}</text><text x="32" y="220" fill="#bed0dc" font-size="19">${left.detail}</text></g>
  <g transform="translate(622 205)"><rect width="514" height="278" rx="24" fill="#091b2a" stroke="#28506a"/><text x="32" y="54" fill="#9cb6c7" font-size="18" font-weight="700" letter-spacing="2">${right.label}</text><text x="32" y="133" fill="${right.color || '#75f0ad'}" font-size="72" font-weight="900" filter="url(#glow)">${right.value}</text><text x="32" y="178" fill="#f1f8ff" font-size="25" font-weight="700">${right.title}</text><text x="32" y="220" fill="#bed0dc" font-size="19">${right.detail}</text></g>
  <text x="64" y="548" fill="#f1f8ff" font-size="22" font-weight="700">${footer}</text><text x="64" y="631" fill="#9cb6c7" font-size="17">Exact dates and roster context change the answer.</text><text x="1136" y="631" text-anchor="end" fill="#58dcf5" font-size="18" font-weight="700">crackedicehockey.com</text></g>
</svg>`;

const article = `---
slug: ${season.label}-fantasy-hockey-off-night-bible
title: "The ${season.label} Fantasy Hockey Off-Night Bible"
excerpt: "Why 84 NHL games do not equal 84 fantasy starts—and which schedules create or erase lineup value."
${publishDate ? `publishDate: ${publishDate}\n` : ''}status: draft
author: Cracked Ice Analytics
tags: [off-night-bible, schedule, playoffs, draft, ${season.label}]
imageUrl: /blog-assets/off-night-bible-84-game-illusion.png
---

# The ${season.label} Fantasy Hockey Off-Night Bible

## You landed Kucherov and Pastrnak. What should the third RW do?

Suppose you were fortunate enough to secure Nikita Kucherov and David Pastrnak as two premium right wings. Talent settled the early picks. The schedule becomes much more useful when deciding what kind of third right wing should sit behind them.

In a controlled lineup with **two active RW slots and no utility slot**, two later options produce very different results:

| Third RW | Reference FPPG | Usable starts behind Kucherov + Pastrnak |
| --- | --- | --- |
| ${thirdRightWingOptions[0].name} (${thirdRightWingOptions[0].team}) | ${thirdRightWingOptions[0].referenceFppg.toFixed(2)} | ${thirdRightWingOptions[0].usableStarts} |
| ${thirdRightWingOptions[1].name} (${thirdRightWingOptions[1].team}) | ${thirdRightWingOptions[1].referenceFppg.toFixed(2)} | ${thirdRightWingOptions[1].usableStarts} |

${thirdRightWingOptions[1].name} owns the slightly better reference scoring rate. ${thirdRightWingOptions[0].name} creates **${thirdRightWingSwing} more usable starts**. If both repeated those reference rates, the added lineup room would be worth roughly **${thirdRightWingPointSwing.toFixed(0)} fantasy points** over the full season.

This is not an ADP claim or a universal recommendation. The reference FPPG uses the Cracked Ice default scoring preset, and real leagues may have utility slots or multi-position paths that recover some conflicts. The lesson is narrower: **once two premium players occupy a position, the best third player is partly a roster-fit decision.**

There is also a separate 17-date TBL team-partner extreme later in this guide. That number describes the difference between TBL's cleanest and most congested team partners in a one-slot diagnostic; it is not the same calculation as this ${thirdRightWingSwing}-start third-RW example.

## The 84-game illusion

Every NHL team plays 84 games this season. Your fantasy roster will not use all 84 of them.

That is the schedule mistake most rankings make. A game on an open Wednesday can add points to your lineup. The same player on an overloaded Saturday may add nothing because your active slots are already full. Player quality remains the starting point, but **a scheduled game and a usable start are not the same asset**.

The familiar headline is that ${top[0].team} leads the league with ${top[0].offNights} off-night games while ${top.at(-1).team} has ${top.at(-1).offNights}. The ${offNightSpread}-game gap matters. It is not the most important finding in this data.

The more actionable edge is **schedule interaction**:

- The best two-team pairing creates **${bestPair.usableOneSlot} distinct playable dates** in one shared slot. The worst creates ${worstPair.usableOneSlot}—a ${pairingSpread}-start swing before changing either player's talent projection.
- A TBL anchor has ${tampa.best[0].partner} as its cleanest partner and ${tampa.worst[0].partner} as its most congested. That decision alone changes the one-slot ceiling by ${tampaSpread} dates.
- SJS looks elite across the configured playoff window (${scenarioTeam(configuredScenario, 'SJS').games} games, ${scenarioTeam(configuredScenario, 'SJS').offNights} off-nights), but has only ${scenarioTeam(finalScenario, 'SJS').games} games and ${scenarioTeam(finalScenario, 'SJS').offNights} off-nights in the final NHL week. **Your playoff dates can reverse a recommendation.**

This is why there is no universal “best schedule.” There is only the best schedule for your roster, slots, scoring, and dates.

## Method: what Cracked Ice measures

Cracked Ice labels a date an off-night when the NHL has **8 or fewer games**. The threshold is transparent, but it is still a shortcut. The stronger metric is usable starts, calculated from the games that survive your league's date window, active slots, position eligibility, and existing roster congestion.

For the pairing tables below, two teams compete for **one shared active slot**:

- **Usable dates** are the union of both team schedules.
- **Conflicts** are dates when both teams play.
- **Off-night dates** are distinct dates in the pairing that fall on quieter NHL slates.

## Five anchor teams, five different answers

The right partner depends on the player already on your roster. These examples show the cleanest and most congested schedule partner for five recognizable team anchors. They are team-level schedule comparisons—not claims about player availability.

${table(['Anchor', 'Cleanest partner', 'Most congested partner', 'Usable-date swing'], anchorRows)}

TBL is the clearest warning. Pairing its schedule with ${tampa.best[0].partner} produces ${tampa.best[0].usableOneSlot} distinct dates and ${tampa.best[0].sharedNights} conflicts. Pairing it with ${tampa.worst[0].partner} produces ${tampa.worst[0].usableOneSlot} dates and ${tampa.worst[0].sharedNights} conflicts. A normal ranking sees two comparable players. Your lineup sees ${tampaSpread} possible starts.

## The best one-slot combinations

These are schedule opportunities, not player rankings. Use them after identifying players in a similar production tier and applying your league scoring.

${table(['Teams', 'Usable dates', 'Shared nights', 'Off-night dates', 'Complement rate'], pairs.slice(0, 10).map((row) => [`${row.teamA} + ${row.teamB}`, row.usableOneSlot, row.sharedNights, row.offNightDates, `${row.complementRate}%`]))}

## The combinations most likely to collide

${table(['Teams', 'Shared nights', 'Usable dates'], worstPairs.slice(0, 8).map((row) => [`${row.teamA} + ${row.teamB}`, row.sharedNights, row.usableOneSlot]))}

Avoiding every conflict is neither possible nor desirable. Elite players remain elite. This table matters most when two players occupy the same tier, fight for the same slot, or represent similar acquisition costs.

## Playoff dates change the answer

“Good playoff schedule” is incomplete without exact dates. A league that ends April 4 is analyzing a different asset than one that plays through April 10.

${table(['Scenario', 'Dates', 'Top schedules'], scenarioLeaders)}

The SJS example is the sharpest reversal:

- **Early three-week window:** ${scenarioTeam(earlyScenario, 'SJS').games} games, ${scenarioTeam(earlyScenario, 'SJS').offNights} off-nights.
- **Configured window:** ${scenarioTeam(configuredScenario, 'SJS').games} games, ${scenarioTeam(configuredScenario, 'SJS').offNights} off-nights.
- **Final NHL week:** ${scenarioTeam(finalScenario, 'SJS').games} games, ${scenarioTeam(finalScenario, 'SJS').offNights} off-nights.

A single generic playoff ranking would call SJS a target and stop there. A date-aware model shows when that advice expires.

## Full-season off-night leaders

Use this as a map, not a draft board. High off-night volume boosts opportunity; it does not replace production, role, health, or acquisition cost.

${table(['Rank', 'Team', 'Games', 'Off-nights', 'Off-night rate', 'B2Bs'], top.slice(0, 10).map((row, index) => [index + 1, row.team, row.games, row.offNights, `${row.offNightRate}%`, row.backToBacks]))}

[Explore all 32 teams and choose your own dates](/season).

## Configured fantasy playoff table

The current site default is ${data.playoffs.start} through ${data.playoffs.end}. Set your real dates in My League before relying on this view.

${table(['Rank', 'Team', 'Playoff games', 'Off-nights', 'Busy nights'], playoffs.slice(0, 12).map((row, index) => [index + 1, row.team, row.games, row.offNights, row.busyNights]))}

## Pick the strategy that matches your league

### Balanced

Projected value leads; regular-season access, playoff weeks, and position value break close calls.

### Playoff edge

Accept some regular-season schedule cost for players whose teams improve during your exact playoff weeks.

### Make the playoffs

Emphasize usable regular-season games before optimizing the playoff weeks.

### Stars and streamers

Prioritize elite production and assume later roster spots can be streamed during the season.

### Custom

Set the projected-value, regular-season, playoff, and position-value weights directly for your league.

## How to use this without overfitting

1. Save your league scoring, positions, and exact playoff dates in My League.
2. Rank players primarily by production, role, and health.
3. Compare schedule fit inside a tier—not across a massive talent gap.
4. Recalculate usable starts as your roster fills.
5. Check availability in your own league before acting.

[Build your league-scored draft board](/), [explore the full season schedule](/season), or [compare players in your league context](/compare).

> Owner review required before publication: verify schedule source, article date, claims, screenshots, internal links, and any player examples added during editing. Canonical artifact hash: ${data.sources.inputHash}.
`;
const editorialOut = path.join(root, 'content', 'drafts', `${season.label}-off-night-bible.md`);
const publishedOut = path.join(root, 'content', 'posts', `${season.label}-off-night-bible.md`);
const generatedOut = path.join(root, 'content', 'generated', season.label, 'drafts', `${season.label}-off-night-bible.generated.md`);
await Promise.all([fs.mkdir(path.dirname(editorialOut), { recursive: true }), fs.mkdir(path.dirname(generatedOut), { recursive: true })]);
await fs.writeFile(generatedOut, article);
let editorialAction = 'Preserved';
try {
  await fs.access(editorialOut);
  if (replaceEditorial) {
    await fs.writeFile(editorialOut, article);
    editorialAction = 'Replaced';
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  try {
    await fs.access(publishedOut);
    editorialAction = 'Skipped editorial recreation because a published version exists';
  } catch (publishedError) {
    if (publishedError.code !== 'ENOENT') throw publishedError;
    await fs.writeFile(editorialOut, article);
    editorialAction = 'Created';
  }
}
const socialRoot = path.join(root, 'content', 'social', season.label);
const assetsRoot = path.join(socialRoot, 'assets');
const publicAssetsRoot = path.join(root, 'web', 'public', 'blog-assets');
await Promise.all([fs.mkdir(assetsRoot, { recursive: true }), fs.mkdir(publicAssetsRoot, { recursive: true })]);
const reddit = `# DRAFT — The ${season.label} fantasy hockey schedule has a ${pairingSpread}-start trap

Every NHL team plays 84 games. That does not mean your fantasy lineup can use 84 games from every player.

Say you were lucky enough to land Nikita Kucherov and David Pastrnak as your first two right wings. In a controlled two-RW lineup, ${thirdRightWingOptions[0].name} produces ${thirdRightWingOptions[0].usableStarts} usable starts behind them while ${thirdRightWingOptions[1].name} produces ${thirdRightWingOptions[1].usableStarts}. That is a **${thirdRightWingSwing}-start difference**, even though ${thirdRightWingOptions[1].name} has the slightly higher reference FPPG.

I modeled every two-team combination as if both players compete for one active slot:

- Best pairing: **${bestPair.teamA} + ${bestPair.teamB} — ${bestPair.usableOneSlot} usable dates, ${bestPair.sharedNights} conflicts**
- Most congested: **${worstPair.teamA} + ${worstPair.teamB} — ${worstPair.usableOneSlot} usable dates, ${worstPair.sharedNights} conflicts**
- Difference: **${pairingSpread} possible starts**, before changing talent or projections

The playoff result is even more date-sensitive. SJS has ${scenarioTeam(configuredScenario, 'SJS').games} games and ${scenarioTeam(configuredScenario, 'SJS').offNights} off-nights in the configured Mar 22–Apr 10 window, but only ${scenarioTeam(finalScenario, 'SJS').games} games and ${scenarioTeam(finalScenario, 'SJS').offNights} off-nights from Apr 5–10.

So my takeaway is not “draft every player from the top schedule team.” It is:

1. Start with talent, role, and your scoring.
2. Use schedule fit inside a tier.
3. Compare players against the roster slots they would actually occupy.
4. Enter your real fantasy playoff dates.

What is your league's championship window—and which player pairing should I run next?

Owner review before posting. Full draft and interactive links to be added after approval. Schedule refreshed ${data.sources.scheduleLastRefreshed}.
`;
await fs.writeFile(path.join(socialRoot, 'off-night-bible-reddit.md'), reddit);
await fs.writeFile(path.join(assetsRoot, 'off-night-bible-84-game-illusion.svg'), insightSvg(
  'THE 84-GAME ILLUSION',
  `${pairingSpread} usable dates between the extremes`,
  'Two players · one shared active slot · full season',
  { label: 'CLEANEST PAIR', value: bestPair.usableOneSlot, title: `${bestPair.teamA} + ${bestPair.teamB}`, detail: `${bestPair.sharedNights} shared-night conflicts` },
  { label: 'MOST CONGESTED', value: worstPair.usableOneSlot, title: `${worstPair.teamA} + ${worstPair.teamB}`, detail: `${worstPair.sharedNights} shared-night conflicts`, color: '#ff7d8b' },
  'Same 84-game season. Very different fantasy opportunity.',
));
await fs.writeFile(path.join(assetsRoot, 'off-night-bible-playoff-flip.svg'), insightSvg(
  'PLAYOFF WINDOW FLIP',
  'San Jose is only elite in the right window',
  'Changing the cutoff changes the recommendation',
  { label: 'MAR 22 – APR 10', value: `${scenarioTeam(configuredScenario, 'SJS').offNights} OFF`, title: `${scenarioTeam(configuredScenario, 'SJS').games} SJS games`, detail: 'Top configured-window off-night total' },
  { label: 'APR 5 – APR 10', value: `${scenarioTeam(finalScenario, 'SJS').offNights} OFF`, title: `${scenarioTeam(finalScenario, 'SJS').games} SJS games`, detail: 'Final NHL week only', color: '#ff7d8b' },
  'There is no “best playoff schedule” without exact dates.',
));
await fs.writeFile(path.join(assetsRoot, 'off-night-bible-third-rw.svg'), insightSvg(
  'THE THIRD-RW DECISION',
  'Two premium RWs change the third-RW decision',
  'Kucherov + Pastrnak already occupy two active RW slots',
  { label: thirdRightWingOptions[0].name.toUpperCase(), value: thirdRightWingOptions[0].usableStarts, title: 'usable starts', detail: `${thirdRightWingOptions[0].referenceFppg.toFixed(2)} reference FPPG` },
  { label: thirdRightWingOptions[1].name.toUpperCase(), value: thirdRightWingOptions[1].usableStarts, title: 'usable starts', detail: `${thirdRightWingOptions[1].referenceFppg.toFixed(2)} reference FPPG`, color: '#ff7d8b' },
  `${thirdRightWingSwing} starts can outweigh a small per-game scoring edge.`,
));
await Promise.all([
  'off-night-bible-84-game-illusion.svg',
  'off-night-bible-playoff-flip.svg',
  'off-night-bible-third-rw.svg',
].map((filename) => fs.copyFile(path.join(assetsRoot, filename), path.join(publicAssetsRoot, filename))));
console.log(`Generated machine Bible, Reddit draft, and 3 launch graphics: ${generatedOut}`);
console.log(`${editorialAction} editorial Bible: ${editorialOut}`);
