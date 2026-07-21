import { SEASON_ID } from './_season.mjs';
// Test script to see the actual NHL API game log format for a goalie
const UA = 'cracked-ice/1.0 (+https://crackedicehockey.com)';

async function fetchGameLog(playerId, season) {
  const url = `https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/2`;
  console.log('Fetching:', url);

  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  const data = await response.json();

  return data;
}

// Connor Hellebuyck - goalie
const goalieId = '8476432';
const season = SEASON_ID;

console.log(`Fetching game log for goalie ${goalieId}, season ${season}...\n`);

const gameLog = await fetchGameLog(goalieId, season);

if (gameLog.gameLog && gameLog.gameLog.length > 0) {
  console.log(`Found ${gameLog.gameLog.length} games\n`);
  console.log('First game structure:');
  console.log(JSON.stringify(gameLog.gameLog[0], null, 2));

  console.log('\n\nFields available in first game:');
  console.log(Object.keys(gameLog.gameLog[0]));
} else {
  console.log('No game log data found');
}
