// Test script to see where season hits/blocks come from
const playerId = '8478402'; // Sebastian Aho
const season = '20252026';

async function testSeasonStats() {
  // Try the summary endpoint
  const cayenneExp = `playerId=${playerId}%20and%20seasonId%3C=${season}%20and%20seasonId%3E=${season}%20and%20gameTypeId=2`;
  const url = `https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&start=0&limit=1&cayenneExp=${cayenneExp}`;

  console.log('Fetching:', url);

  const response = await fetch(url);
  const data = await response.json();

  if (data.data && data.data.length > 0) {
    const stats = data.data[0];
    console.log('\n=== Season Stats ===');
    console.log(`Games Played: ${stats.gamesPlayed}`);
    console.log(`Hits: ${stats.hits}`);
    console.log(`Blocked Shots: ${stats.blockedShots}`);
    console.log(`TOI Per Game: ${stats.timeOnIcePerGame}`);
    console.log(`Goals: ${stats.goals}`);
    console.log(`Assists: ${stats.assists}`);

    console.log('\n=== Available Fields ===');
    console.log(Object.keys(stats).sort().join(', '));
  } else {
    console.log('No data found');
  }
}

testSeasonStats().catch(console.error);
