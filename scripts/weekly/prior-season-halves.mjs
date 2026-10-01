/**
 * Last season's halves for the Weekly Edge's "finished hot" notes: points per game before and
 * after New Year's for every skater with 20+ games last season. Once the new season starts the
 * stats cache's game logs are this season's, so last season's split is fetched once from the NHL
 * (it never changes) and kept in data/prior-season-halves.json.
 *
 *   node scripts/weekly/prior-season-halves.mjs           (skips if the file is already complete)
 *   node scripts/weekly/prior-season-halves.mjs --force
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'data', 'prior-season-halves.json');
const statsPayload = JSON.parse(fs.readFileSync(path.join(root, 'data', 'stats.json'), 'utf8'));
const stats = statsPayload.players ?? statsPayload;

const candidates = Object.entries(stats)
  .filter(([, record]) => record?.priorSeason && (record.priorSkaterStats?.gamesPlayed ?? 0) >= 20)
  .map(([id, record]) => ({ id: id.replace(/^nhl:/, ''), season: record.priorSeason }));
if (!candidates.length) throw new Error('No players with a prior season in data/stats.json');
const season = candidates[0].season;

const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
if (existing?.season === season && !process.argv.includes('--force') && Object.keys(existing.players).length >= candidates.length * 0.95) {
  console.log(`data/prior-season-halves.json already has ${season} for ${Object.keys(existing.players).length} players.`);
  process.exit(0);
}

const newYear = `${season.slice(4)}-01-01`;
const perGame = (games) => (games.length ? Math.round((games.reduce((sum, game) => sum + (game.points ?? 0), 0) / games.length) * 100) / 100 : null);
const players = {};
let failed = 0;
for (const [index, { id }] of candidates.entries()) {
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/player/${id}/game-log/${season}/2`, { headers: { 'User-Agent': 'cracked-ice-weekly/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const log = (await response.json()).gameLog ?? [];
    const first = log.filter((game) => game.gameDate < newYear);
    const second = log.filter((game) => game.gameDate >= newYear);
    players[id] = {
      first: { games: first.length, pointsPerGame: perGame(first) },
      second: { games: second.length, pointsPerGame: perGame(second) },
    };
  } catch (error) {
    failed += 1;
    console.warn(`  ${id}: ${error.message}`);
  }
  if (index % 100 === 99) console.log(`  ${index + 1}/${candidates.length}`);
  await new Promise((resolve) => setTimeout(resolve, 120));
}
if (failed > candidates.length * 0.05) throw new Error(`${failed} of ${candidates.length} game logs failed; not writing a partial file.`);
fs.writeFileSync(out, `${JSON.stringify({ season, newYear, generatedAt: new Date().toISOString(), players }, null, 1)}\n`);
console.log(`Wrote ${Object.keys(players).length} players' ${season} halves to data/prior-season-halves.json (${failed} failed).`);
