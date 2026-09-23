/**
 * Per-season shots on goal, hits and blocked shots for every skater in the
 * canonical directory, for the player card's career chart.
 *
 * Source: NHL.com's stats REST API, one request per season per endpoint
 * (limit=-1 returns every skater; traded players come back as one combined row):
 * - skater/summary  -> gamesPlayed, shots (shots on goal: what fantasy scoring counts)
 * - skater/realtime -> hits, blockedShots
 * Hits and blocks are tracked from 2005-06, so the backfill starts there. Finished
 * seasons never change: a normal run refreshes only the current season (2 requests);
 * --backfill fills every season. Output: data/career-counting.json, served through
 * /api/player-details.
 *
 * Usage: node scripts/fetch-career-counting.mjs [--backfill]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(repoRoot, 'data', 'career-counting.json');
const PLAYERS_PATH = path.join(repoRoot, 'data', 'players.json');
const SEASON_CONFIG_PATH = path.join(repoRoot, 'config', 'season.json');
const API = 'https://api.nhle.com/stats/rest/en/skater';
const FIRST_SEASON = 2005; // 2005-06: first season with hits and blocks

export function seasonIdsFrom(firstStartYear, currentSeasonId) {
  const lastStartYear = Number(String(currentSeasonId).slice(0, 4));
  const ids = [];
  for (let year = firstStartYear; year <= lastStartYear; year++) ids.push(`${year}${year + 1}`);
  return ids;
}

/** Merge one season's summary and realtime rows into [gamesPlayed, shots, hits, blocks] per player. */
export function mergeSeasonRows(summaryRows, realtimeRows, knownPlayerIds) {
  const realtimeById = new Map(realtimeRows.map((row) => [row.playerId, row]));
  const season = {};
  for (const row of summaryRows) {
    const id = `nhl:${row.playerId}`;
    if (!knownPlayerIds.has(id) || !(row.gamesPlayed > 0)) continue;
    const realtime = realtimeById.get(row.playerId);
    if (!realtime) continue;
    season[id] = [row.gamesPlayed, row.shots ?? 0, realtime.hits ?? 0, realtime.blockedShots ?? 0];
  }
  return season;
}

async function fetchSeason(endpoint, seasonId) {
  const url = `${API}/${endpoint}?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=${encodeURIComponent(`seasonId=${seasonId} and gameTypeId=2`)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'CrackedIceHockey/1.0 (+https://crackedicehockey.com)' } });
    if (response.ok) return (await response.json()).data ?? [];
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error(`${endpoint} ${seasonId} failed`);
}

async function main() {
  const backfill = process.argv.includes('--backfill');
  const { seasonId: currentSeasonId } = JSON.parse(fs.readFileSync(SEASON_CONFIG_PATH, 'utf8'));
  const knownPlayerIds = new Set((JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8')).players ?? []).map((player) => player.id));
  const existing = fs.existsSync(OUTPUT_PATH) ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')) : { seasons: {} };

  // Nightly: the configured season plus the one before it (in case it finished after the last backfill).
  const allSeasons = seasonIdsFrom(FIRST_SEASON, currentSeasonId);
  const seasons = backfill ? allSeasons : allSeasons.slice(-2).filter((id) => id === currentSeasonId || !existing.seasons[id]);
  const bySeason = { ...existing.seasons };
  for (const seasonId of seasons) {
    const [summary, realtime] = await Promise.all([fetchSeason('summary', seasonId), fetchSeason('realtime', seasonId)]);
    const merged = mergeSeasonRows(summary, realtime, knownPlayerIds);
    // Before opening night the current season has no rows; keep what we had.
    if (Object.keys(merged).length) bySeason[seasonId] = merged;
    console.log(`career-counting: ${seasonId} ${Object.keys(merged).length} skaters`);
  }

  const output = {
    description: 'Per-season regular-season [gamesPlayed, shotsOnGoal, hits, blockedShots] by canonical player id, from NHL.com stats (skater/summary + skater/realtime).',
    updatedAt: new Date().toISOString(),
    columns: ['gamesPlayed', 'shots', 'hits', 'blocks'],
    seasons: Object.fromEntries(Object.entries(bySeason).sort(([a], [b]) => a.localeCompare(b))),
  };
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`fetch-career-counting failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
