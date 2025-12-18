import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUEST_DELAY_MS = 100; // Delay between API calls

function toNumericId(id: string): string {
  return id.replace(/^nhl:/, '');
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function updatePlayerTeams() {
  const playersPath = path.join(__dirname, '../data/players.json');

  console.log('Loading players.json...');
  const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));

  if (!playersData.players || !Array.isArray(playersData.players)) {
    console.error('Invalid players.json structure');
    return;
  }

  let updatedCount = 0;
  const totalPlayers = playersData.players.length;

  console.log(`Checking ${totalPlayers} players for team changes...\n`);

  for (let i = 0; i < playersData.players.length; i++) {
    const player = playersData.players[i];

    if (!player.id?.startsWith('nhl:')) continue;

    const numericId = toNumericId(player.id);

    try {
      const response = await fetch(`https://api-web.nhle.com/v1/player/${numericId}/landing`);

      if (!response.ok) {
        await delay(REQUEST_DELAY_MS);
        continue;
      }

      const data = await response.json() as any;
      const currentTeam = data.currentTeamAbbrev;

      if (currentTeam && currentTeam !== player.team) {
        console.log(`✓ Team change: ${player.name} ${player.team} → ${currentTeam}`);
        player.team = currentTeam;
        updatedCount++;
      }

      // Progress indicator every 50 players
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${totalPlayers} players checked...`);
      }

      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      console.warn(`⚠️  Failed to fetch team for ${player.name}:`, (error as Error).message);
      await delay(REQUEST_DELAY_MS);
    }
  }

  console.log(`\n${'='.repeat(60)}`);

  if (updatedCount > 0) {
    console.log(`✓ Found ${updatedCount} team changes`);
    console.log('Updating players.json files...\n');

    const jsonContent = JSON.stringify(playersData, null, 2);

    // Update data/players.json
    fs.writeFileSync(playersPath, jsonContent, 'utf8');
    console.log('✓ Updated data/players.json');

    // Update server/data/players.json
    const serverPath = path.join(__dirname, '../server/data/players.json');
    fs.writeFileSync(serverPath, jsonContent, 'utf8');
    console.log('✓ Updated server/data/players.json');

    // Update apps/api/src/data/players.json
    const apiPath = path.join(__dirname, '../apps/api/src/data/players.json');
    fs.writeFileSync(apiPath, jsonContent, 'utf8');
    console.log('✓ Updated apps/api/src/data/players.json');

    console.log(`\n✓ All files updated with ${updatedCount} team changes`);
  } else {
    console.log(`✓ No team changes detected (checked ${totalPlayers} players)`);
  }

  console.log(`${'='.repeat(60)}\n`);
}

updatePlayerTeams().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
