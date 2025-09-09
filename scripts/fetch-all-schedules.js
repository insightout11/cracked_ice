const fs = require('fs');
const path = require('path');

// All 32 NHL teams from the mapping in schedules.ts
const NHL_TEAMS = [
  'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'BOS',
  'BUF', 'MTL', 'OTT', 'TOR', 'CAR', 'FLA', 
  'TBL', 'WSH', 'CHI', 'DET', 'NSH', 'STL',
  'CGY', 'COL', 'EDM', 'VAN', 'ANA', 'DAL',
  'LAK', 'SJS', 'CBJ', 'MIN', 'WPG', 'VGK',
  'SEA', 'UTA'
];

async function fetchTeamSchedule(teamCode) {
  try {
    console.log(`Fetching ${teamCode} schedule...`);
    
    const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamCode}/20252026`;
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
    
    console.log(`✅ ${teamCode}: ${uniqueDates.length} games`);
    return uniqueDates;
    
  } catch (error) {
    console.error(`❌ Error fetching ${teamCode} schedule:`, error.message);
    return null;
  }
}

async function fetchAllSchedules() {
  console.log('🏒 Fetching real NHL schedules for all 32 teams...\n');
  
  const scheduleData = {
    season: "20252026",
    teams: {},
    lastRefreshed: new Date().toISOString()
  };
  
  // Fetch schedules with some delay to avoid rate limiting
  for (const teamCode of NHL_TEAMS) {
    const schedule = await fetchTeamSchedule(teamCode);
    
    if (schedule) {
      scheduleData.teams[teamCode] = schedule;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const successfulTeams = Object.keys(scheduleData.teams).length;
  console.log(`\n📊 Successfully fetched schedules for ${successfulTeams}/${NHL_TEAMS.length} teams`);
  
  if (successfulTeams === 0) {
    console.error('❌ No schedules were successfully fetched. Aborting.');
    return;
  }
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'data', 'schedules-20252026.json');
  fs.writeFileSync(outputPath, JSON.stringify(scheduleData, null, 2));
  
  console.log(`✅ Saved all schedules to ${outputPath}`);
  console.log(`🎯 Ready to use with real NHL data!`);
  
  // Show some stats
  const gameCounts = Object.entries(scheduleData.teams).map(([team, games]) => `${team}: ${games.length}`);
  console.log('\n📅 Games per team:');
  console.log(gameCounts.join(', '));
}

// Run if called directly
if (require.main === module) {
  fetchAllSchedules()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fetchAllSchedules, fetchTeamSchedule };