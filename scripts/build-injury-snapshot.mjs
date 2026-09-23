/**
 * Small public injury snapshot for My Team and player cards.
 *
 * Derived from data/yahoo-player-eligibility.json (refreshed nightly from Yahoo's
 * public feed) so the roster page can show injury badges without loading the full
 * draft directory or calling account-scoped endpoints. Only players with a Yahoo
 * status are included. Output: web/public/injuries.json.
 *
 * Usage: node scripts/build-injury-snapshot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ELIGIBILITY_PATH = path.join(repoRoot, 'data', 'yahoo-player-eligibility.json');
const OUTPUT_PATH = path.join(repoRoot, 'web', 'public', 'injuries.json');

export function buildInjurySnapshot(eligibility) {
  const players = {};
  for (const [id, player] of Object.entries(eligibility.players ?? {})) {
    if (!player.injuryStatus) continue;
    players[id] = {
      status: player.injuryStatus,
      statusFull: player.injuryStatusFull ?? null,
      note: player.injuryNote ?? null,
      updatedAt: player.injuryUpdatedAt ?? null,
    };
  }
  return { source: 'Yahoo Fantasy Hockey', updatedAt: eligibility.updatedAt ?? null, count: Object.keys(players).length, players };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = buildInjurySnapshot(JSON.parse(fs.readFileSync(ELIGIBILITY_PATH, 'utf8')));
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot)}\n`);
  console.log(`injuries: ${snapshot.count} players with a Yahoo status (as of ${snapshot.updatedAt})`);
}
