// Test script to see if we can get game scores from NHL API
const gameId = 2025020631; // From Sebastian Aho's most recent game

async function testGameDetails() {
  // Try the boxscore endpoint
  const url = `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;

  console.log('Fetching:', url);

  const response = await fetch(url);
  const data = await response.json();

  console.log('\n=== Game Score ===');
  console.log(`Away Team: ${data.awayTeam?.abbrev} - ${data.awayTeam?.score}`);
  console.log(`Home Team: ${data.homeTeam?.abbrev} - ${data.homeTeam?.score}`);
  console.log(`Game State: ${data.gameState}`);
  console.log(`Game Outcome: ${data.gameOutcome}`);

  console.log('\n=== Sample Response Structure ===');
  console.log(JSON.stringify({
    awayTeam: data.awayTeam,
    homeTeam: data.homeTeam,
    gameState: data.gameState,
    gameOutcome: data.gameOutcome
  }, null, 2));
}

testGameDetails().catch(console.error);
