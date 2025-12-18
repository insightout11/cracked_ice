/**
 * Update multi-position-players.json from Yahoo position update list
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse the user's position update list
const positionUpdates = {
  "Jamie Benn": ["C", "LW", "RW"],
  "Mitch Marner": ["LW", "RW"],
  "Thomas Novak": ["C", "LW"],
  "Alex Steeves": ["C", "LW"],
  "Gabriel Landeskog": ["LW", "RW"],
  "Kiefer Sherwood": ["LW", "RW"],
  "Alex Tuch": ["LW", "RW"],
  "Berkly Catton": ["C", "LW"],
  "Danila Yurov": ["C", "RW"],
  "Matvei Michkov": ["LW", "RW"],
  "Trevor Zegras": ["C", "LW", "RW"],
  "Arseny Gritsyuk": ["LW", "RW"],
  "Brock Boeser": ["LW", "RW"],
  "Shane Wright": ["C", "RW"],
  "Brayden Schenn": ["C", "LW"],
  "Gavin Brindley": ["C", "RW"],
  "Dylan Guenther": ["LW", "RW"],
  "Ridly Greig": ["C", "LW", "RW"],
  "Dalibor Dvorsky": ["C", "RW"],
  "Andre Burakovsky": ["LW", "RW"],
  "Easton Cowan": ["LW", "RW"],
  "Yakov Trenin": ["C", "LW"],
  "Alex Newhook": ["C", "LW"],
  "Connor McMichael": ["C", "LW"],
  "William Eklund": ["LW", "RW"],
  "Anthony Mantha": ["LW", "RW"],
  "Josh Doan": ["LW", "RW"],
  "Emil Heineman": ["LW", "RW"],
  "Zachary Bolduc": ["LW", "RW"],
  "Matias Maccelli": ["LW", "RW"],
  "Brad Marchand": ["LW", "RW"],
  "Lucas Ellinas": ["C", "LW"],
  "Milan Lucic": ["LW"],
  "Adam Erne": ["LW"]
};

// Load current players.json
const playersPath = join(__dirname, '../apps/api/src/data/players.json');
const playersData = JSON.parse(readFileSync(playersPath, 'utf-8'));

// Load current multi-position-players.json
const multiPosPath = join(__dirname, '../data/multi-position-players.json');
const multiPosData = existsSync(multiPosPath)
  ? JSON.parse(readFileSync(multiPosPath, 'utf-8'))
  : { description: "Multi-position players extracted from Yahoo Fantasy projections", players: {} };

// Map player names to IDs and update multi-position data
let updatedCount = 0;
let notFoundCount = 0;
const notFound = [];

for (const [playerName, positions] of Object.entries(positionUpdates)) {
  // Find player in players.json (case-insensitive)
  const player = playersData.players.find(p =>
    p.name.toLowerCase() === playerName.toLowerCase()
  );

  if (player) {
    // Check if positions actually changed
    const currentPositions = multiPosData.players[player.id]?.positions || player.pos;
    const positionsChanged =
      positions.length !== currentPositions.length ||
      !positions.every(p => currentPositions.includes(p));

    if (positionsChanged) {
      multiPosData.players[player.id] = {
        name: player.name,
        positions: positions
      };
      console.log(`✓ Updated ${player.name} (${player.id}): ${positions.join('/')}`);
      updatedCount++;
    } else {
      console.log(`  Skipped ${player.name} (no change)`);
    }
  } else {
    notFound.push(playerName);
    notFoundCount++;
  }
}

// Update lastUpdated timestamp
multiPosData.lastUpdated = new Date().toISOString().split('T')[0];

// Write updated multi-position-players.json
writeFileSync(multiPosPath, JSON.stringify(multiPosData, null, 2) + '\n', 'utf-8');

console.log(`\n✓ Updated multi-position-players.json`);
console.log(`  ${updatedCount} players updated`);
console.log(`  ${notFoundCount} players not found in players.json`);

if (notFound.length > 0) {
  console.log(`\nPlayers not found (may be new/not yet in NHL rosters):`);
  notFound.forEach(name => console.log(`  - ${name}`));
}
