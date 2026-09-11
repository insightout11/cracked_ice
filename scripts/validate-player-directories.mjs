import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = path.join(repoRoot, 'apps', 'api', 'src', 'data', 'players.json');
const deploymentPath = path.join(repoRoot, 'data', 'players.json');
const yahooEligibilityPath = path.join(repoRoot, 'data', 'yahoo-player-eligibility.json');

function identities(filePath) {
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return (document.players ?? []).map(({ id, name, team, pos, aliases = [] }) => ({ id, name, team, pos, aliases }));
}

const canonical = identities(canonicalPath);
const deployment = identities(deploymentPath);
if (JSON.stringify(canonical) !== JSON.stringify(deployment)) {
  console.error(`Player directory identity mismatch: canonical=${canonical.length}, deployment=${deployment.length}`);
  process.exit(1);
}

const ids = new Set();
for (const player of canonical) {
  if (ids.has(player.id)) {
    console.error(`Duplicate canonical player identity: ${player.id}`);
    process.exit(1);
  }
  ids.add(player.id);
}

if (fs.existsSync(yahooEligibilityPath)) {
  const yahooDocument = JSON.parse(fs.readFileSync(yahooEligibilityPath, 'utf8'));
  const yahooPlayers = yahooDocument.players ?? {};
  const drift = canonical.filter((player) => {
    if (player.pos.includes('G')) return false;
    const yahooPositions = yahooPlayers[player.id]?.positions;
    return Array.isArray(yahooPositions) && yahooPositions.length > 0
      && JSON.stringify(player.pos) !== JSON.stringify(yahooPositions);
  });
  if (drift.length) {
    console.warn(`Warning: ${drift.length} canonical skaters differ from Yahoo eligibility. Run node scripts/sync-player-positions-from-yahoo.mjs.`);
  }
}
console.log(`Player directory identity gate passed for ${canonical.length} players.`);
