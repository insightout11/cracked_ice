// Test game-by-game realtime stats
const playerId = '8478427'; // Sebastian Aho (CAR)
const season = '20252026';

async function testGameRealtime() {
  const cayenneExp = `playerId=${playerId}%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}%20and%20gameTypeId=2`;
  const url = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=true&start=0&limit=50&cayenneExp=${cayenneExp}`;

  console.log('Fetching game-by-game realtime stats...\n');

  const response = await fetch(url);
  const data = await response.json();

  console.log(`Found ${data.data.length} games\n`);
  console.log('Recent games with hits/blocks:\n');

  data.data.slice(0, 10).forEach(game => {
    console.log(`${game.gameDate}: Hits=${game.hits}, Blocks=${game.blockedShots}, TOI=${game.timeOnIcePerGame || 'N/A'}`);
  });

  const totalHits = data.data.reduce((sum, g) => sum + (g.hits || 0), 0);
  const totalBlocks = data.data.reduce((sum, g) => sum + (g.blockedShots || 0), 0);

  console.log(`\nTotal from all ${data.data.length} games:`);
  console.log(`  Hits: ${totalHits}`);
  console.log(`  Blocks: ${totalBlocks}`);
}

testGameRealtime().catch(console.error);
