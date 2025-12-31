const fs = require('fs');
const path = require('path');

// Load backend schedule with isOffNight flags
const backendSchedulePath = path.join(__dirname, '../server/data/schedule.json');
const backendSchedule = JSON.parse(fs.readFileSync(backendSchedulePath, 'utf8'));

// Load frontend schedule
const frontendSchedulePath = path.join(__dirname, '../web/public/schedules-20252026.json');
const frontendSchedule = JSON.parse(fs.readFileSync(frontendSchedulePath, 'utf8'));

console.log('Loading backend schedule data...');
console.log(`Backend teams: ${Object.keys(backendSchedule.teams).length}`);

// Create a map of team-date -> isOffNight for quick lookup
const offNightMap = {};
let totalBackendGames = 0;

Object.keys(backendSchedule.teams).forEach(team => {
  backendSchedule.teams[team].forEach(game => {
    const key = `${team}-${game.date}`;
    offNightMap[key] = game.isOffNight;
    totalBackendGames++;
  });
});

console.log(`Total backend games indexed: ${totalBackendGames}`);
console.log(`Off-night map entries: ${Object.keys(offNightMap).length}`);

// Add isOffNight to frontend games
console.log('\nAdding isOffNight flags to frontend schedule...');
let gamesUpdated = 0;
let gamesNotFound = 0;

if (frontendSchedule.games) {
  Object.keys(frontendSchedule.games).forEach(team => {
    frontendSchedule.games[team].forEach(game => {
      const key = `${team}-${game.date}`;
      if (offNightMap.hasOwnProperty(key)) {
        game.isOffNight = offNightMap[key];
        gamesUpdated++;
      } else {
        // Default to false if not found
        game.isOffNight = false;
        gamesNotFound++;
        console.warn(`Warning: No backend data for ${key}, defaulting to false`);
      }
    });
  });
} else {
  console.error('Error: Frontend schedule does not have a "games" property');
  process.exit(1);
}

console.log(`\nGames updated: ${gamesUpdated}`);
console.log(`Games not found in backend: ${gamesNotFound}`);

// Write updated file with pretty formatting
fs.writeFileSync(
  frontendSchedulePath,
  JSON.stringify(frontendSchedule, null, 2)
);

console.log(`\n✓ Successfully wrote updated schedule to: ${frontendSchedulePath}`);
console.log('\nDone! The frontend schedule now includes isOffNight flags.');
