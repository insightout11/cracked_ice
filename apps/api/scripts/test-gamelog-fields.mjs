// Test script to see actual NHL API game log response
const playerId = '8478402'; // Sebastian Aho
const season = '20252026';

async function testGameLog() {
  const url = `https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/2`;

  console.log('Fetching:', url);

  const response = await fetch(url);
  const data = await response.json();

  if (data.gameLog && data.gameLog.length > 0) {
    console.log('\n=== Sample Game (Most Recent) ===');
    console.log(JSON.stringify(data.gameLog[0], null, 2));

    console.log('\n=== Available Fields ===');
    console.log(Object.keys(data.gameLog[0]).join(', '));

    console.log('\n=== First 3 Games ===');
    data.gameLog.slice(0, 3).forEach((game, i) => {
      console.log(`\nGame ${i + 1} (${game.gameDate}):`);
      console.log(`  TOI: ${game.timeOnIce}`);
      console.log(`  Hits: ${game.hits}`);
      console.log(`  Blocks: ${game.blockedShots || game.blocks}`);
      console.log(`  Score: ${game.teamScore}-${game.opponentScore}`);
      console.log(`  Opponent: ${game.opponentAbbrev}`);
      console.log(`  Home/Road: ${game.homeRoadFlag}`);
    });
  } else {
    console.log('No game log data found');
  }
}

testGameLog().catch(console.error);
