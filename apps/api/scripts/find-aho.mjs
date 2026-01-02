// Find Sebastian Aho (Carolina)
async function findPlayer() {
  const url = 'https://api-web.nhle.com/v1/search/player?culture=en-us&limit=20&q=sebastian%20aho&active=true';
  console.log('Searching for Sebastian Aho...\n');

  const response = await fetch(url);
  const data = await response.json();

  data.forEach(player => {
    console.log(`${player.name} - ${player.teamAbbrev} - ID: ${player.playerId} - Pos: ${player.positionCode}`);
  });
}

findPlayer().catch(console.error);
