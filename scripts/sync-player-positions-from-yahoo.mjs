/**
 * Apply the current Yahoo skater eligibility snapshot to the canonical player
 * directory. Goalie positions remain sourced from NHL player data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = path.join(repoRoot, 'apps', 'api', 'src', 'data', 'players.json');
const deploymentPath = path.join(repoRoot, 'data', 'players.json');
const eligibilityPath = path.join(repoRoot, 'data', 'yahoo-player-eligibility.json');
const allowedPositions = new Set(['C', 'LW', 'RW', 'D']);

const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const eligibility = JSON.parse(fs.readFileSync(eligibilityPath, 'utf8'));
const yahooPlayers = eligibility.players ?? {};
let updated = 0;
let matchedSkaters = 0;

for (const player of canonical.players ?? []) {
  if (player.pos?.includes('G')) continue;
  const yahoo = yahooPlayers[player.id];
  if (!yahoo) continue;
  const positions = (yahoo.positions ?? []).filter((position) => allowedPositions.has(position));
  if (!positions.length) continue;
  matchedSkaters += 1;
  if (JSON.stringify(player.pos) === JSON.stringify(positions)) continue;
  player.pos = positions;
  updated += 1;
}

const output = `${JSON.stringify(canonical, null, 2)}\n`;
fs.writeFileSync(canonicalPath, output, 'utf8');
fs.writeFileSync(deploymentPath, output, 'utf8');
console.log(`Synced ${updated} skater position records from Yahoo (${matchedSkaters} matched skaters).`);
