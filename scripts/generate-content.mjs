import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const season = await readJson('config/season.json');
const schedule = await readJson(`data/${season.scheduleFile}`);
const playerData = await readJson('data/players.json');
const statsData = await readJson('data/stats.json');
const presets = await readJson('config/scoring-presets.json');
const teams = Object.keys(schedule.teams).sort();
const OFF_NIGHT_MAX_GAMES = 8;
const replaceEditorial = process.argv.includes('--replace-editorial');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isoDate(date) { return date.toISOString().slice(0, 10); }
function addDays(date, days) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return isoDate(value); }
function mondayOf(date) { const value = new Date(`${date}T12:00:00Z`); const day = value.getUTCDay(); value.setUTCDate(value.getUTCDate() - ((day + 6) % 7)); return isoDate(value); }
function inRange(date, start, end) { return date >= start && date <= end; }
function pct(value, total) { return total ? Math.round((value / total) * 1000) / 10 : 0; }

function validateInputs() {
  const scheduleRefreshed = Date.parse(schedule.lastRefreshed);
  const statsGenerated = Date.parse(statsData.generatedAt);
  if (!Number.isFinite(scheduleRefreshed)) throw new Error('Schedule is missing a valid lastRefreshed timestamp');
  if (!Number.isFinite(statsGenerated)) throw new Error('Stats are missing a valid generatedAt timestamp');
  if (String(schedule.season) !== season.seasonId) throw new Error(`Schedule season ${schedule.season} does not match ${season.seasonId}`);
  if (teams.length !== 32) throw new Error(`Expected 32 teams, found ${teams.length}`);
  const playerIds = new Set();
  for (const player of playerData.players) {
    if (!player.id || playerIds.has(player.id)) throw new Error(`Missing or duplicate player id: ${player.id || player.name}`);
    playerIds.add(player.id);
    if (player.team && !teams.includes(player.team)) throw new Error(`${player.name} has unknown team ${player.team}`);
  }
  for (const team of teams) {
    if (schedule.teams[team].length !== season.gamesPerTeam) throw new Error(`${team} has ${schedule.teams[team].length} games, expected ${season.gamesPerTeam}`);
    if (schedule.teams[team].some((date) => !inRange(date, season.regularSeasonStart, season.regularSeasonEnd))) throw new Error(`${team} has a date outside the configured season`);
    if (schedule.games?.[team]) {
      const gameDates = schedule.games[team].map((game) => game.date);
      if (JSON.stringify(gameDates) !== JSON.stringify(schedule.teams[team])) throw new Error(`${team} schedule date indexes disagree`);
    }
  }
  return {
    scheduleTeams: teams.length,
    gamesPerTeam: season.gamesPerTeam,
    uniquePlayers: playerIds.size,
    scheduleIndexesAgree: true,
    playerTeamsRecognized: true,
  };
}

const appearancesByDate = {};
for (const dates of Object.values(schedule.teams)) for (const date of dates) appearancesByDate[date] = (appearancesByDate[date] || 0) + 1;
const leagueGamesByDate = Object.fromEntries(Object.entries(appearancesByDate).map(([date, appearances]) => [date, appearances / 2]));
const isOffNight = (date) => leagueGamesByDate[date] <= OFF_NIGHT_MAX_GAMES;

function backToBacks(dates) {
  const set = new Set(dates);
  return dates.filter((date) => set.has(addDays(date, -1))).length;
}

function teamMetrics(team, start = season.regularSeasonStart, end = season.regularSeasonEnd) {
  const dates = schedule.teams[team].filter((date) => inRange(date, start, end));
  const offNights = dates.filter(isOffNight).length;
  return { team, games: dates.length, offNights, busyNights: dates.length - offNights, offNightRate: pct(offNights, dates.length), backToBacks: backToBacks(dates) };
}

function pairMetrics(teamA, teamB, start = season.regularSeasonStart, end = season.regularSeasonEnd) {
  const a = schedule.teams[teamA].filter((date) => inRange(date, start, end));
  const b = schedule.teams[teamB].filter((date) => inRange(date, start, end));
  const setA = new Set(a); const setB = new Set(b);
  const sharedNights = a.filter((date) => setB.has(date)).length;
  const distinctDates = new Set([...a, ...b]);
  const offNightDates = [...distinctDates].filter(isOffNight).length;
  return { teamA, teamB, sharedNights, usableOneSlot: distinctDates.size, offNightDates, complementRate: pct(distinctDates.size, a.length + b.length) };
}

function skaterFppg(player) {
  const stats = statsData.players[player.id]?.skaterStats;
  if (!stats?.gamesPlayed) return null;
  const weights = presets.default.skater;
  const total = (stats.goals || 0) * (weights.goals || 0)
    + (stats.assists || 0) * (weights.assists || 0)
    + (stats.shots || 0) * (weights.shots_on_goal || 0)
    + (stats.blocks || 0) * (weights.blocks || 0)
    + (stats.ppPoints || 0) * (weights.power_play_points || 0)
    + (stats.shGoals || 0) * (weights.shorthanded_goals || 0)
    + (stats.shAssists || 0) * (weights.shorthanded_assists || 0)
    + (stats.hits || 0) * (weights.hits || 0)
    + (stats.plusMinus || 0) * (weights.plus_minus || 0)
    + (stats.gameWinningGoals || 0) * (weights.game_winning_goals || 0);
  return Math.round((total / stats.gamesPlayed) * 100) / 100;
}

function pickWeeklyStart() {
  const requested = arg('start');
  if (requested) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) throw new Error('--start must be YYYY-MM-DD');
    return mondayOf(requested);
  }
  const today = isoDate(new Date());
  const candidate = today < season.regularSeasonStart ? season.regularSeasonStart : today;
  let week = mondayOf(candidate);
  while (week <= season.regularSeasonEnd) {
    const end = addDays(week, 6);
    if (Object.keys(leagueGamesByDate).some((date) => inRange(date, week, end))) return week;
    week = addDays(week, 7);
  }
  throw new Error('No remaining schedule week contains games');
}

function table(headers, rows) {
  return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}`;
}

function svgCard(title, subtitle, rows, accent = '#58dcf5') {
  const rowHeight = 58; const height = 250 + rows.length * rowHeight;
  const body = rows.map((row, index) => {
    const y = 185 + index * rowHeight;
    return `<g transform="translate(64 ${y})"><rect width="1072" height="46" rx="12" fill="#102638" stroke="#28506a"/><text x="20" y="29" fill="#f1f8ff" font-size="20" font-weight="700">${row[0]}</text><text x="1048" y="29" text-anchor="end" fill="${accent}" font-size="20" font-weight="700">${row[1]}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}"><rect width="1200" height="${height}" fill="#071522"/><circle cx="1090" cy="40" r="250" fill="#123347" opacity=".72"/><path d="M0 125H1200" stroke="#24465c"/><text x="64" y="62" fill="${accent}" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="3">CRACKED ICE · SCHEDULE MATH</text><text x="64" y="112" fill="#f1f8ff" font-family="Arial,sans-serif" font-size="38" font-weight="800">${title}</text><text x="64" y="145" fill="#9cb6c7" font-family="Arial,sans-serif" font-size="18">${subtitle}</text><g font-family="Arial,sans-serif">${body}</g><text x="64" y="${height - 34}" fill="#9cb6c7" font-family="Arial,sans-serif" font-size="16">Verify player availability in your league · crackedicehockey.com</text></svg>`;
}

const inputValidation = validateInputs();
const fullRankings = teams.map((team) => teamMetrics(team)).sort((a, b) => b.offNights - a.offNights || b.games - a.games || a.team.localeCompare(b.team));
const playoffRankings = teams.map((team) => teamMetrics(team, season.defaultFantasyPlayoffsStart, season.defaultFantasyPlayoffsEnd)).sort((a, b) => b.offNights - a.offNights || b.games - a.games || a.team.localeCompare(b.team));
const pairs = [];
for (let a = 0; a < teams.length; a += 1) for (let b = a + 1; b < teams.length; b += 1) pairs.push(pairMetrics(teams[a], teams[b]));
pairs.sort((a, b) => b.usableOneSlot - a.usableOneSlot || a.sharedNights - b.sharedNights || b.offNightDates - a.offNightDates);
const anchorComplements = Object.fromEntries(teams.map((team) => {
  const options = pairs
    .filter((pair) => pair.teamA === team || pair.teamB === team)
    .map((pair) => ({
      partner: pair.teamA === team ? pair.teamB : pair.teamA,
      sharedNights: pair.sharedNights,
      usableOneSlot: pair.usableOneSlot,
      offNightDates: pair.offNightDates,
      complementRate: pair.complementRate,
    }))
    .sort((a, b) => b.usableOneSlot - a.usableOneSlot || a.sharedNights - b.sharedNights);
  return [team, { best: options.slice(0, 3), worst: options.slice(-3).reverse() }];
}));
const playoffScenarios = [
  { id: 'early-three-week', label: 'Early three-week playoffs', start: '2027-03-15', end: '2027-04-04' },
  { id: 'configured', label: 'Configured site default', start: season.defaultFantasyPlayoffsStart, end: season.defaultFantasyPlayoffsEnd },
  { id: 'championship-week', label: 'Final NHL week only', start: '2027-04-05', end: season.regularSeasonEnd },
].map((scenario) => ({ ...scenario, teams: teams.map((team) => teamMetrics(team, scenario.start, scenario.end)).sort((a, b) => b.offNights - a.offNights || b.games - a.games || a.team.localeCompare(b.team)) }));

const weekStart = pickWeeklyStart(); const weekEnd = addDays(weekStart, 6);
const weeklyTeams = teams.map((team) => teamMetrics(team, weekStart, weekEnd)).sort((a, b) => b.games - a.games || b.offNights - a.offNights || a.team.localeCompare(b.team));
const weeklyTeamLookup = new Map(weeklyTeams.map((team) => [team.team, team]));
const notableSkaters = playerData.players
  .filter((player) => player.team && !player.pos.includes('G') && statsData.players[player.id]?.isActive !== false)
  .map((player) => ({ id: player.id, name: player.name, team: player.team, positions: player.pos, gamesPlayed: statsData.players[player.id]?.skaterStats?.gamesPlayed || 0, referenceFppg: skaterFppg(player), weeklyGames: weeklyTeamLookup.get(player.team)?.games || 0, weeklyOffNights: weeklyTeamLookup.get(player.team)?.offNights || 0 }))
  .filter((player) => player.gamesPlayed >= 20 && player.referenceFppg !== null && player.weeklyGames >= 3)
  .sort((a, b) => b.weeklyGames - a.weeklyGames || b.weeklyOffNights - a.weeklyOffNights || b.referenceFppg - a.referenceFppg)
  .slice(0, 24);

const inputHash = crypto.createHash('sha256').update(JSON.stringify({
  season,
  schedule,
  players: playerData.players.map(({ id, name, team, pos }) => ({ id, name, team, pos })),
  stats: statsData,
  scoringPreset: presets.default,
  weekStart,
  offNightThreshold: OFF_NIGHT_MAX_GAMES,
})).digest('hex');
const analysis = {
  schemaVersion: 1,
  status: 'draft',
  generatedAt: new Date().toISOString(),
  season,
  methodology: {
    offNightDefinition: `A date with ${OFF_NIGHT_MAX_GAMES} or fewer NHL games`,
    pairingDefinition: 'For one active slot, usable dates are the union of both team schedules; conflicts are shared dates.',
    playerScoringReference: `${presets.default.label}; editorial reference only. On-site tools use each user's saved league settings.`,
    availabilityRule: 'No player is described as available without league-specific provenance.',
  },
  sources: {
    scheduleFile: season.scheduleFile,
    scheduleLastRefreshed: schedule.lastRefreshed,
    statsGeneratedAt: statsData.generatedAt,
    playersGeneratedAt: playerData.meta?.generatedAt || null,
    inputHash,
    validation: inputValidation,
  },
  fullSeason: { teams: fullRankings, topPairs: pairs.slice(0, 20), worstPairs: [...pairs].sort((a, b) => b.sharedNights - a.sharedNights || a.usableOneSlot - b.usableOneSlot).slice(0, 10), anchorComplements },
  playoffs: { start: season.defaultFantasyPlayoffsStart, end: season.defaultFantasyPlayoffsEnd, teams: playoffRankings, scenarios: playoffScenarios },
  week: { start: weekStart, end: weekEnd, teams: weeklyTeams, notableSkaters },
};

const outputRoot = path.join(root, 'content', 'generated', season.label);
const generatedDraftsRoot = path.join(outputRoot, 'drafts');
const socialRoot = path.join(root, 'content', 'social', season.label);
const assetsRoot = path.join(socialRoot, 'assets');
await Promise.all([fs.mkdir(generatedDraftsRoot, { recursive: true }), fs.mkdir(assetsRoot, { recursive: true }), fs.mkdir(path.join(root, 'content', 'drafts'), { recursive: true })]);
await fs.writeFile(path.join(outputRoot, 'schedule-analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);

const weekSlug = `week-${weekStart}`;
const weeklyMarkdown = `---
slug: ${season.label}-fantasy-hockey-schedule-${weekStart}
title: "Fantasy Hockey Schedule Guide: ${weekStart} to ${weekEnd}"
excerpt: "The teams with the most games, off-nights, useful pairings, and back-to-backs this week."
publishDate: ${weekStart}
status: draft
author: Cracked Ice Analytics
tags: [weekly-schedule, off-nights, streaming, ${season.label}]
---

# Fantasy hockey schedule guide: ${weekStart} to ${weekEnd}

This week has **${Object.entries(leagueGamesByDate).filter(([date]) => inRange(date, weekStart, weekEnd)).reduce((sum, [, games]) => sum + games, 0)} NHL games**. Cracked Ice defines an off-night as a date with ${OFF_NIGHT_MAX_GAMES} or fewer NHL games.

## Teams with the best weekly volume

${table(['Team', 'Games', 'Off-nights', 'Back-to-backs'], weeklyTeams.slice(0, 12).map((row) => [row.team, row.games, row.offNights, row.backToBacks]))}

## High-production players to check in your league

These are **not availability claims**. They are current-team players worth checking against your own free-agent pool. FPPG uses the “${presets.default.label}” preset as an editorial reference; your Cracked Ice workspace recalculates with your league settings.

${table(['Player', 'Team', 'Week', 'Off-nights', 'Reference FPPG'], notableSkaters.slice(0, 12).map((row) => [row.name, row.team, row.weeklyGames, row.weeklyOffNights, row.referenceFppg.toFixed(2)]))}

## Best schedule pairings

Pairing values below describe team schedules, not player availability. “Usable dates” assumes one shared active slot across the full season.

${table(['Teams', 'Usable dates', 'Conflicts', 'Off-night dates'], pairs.slice(0, 10).map((row) => [`${row.teamA} + ${row.teamB}`, row.usableOneSlot, row.sharedNights, row.offNightDates]))}

## Back-to-back watch

${table(['Team', 'Weekly back-to-backs', 'Games'], weeklyTeams.filter((row) => row.backToBacks > 0).slice(0, 10).map((row) => [row.team, row.backToBacks, row.games]))}

## Use your own roster and scoring

Generic schedule edges become useful decisions only after accounting for your lineup, positions, scoring, and playoff dates. [Open My Team](/team) or [compare two players](/compare).

> Owner review: confirm news, injuries, projected roles, and availability language before publication. Schedule source refreshed ${schedule.lastRefreshed}.
`;
const generatedWeeklyPath = path.join(generatedDraftsRoot, `${weekSlug}.generated.md`);
const editorialWeeklyPath = path.join(root, 'content', 'drafts', `${weekSlug}.md`);
await fs.writeFile(generatedWeeklyPath, weeklyMarkdown);
try {
  await fs.access(editorialWeeklyPath);
  if (replaceEditorial) await fs.writeFile(editorialWeeklyPath, weeklyMarkdown);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await fs.writeFile(editorialWeeklyPath, weeklyMarkdown);
}

const reddit = `# DRAFT — Fantasy hockey schedule edge: ${weekStart} to ${weekEnd}

I ran the ${season.label} schedule through a simple test: which teams give you the most games and the most games on nights with ${OFF_NIGHT_MAX_GAMES} or fewer NHL games?

${table(['Team', 'GP', 'Off-night GP', 'B2B'], weeklyTeams.slice(0, 10).map((row) => [row.team, row.games, row.offNights, row.backToBacks]))}

The useful caveat: volume is not the same as lineup value. Your roster positions, scoring, and already-full nights decide which games actually count. Any player examples should be checked against your league's current free-agent pool.

What schedule decision are you debating this week?

Owner review before posting. Data refreshed ${schedule.lastRefreshed}. Suggested link: https://www.crackedicehockey.com/season
`;
await fs.writeFile(path.join(socialRoot, `${weekSlug}-reddit.md`), reddit);
await fs.writeFile(path.join(assetsRoot, `${weekSlug}-schedule-edge.svg`), svgCard(`Schedule edge · ${weekStart}`, 'Games and off-night opportunities this week', weeklyTeams.slice(0, 7).map((row) => [row.team, `${row.games} GP · ${row.offNights} off-night`])));
await fs.writeFile(path.join(assetsRoot, `${weekSlug}-pairings.svg`), svgCard('Best schedule complements', 'One active slot · full 2026–27 season', pairs.slice(0, 7).map((row) => [`${row.teamA} + ${row.teamB}`, `${row.usableOneSlot} dates · ${row.sharedNights} conflicts`]), '#75f0ad'));

console.log(`Generated canonical analysis, machine weekly draft, Reddit draft, and 2 SVG graphics for ${weekStart} to ${weekEnd}.`);
console.log(`${replaceEditorial ? 'Replaced' : 'Preserved'} editorial weekly draft: ${editorialWeeklyPath}`);
