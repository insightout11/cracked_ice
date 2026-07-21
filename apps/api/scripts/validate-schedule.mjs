#!/usr/bin/env node
// Data sanity gate for the NHL schedule (codifies DATA_WARNING.md).
//
// Fake/segregated schedule data is catastrophic for every downstream calc, so
// this runs in the hydrate pipeline (from hydrate.mjs) and exits non-zero on any
// implausible pattern — which fails the GitHub Action and blocks a bad commit.
//
// Checks:
//   1. Every team has a plausible game count (gamesPerTeam-6 .. gamesPerTeam).
//   2. Pairwise shared game-nights for random team pairs are > 0 and < 60.
//   3. Off-night share varies across teams (no team at exactly 0% or 100%; not
//      all identical) — the signature of the segregated fake data.
//   4. Every date falls within regularSeasonStart..regularSeasonEnd.
//
// Usage: node apps/api/scripts/validate-schedule.mjs [path/to/schedules.json]

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

const OFF_NIGHTS = new Set(['Mon', 'Wed', 'Fri', 'Sun']);
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayOf(dateStr) {
  return WD[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
}

function loadSeason() {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'season.json'), 'utf8'));
}

function resolveSchedulePath(season, explicit) {
  if (explicit) return explicit;
  const candidates = [
    join(REPO_ROOT, 'data', season.scheduleFile),
    join(REPO_ROOT, 'server', 'data', season.scheduleFile),
    join(REPO_ROOT, 'web', 'public', season.scheduleFile),
  ];
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(`schedule file ${season.scheduleFile} not found in data/, server/data/, or web/public/`);
  }
  return found;
}

function validate(schedule, season) {
  const errors = [];
  const teams = schedule.teams || {};
  const teamCodes = Object.keys(teams);

  if (teamCodes.length !== 32) {
    errors.push(`expected 32 teams, found ${teamCodes.length}`);
  }

  // 1. Game counts
  const minGames = season.gamesPerTeam - 6;
  const maxGames = season.gamesPerTeam;
  for (const [team, dates] of Object.entries(teams)) {
    if (dates.length < minGames || dates.length > maxGames) {
      errors.push(`${team} has ${dates.length} games (expected ${minGames}-${maxGames})`);
    }
    const unique = new Set(dates);
    if (unique.size !== dates.length) {
      errors.push(`${team} has duplicate game dates`);
    }
  }

  // 4. Dates within season bounds
  for (const [team, dates] of Object.entries(teams)) {
    for (const d of dates) {
      if (d < season.regularSeasonStart || d > season.regularSeasonEnd) {
        errors.push(`${team} has date ${d} outside ${season.regularSeasonStart}..${season.regularSeasonEnd}`);
        break;
      }
    }
  }

  // 2. Pairwise shared game-nights for 20 random pairs
  if (teamCodes.length >= 2) {
    for (let i = 0; i < 20; i++) {
      const a = teamCodes[Math.floor(Math.random() * teamCodes.length)];
      const b = teamCodes[Math.floor(Math.random() * teamCodes.length)];
      if (a === b) continue;
      const setB = new Set(teams[b]);
      const shared = teams[a].filter((d) => setB.has(d)).length;
      if (shared <= 0 || shared >= 60) {
        errors.push(`pair ${a}/${b} shares ${shared} game-nights (expected 0 < x < 60)`);
      }
    }
  }

  // 5. Game metadata must be present, complete, reciprocal, and the off-night
  //    flags must independently match the <=8-games-per-date rule. The frontend
  //    reads opponent/start-time/isOffNight straight from this file, so a
  //    date-only, unflagged, or mis-flagged schedule silently breaks the app.
  const OFF_NIGHT_GAME_THRESHOLD = 8;
  const games = schedule.games || {};
  if (Object.keys(games).length !== teamCodes.length) {
    errors.push(`games metadata missing: ${Object.keys(games).length} teams have games, ${teamCodes.length} have dates`);
  }

  // Required fields + game count matches dates, and index games by id for the
  // reciprocity and off-night checks.
  const gamesById = new Map(); // gameId -> [{team, opponent, date, isHome, isOffNight}]
  const gamesPerDate = new Map(); // date -> Set(gameId)
  for (const [team, dates] of Object.entries(teams)) {
    const entries = games[team];
    if (!entries) {
      errors.push(`${team} has no games metadata`);
      continue;
    }
    // The teams[] date list (used by the APIs) and games[] dates (used by the
    // frontend) must be the SAME set, or the two surfaces disagree silently.
    const dateSet = new Set(dates);
    const gameDateSet = new Set(entries.map((g) => g.date));
    if (dateSet.size !== gameDateSet.size || [...dateSet].some((d) => !gameDateSet.has(d))) {
      const onlyDates = [...dateSet].filter((d) => !gameDateSet.has(d));
      const onlyGames = [...gameDateSet].filter((d) => !dateSet.has(d));
      errors.push(
        `${team} date sets differ: ${onlyDates.length} only in teams[] (e.g. ${onlyDates[0] ?? '-'}), ` +
        `${onlyGames.length} only in games[] (e.g. ${onlyGames[0] ?? '-'})`
      );
    }
    for (const g of entries) {
      if (!g.opponent) errors.push(`${team} game on ${g.date} missing opponent`);
      if (g.gameId === undefined || g.gameId === null) errors.push(`${team} game on ${g.date} missing gameId`);
      if (!g.startTime) errors.push(`${team} game on ${g.date} missing startTime`);
      if (typeof g.isOffNight !== 'boolean') errors.push(`${team} game on ${g.date} missing isOffNight flag`);
      if (typeof g.isHome !== 'boolean') errors.push(`${team} game on ${g.date} missing isHome flag`);
      if (g.date < season.regularSeasonStart || g.date > season.regularSeasonEnd) {
        errors.push(`${team} game ${g.date} outside season bounds ${season.regularSeasonStart}..${season.regularSeasonEnd}`);
      }
      if (g.gameId != null) {
        if (!gamesById.has(g.gameId)) gamesById.set(g.gameId, []);
        gamesById.get(g.gameId).push({ team, opponent: g.opponent, date: g.date, isHome: g.isHome, isOffNight: g.isOffNight });
        (gamesPerDate.get(g.date) || gamesPerDate.set(g.date, new Set()).get(g.date)).add(g.gameId);
      }
    }
    if (errors.length > 40) break;
  }

  // Reciprocity: each game id must appear for exactly two teams, mutually
  // referencing each other, on the same date, with opposite home/away.
  for (const [gameId, sides] of gamesById) {
    if (sides.length !== 2) {
      errors.push(`gameId ${gameId} appears ${sides.length} time(s), expected 2 (reciprocal)`);
      continue;
    }
    const [a, b] = sides;
    if (a.opponent !== b.team || b.opponent !== a.team) {
      errors.push(`gameId ${gameId} not reciprocal: ${a.team} vs ${a.opponent} / ${b.team} vs ${b.opponent}`);
    }
    if (a.date !== b.date) errors.push(`gameId ${gameId} date mismatch: ${a.date} vs ${b.date}`);
    if (a.isHome === b.isHome) errors.push(`gameId ${gameId} both sides isHome=${a.isHome}`);
    if (errors.length > 40) break;
  }

  // Independently recompute off-nights and compare EVERY flag to the rule.
  const offNightDates = new Set(
    [...gamesPerDate.entries()].filter(([, ids]) => ids.size <= OFF_NIGHT_GAME_THRESHOLD).map(([d]) => d)
  );
  let flagMismatches = 0;
  for (const sides of gamesById.values()) {
    for (const s of sides) {
      const expected = offNightDates.has(s.date);
      if (s.isOffNight !== expected) {
        flagMismatches++;
        if (flagMismatches <= 5) {
          errors.push(`${s.team} ${s.date}: isOffNight=${s.isOffNight} but ${gamesPerDate.get(s.date)?.size} games that date (expected ${expected})`);
        }
      }
    }
  }
  if (flagMismatches > 5) errors.push(`...and ${flagMismatches - 5} more off-night flag mismatches`);

  // 3. Off-night share varies across teams
  const offShares = [];
  for (const dates of Object.values(teams)) {
    if (!dates.length) continue;
    const off = dates.filter((d) => OFF_NIGHTS.has(weekdayOf(d))).length;
    offShares.push(off / dates.length);
  }
  const distinctShares = new Set(offShares.map((v) => v.toFixed(4)));
  if (distinctShares.size <= 1) {
    errors.push('off-night share is identical across all teams (segregated/fake data signature)');
  }
  for (const share of offShares) {
    if (share === 0 || share === 1) {
      errors.push(`a team has an off-night share of exactly ${share} (implausible)`);
      break;
    }
  }

  return errors;
}

function main() {
  const season = loadSeason();
  const schedulePath = resolveSchedulePath(season, process.argv[2]);
  const schedule = JSON.parse(readFileSync(schedulePath, 'utf8'));

  console.log(`[validate-schedule] season ${season.seasonId}, file ${schedulePath}`);

  if (schedule.season && schedule.season !== season.seasonId) {
    console.error(`[validate-schedule] FAIL: schedule season ${schedule.season} != config ${season.seasonId}`);
    process.exit(1);
  }

  const errors = validate(schedule, season);
  if (errors.length) {
    console.error(`[validate-schedule] FAIL (${errors.length} problem(s)):`);
    for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
    process.exit(1);
  }

  const teamCount = Object.keys(schedule.teams).length;
  console.log(`[validate-schedule] OK — ${teamCount} teams, all checks passed`);
}

main();
