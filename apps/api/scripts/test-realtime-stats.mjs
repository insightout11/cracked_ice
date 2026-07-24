import { SEASON_ID } from './_season.mjs';
// Test script to see realtime stats endpoint
const playerId = '8478402'; // Sebastian Aho
const season = SEASON_ID;

async function testRealtimeStats() {
  const cayenneExp = `playerId=${playerId}%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}%20and%20gameTypeId=2`;
  const url = `https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&start=0&limit=1&factCayenneExp=gamesPlayed%3E=1&cayenneExp=${cayenneExp}`;

  console.log('Fetching:', url);

  const response = await fetch(url);
  const data = await response.json();

  if (data.data && data.data.length > 0) {
    const stats = data.data[0];
    console.log('\n=== Realtime Stats ===');
    console.log(`Games Played: ${stats.gamesPlayed}`);
    console.log(`Hits: ${stats.hits}`);
    console.log(`Blocked Shots: ${stats.blockedShots}`);
    console.log(`Giveaways: ${stats.giveaways}`);
    console.log(`Takeaways: ${stats.takeaways}`);

    console.log('\n=== Available Fields ===');
    console.log(Object.keys(stats).sort().join(', '));
  } else {
    console.log('No data found');
  }
}

testRealtimeStats().catch(console.error);
