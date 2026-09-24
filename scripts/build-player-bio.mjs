/**
 * Public player bio file for the Roster Card (web/public/player-bio.json).
 *
 * Everything the card needs to match a pasted roster and find what is unusual about
 * it, with no sign-in or API call: name, team, positions, jersey number, shooting hand,
 * height, weight, birth date and place, Yahoo average draft pick, NHL draft slot,
 * awards (Stanley Cups, Harts...), career totals, last season's line, NHL debut season
 * and how many NHL teams a player has played for.
 *
 * Base fields come from data/players.json and data/yahoo-player-eligibility.json. The
 * rest comes from each player's NHL.com landing page, cached in
 * data/player-landing.json: missing players are fetched, plus the stalest few hundred
 * each night, so a full refresh cycles through within about a week.
 *
 * Usage: node scripts/build-player-bio.mjs [--refresh=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = path.join(repoRoot, 'data', 'players.json');
const YAHOO_PATH = path.join(repoRoot, 'data', 'yahoo-player-eligibility.json');
const LANDING_PATH = path.join(repoRoot, 'data', 'player-landing.json');
const OUTPUT_PATH = path.join(repoRoot, 'web', 'public', 'player-bio.json');
const CONCURRENCY = 2;
const DEFAULT_REFRESH = 250;

/** NHL.com trophy names to short keys; others are left out. */
const AWARDS = {
  'Stanley Cup': 'cup',
  'Hart Memorial Trophy': 'hart',
  'Vezina Trophy': 'vezina',
  'James Norris Memorial Trophy': 'norris',
  'Art Ross Trophy': 'artross',
  'Maurice “Rocket” Richard Trophy': 'rocket',
  'Calder Memorial Trophy': 'calder',
  'Conn Smythe Trophy': 'smythe',
  'Frank J. Selke Trophy': 'selke',
  'Ted Lindsay Award': 'lindsay',
  'William M. Jennings Trophy': 'jennings',
  'Lady Byng Memorial Trophy': 'byng',
};

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/** The last completed regular season, e.g. 20252026 until next summer. */
export function lastCompletedSeason(now = new Date()) {
  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return Number(`${startYear - 1}${startYear}`);
}

/** The parts of an NHL.com landing page the card uses. */
export function extractLanding(landing, lastSeason) {
  const nhl = (landing.seasonTotals ?? []).filter((line) => line.leagueAbbrev === 'NHL' && line.gameTypeId === 2);
  const goalie = landing.position === 'G';
  const last = nhl.filter((line) => line.season === lastSeason);
  const sum = (key) => last.reduce((total, line) => total + (line[key] ?? 0), 0);
  const career = landing.careerTotals?.regularSeason;
  const awards = {};
  for (const award of landing.awards ?? []) {
    const key = AWARDS[award.trophy?.default];
    if (key) awards[key] = award.seasons?.length ?? 1;
  }
  const draft = landing.draftDetails;
  return {
    draft: draft ? [draft.year, draft.round, draft.overallPick] : 0,
    awards,
    career: career ? (goalie ? [career.gamesPlayed ?? 0, career.wins ?? 0, career.shutouts ?? 0] : [career.gamesPlayed ?? 0, career.goals ?? 0, career.points ?? 0, career.pim ?? 0]) : null,
    last: last.length ? (goalie
      ? [sum('gamesPlayed'), sum('wins'), last[last.length - 1].savePctg ?? null, last[last.length - 1].goalsAgainstAvg ?? null]
      : [sum('gamesPlayed'), sum('goals'), sum('points'), sum('pim')]) : null,
    debut: nhl.length ? Math.floor(Math.min(...nhl.map((line) => line.season)) / 10000) : null,
    teams: new Set(nhl.map((line) => line.teamName?.default).filter(Boolean)).size,
    legend: landing.inHHOF ? 'hof' : landing.inTop100AllTime ? 'top100' : null,
    country: landing.birthCountry ?? null,
    city: landing.birthCity?.default ?? null,
  };
}

/** Fetch JSON, waiting out NHL.com's rate limit (429 + Retry-After) a few times. */
async function getJson(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url);
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after')) || 5;
      await new Promise((resolve) => setTimeout(resolve, (wait + 1) * 1000));
      continue;
    }
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }
  throw new Error('rate limited');
}

async function mapLimit(items, limit, run) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await run(item);
    }
  }));
}

export function buildPlayerBio(players, landingById, yahooPlayers, updatedAt) {
  const rows = players.map((player) => {
    const id = String(player.id).replace(/^nhl:/, '');
    const landing = landingById[id] ?? {};
    const adp = yahooPlayers[`nhl:${id}`]?.averagePick;
    const row = {
      id,
      n: player.name,
      t: player.team,
      p: (player.pos ?? []).join('/'),
      no: player.sweaterNumber ?? null,
      sh: player.shoots ?? null,
      ht: player.heightInches ?? null,
      wt: player.weightPounds ?? null,
      bd: player.birthDate ?? null,
      co: landing.country ?? null,
      ci: landing.city ?? null,
      adp: typeof adp === 'number' ? adp : null,
    };
    if (landing.fetchedAt) {
      Object.assign(row, { dr: landing.draft, cr: landing.career, ls: landing.last, db: landing.debut, tm: landing.teams });
      if (Object.keys(landing.awards ?? {}).length) row.aw = landing.awards;
      if (landing.legend) row.lg = landing.legend;
    }
    return row;
  });
  return { version: 2, updatedAt, count: rows.length, players: rows };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const refreshArg = process.argv.find((arg) => arg.startsWith('--refresh='));
  const refresh = refreshArg ? Number(refreshArg.split('=')[1]) : DEFAULT_REFRESH;
  const players = readJson(PLAYERS_PATH, { players: [] }).players;
  const yahoo = readJson(YAHOO_PATH, { players: {} }).players ?? {};
  const cache = readJson(LANDING_PATH, { players: {} });
  const lastSeason = lastCompletedSeason();
  const ids = players.map((player) => String(player.id).replace(/^nhl:/, ''));
  const fresh = (id) => cache.players[id]?.fetchedAt && cache.players[id].season === lastSeason;
  // Missing (or cached before the season rolled over) first, then the stalest.
  const stale = ids.filter(fresh)
    .sort((a, b) => cache.players[a].fetchedAt.localeCompare(cache.players[b].fetchedAt))
    .slice(0, refresh);
  const queue = [...ids.filter((id) => !fresh(id)), ...stale];
  let fetched = 0;
  let failed = 0;
  await mapLimit(queue, CONCURRENCY, async (id) => {
    try {
      const landing = await getJson(`https://api-web.nhle.com/v1/player/${id}/landing`);
      cache.players[id] = { ...extractLanding(landing, lastSeason), season: lastSeason, fetchedAt: new Date().toISOString() };
      fetched += 1;
    } catch {
      failed += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  cache.updatedAt = new Date().toISOString();
  fs.writeFileSync(LANDING_PATH, `${JSON.stringify(cache)}\n`);

  const bio = buildPlayerBio(players, cache.players, yahoo, new Date().toISOString());
  const withLanding = bio.players.filter((row) => row.cr !== undefined).length;
  // A broken NHL response must not wipe the facts: require most players to have them.
  if (withLanding < bio.count * 0.6) throw new Error(`Only ${withLanding}/${bio.count} players have NHL.com details; keeping the previous file.`);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(bio)}\n`);
  console.log(`player-bio: ${bio.count} players, ${withLanding} with NHL.com details (${fetched} fetched, ${failed} failed)`);
}
