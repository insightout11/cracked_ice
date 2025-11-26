import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const OUTPUT_PATH = path.join(__dirname, '..', 'apps', 'api', 'src', 'data', 'players.json');
const SERVER_OUTPUT_PATH = path.join(__dirname, '..', 'server', 'data', 'players.json');

async function fetchWithRetry(url, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Fetching ${url} (attempt ${attempt}/${maxAttempts})...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'cracked-ice-hydrator/1.0 (+https://crackedicehockey.com)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function fetchAllPlayers() {
  console.log('Fetching all NHL teams...');

  // Get all teams
  const teams = [
    'ANA', 'BOS', 'BUF', 'CGY', 'CAR', 'CHI', 'COL', 'CBJ', 'DAL', 'DET',
    'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NSH', 'NJD', 'NYI', 'NYR', 'OTT',
    'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WPG',
    'WSH', 'UTA'
  ];

  const allPlayers = [];
  const playerIds = new Set();

  for (const teamCode of teams) {
    console.log(`Fetching roster for ${teamCode}...`);

    try {
      const roster = await fetchWithRetry(`${NHL_API_BASE}/roster/${teamCode}/current`);

      // Process forwards
      if (roster.forwards) {
        for (const player of roster.forwards) {
          const id = `nhl:${player.id}`;
          if (playerIds.has(id)) continue;
          playerIds.add(id);

          const firstName = player.firstName?.default || '';
          const lastName = player.lastName?.default || '';
          const fullName = `${firstName} ${lastName}`.trim();

          allPlayers.push({
            id,
            name: fullName,
            team: teamCode,
            pos: ['C', 'LW', 'RW'].filter(() => true), // We don't have exact position from roster
            aliases: []
          });
        }
      }

      // Process defensemen
      if (roster.defensemen) {
        for (const player of roster.defensemen) {
          const id = `nhl:${player.id}`;
          if (playerIds.has(id)) continue;
          playerIds.add(id);

          const firstName = player.firstName?.default || '';
          const lastName = player.lastName?.default || '';
          const fullName = `${firstName} ${lastName}`.trim();

          allPlayers.push({
            id,
            name: fullName,
            team: teamCode,
            pos: ['D'],
            aliases: []
          });
        }
      }

      // Process goalies
      if (roster.goalies) {
        for (const player of roster.goalies) {
          const id = `nhl:${player.id}`;
          if (playerIds.has(id)) continue;
          playerIds.add(id);

          const firstName = player.firstName?.default || '';
          const lastName = player.lastName?.default || '';
          const fullName = `${firstName} ${lastName}`.trim();

          allPlayers.push({
            id,
            name: fullName,
            team: teamCode,
            pos: ['G'],
            aliases: []
          });
        }
      }

      // Small delay between teams
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Failed to fetch ${teamCode}:`, error.message);
    }
  }

  console.log(`\nFetched ${allPlayers.length} unique players from ${teams.length} teams`);

  const output = {
    players: allPlayers
  };

  // Write to apps/api location
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);

  // Also write to server location
  fs.writeFileSync(SERVER_OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${SERVER_OUTPUT_PATH}`);

  console.log('\nDone! Now run: cd apps/api && npm run hydrate');
}

fetchAllPlayers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
