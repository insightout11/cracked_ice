#!/usr/bin/env node
// Precompute derived aggregates for downstream pages, so the client doesn't have
// to fetch every week and recompute them (replaces web calculateSeasonAverage):
//
//   - weeklyGameCounts: total league games in each fantasy week (Mon-Sun) plus
//     the season average — consumed by the Season page (WP7).
//   - positionalFppg:  league-average FPPG per eligible position — consumed by
//     the Draft Helper verdict card (WP5). Zero until the season has games.
//
// Output: data/derived.json. Season + schedule come from config/season.json.

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data');

const season = JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'season.json'), 'utf8'));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function toMonday(date) {
  const d = new Date(date.getTime());
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function buildWeeklyGameCounts(schedule) {
  // Count each game once: sum team-games per week / 2.
  const start = toMonday(new Date(season.regularSeasonStart + 'T12:00:00Z'));
  const end = new Date(season.regularSeasonEnd + 'T12:00:00Z');

  const weeks = [];
  for (let ws = new Date(start); ws <= end; ws.setUTCDate(ws.getUTCDate() + 7)) {
    const weekStart = iso(ws);
    const weAt = new Date(ws.getTime());
    weAt.setUTCDate(weAt.getUTCDate() + 6);
    const weekEnd = iso(weAt);

    let teamGames = 0;
    for (const dates of Object.values(schedule.teams)) {
      for (const d of dates) {
        if (d >= weekStart && d <= weekEnd) teamGames++;
      }
    }
    weeks.push({ weekStart, weekEnd, games: teamGames / 2 });
  }

  const played = weeks.filter((w) => w.games > 0);
  const seasonAverageGames = played.length
    ? Math.round((played.reduce((s, w) => s + w.games, 0) / played.length) * 10) / 10
    : 0;

  return { seasonAverageGames, weeks };
}

// Default-preset scoring weights, read from the SAME data-only module the coach
// engine's DEFAULT_PRESET uses (server/src/features/coach/default-scoring.json),
// so the two can't drift. This is a *default-preset* baseline only — real
// per-league FPPG is computed at request time by the coach engine.
const defaultScoring = readJson(
  join(REPO_ROOT, 'server', 'src', 'features', 'coach', 'default-scoring.json')
);
const SKATER_WEIGHTS = defaultScoring.skater;
const GOALIE_WEIGHTS = defaultScoring.goalie;

// Genuine default-preset fantasy points per game (same formula as
// scoring.ts calculateFppgFromSkaterStats / calculateFppgFromGoalieStats).
function skaterFppg(s) {
  if (!s || !(s.gamesPlayed > 0)) return null;
  const total =
    (s.goals || 0) * SKATER_WEIGHTS.goals +
    (s.assists || 0) * SKATER_WEIGHTS.assists +
    (s.shots || 0) * SKATER_WEIGHTS.shots_on_goal +
    (s.blocks || 0) * SKATER_WEIGHTS.blocks +
    (s.ppPoints || 0) * SKATER_WEIGHTS.power_play_points;
  return total / s.gamesPlayed;
}

function goalieFppg(g) {
  if (!g || !(g.gamesPlayed > 0)) return null;
  const saves = g.saves || ((g.shotsAgainst || 0) - (g.goalsAgainst || 0));
  const total =
    (g.wins || 0) * GOALIE_WEIGHTS.wins +
    saves * GOALIE_WEIGHTS.saves +
    (g.shutouts || 0) * GOALIE_WEIGHTS.shutouts;
  return total / g.gamesPlayed;
}

// Preseason fallback: careerHistory only carries goals/assists/points, so this
// is a partial skater estimate (no shots/blocks/PPP) used only before the
// current season has any games.
function careerPartialFppg(hist) {
  const seasons = Object.keys(hist || {}).filter((s) => (hist[s]?.gamesPlayed || 0) > 0).sort();
  if (!seasons.length) return null;
  const last = hist[seasons[seasons.length - 1]];
  return ((last.goals || 0) * SKATER_WEIGHTS.goals + (last.assists || 0) * SKATER_WEIGHTS.assists) / last.gamesPlayed;
}

function buildPositionalFppg(players, stats) {
  const playerList = Array.isArray(players)
    ? players
    : Array.isArray(players.players)
      ? players.players
      : Object.values(players);
  const buckets = {}; // pos -> { sum, count }
  const kinds = { current: 0, partial: 0 };

  for (const p of playerList) {
    const stat = stats.players?.[p.id];
    if (!stat) continue;
    const isGoalie = (p.pos || []).includes('G');

    let value = isGoalie ? goalieFppg(stat.goalieStats) : skaterFppg(stat.skaterStats);
    if (value != null) {
      kinds.current += 1;
    } else {
      value = careerPartialFppg(stat.careerHistory); // preseason fallback (skaters only)
      if (value != null) kinds.partial += 1;
    }
    if (value == null) continue;

    for (const pos of p.pos || []) {
      buckets[pos] = buckets[pos] || { sum: 0, count: 0 };
      buckets[pos].sum += value;
      buckets[pos].count += 1;
    }
  }

  const positions = {};
  for (const [pos, { sum, count }] of Object.entries(buckets)) {
    positions[pos] = { avgFppg: count ? Math.round((sum / count) * 100) / 100 : 0, sampleSize: count };
  }

  // Which season the underlying stats came from (stats.json trails the season id).
  const sourceSeason = (stats.source && stats.source.match(/(\d{8})\b/)?.[1]) || null;
  const basis = kinds.partial > kinds.current ? 'default-preset-fppg-partial' : 'default-preset-fppg';
  return {
    scoringPreset: 'Default',
    sourceSeason,
    basis,
    note: 'Default-preset fantasy points/game baseline. Per-league FPPG must be computed at request time by the coach scoring engine with the user’s weights.',
    positions,
  };
}

function main() {
  const schedule = readJson(join(DATA_DIR, season.scheduleFile));
  const players = readJson(join(DATA_DIR, 'players.json'));

  let positionalFppg = { basis: 'unavailable', positions: {} };
  try {
    const stats = readJson(join(DATA_DIR, 'stats.json'));
    positionalFppg = buildPositionalFppg(players, stats);
  } catch (error) {
    console.warn('[build-derived] stats.json unavailable, positionalFppg left empty:', error.message);
  }

  const derived = {
    seasonId: season.seasonId,
    generatedAt: new Date().toISOString(),
    weeklyGameCounts: buildWeeklyGameCounts(schedule),
    positionalFppg,
  };

  // Write to data/ (read by the serverless API / health) and web/public/ (served
  // to the SPA at /derived.json so the Schedule page can skip client-side math).
  const payload = JSON.stringify(derived, null, 2);
  const outPaths = [join(DATA_DIR, 'derived.json'), join(REPO_ROOT, 'web', 'public', 'derived.json')];
  for (const outPath of outPaths) writeFileSync(outPath, payload);
  console.log(
    `[build-derived] wrote ${outPaths.join(', ')} — ${derived.weeklyGameCounts.weeks.length} weeks, ` +
      `season avg ${derived.weeklyGameCounts.seasonAverageGames} games/wk, ` +
      `positional FPPG basis=${positionalFppg.basis} (${Object.keys(positionalFppg.positions).length} positions)`
  );
}

main();
