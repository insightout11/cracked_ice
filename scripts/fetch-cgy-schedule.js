const fs = require('fs');
const path = require('path');

// Fetch Calgary Flames schedule using the direct team schedule API
async function fetchCGYSchedule() {
  try {
    console.log('Fetching Calgary Flames schedule from NHL API...');
    
    // Use direct team schedule endpoint
    const url = 'https://api-web.nhle.com/v1/club-schedule-season/CGY/20252026';
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract regular season dates (gameType: 2)
    const regularSeasonDates = [];
    for (const game of data.games || []) {
      if (game.gameType === 2 && game.gameDate) {
        regularSeasonDates.push(game.gameDate);
      }
    }
    
    // Remove duplicates and sort
    const uniqueDates = [...new Set(regularSeasonDates)].sort();
    
    console.log(`Found ${uniqueDates.length} regular season games for CGY`);
    console.log(`Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);
    console.log(`Sample games: ${uniqueDates.slice(0, 10).join(', ')}...`);
    
    // Read existing schedule file
    const schedulePath = path.join(__dirname, '..', 'data', 'schedules-20252026.json');
    const existingData = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    
    // Add CGY schedule
    existingData.teams.CGY = uniqueDates;
    existingData.lastRefreshed = new Date().toISOString();
    
    // Write back to file
    fs.writeFileSync(schedulePath, JSON.stringify(existingData, null, 2));
    
    console.log('✅ Successfully added CGY schedule to schedules-20252026.json');
    console.log(`Total teams now: ${Object.keys(existingData.teams).length}`);
    
    return uniqueDates;
    
  } catch (error) {
    console.error('❌ Error fetching CGY schedule:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fetchCGYSchedule()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { fetchCGYSchedule };