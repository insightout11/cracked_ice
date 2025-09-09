const fs = require('fs');
const path = require('path');

// NHL API endpoints
const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// All NHL team codes
const NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH'
];

// Helper function to add delay between API calls
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format date as YYYY-MM-DD
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

// Format datetime as ISO string
function formatDateTime(dateStr) {
  return new Date(dateStr).toISOString();
}


// Fetch individual team schedule with start times
async function fetchTeamSchedule(teamCode) {
  try {
    console.log(`Fetching ${teamCode} schedule...`);
    
    const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamCode}/20252026`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract regular season games (gameType: 2) with detailed information
    const games = [];
    for (const game of data.games || []) {
      if (game.gameType === 2 && game.gameDate) {
        // Determine if this team is home or away
        const isHome = game.homeTeam.abbrev === teamCode;
        const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
        
        games.push({
          date: game.gameDate,
          opponent: opponent,
          isHome: isHome,
          gameId: game.id,
          venue: game.venue?.default || 'TBD',
          startTime: game.startTimeUTC
        });
      }
    }
    
    console.log(`✅ ${teamCode}: ${games.length} games`);
    return games;
    
  } catch (error) {
    console.error(`❌ Error fetching ${teamCode} schedule:`, error.message);
    return null;
  }
}

// Main function to fetch all schedule data
async function fetchCompleteSchedule() {
  console.log('🏒 Fetching real NHL schedules for all 32 teams...\n');
  
  const allGames = {};
  const allTeamDates = {};
  
  // Initialize structures
  NHL_TEAMS.forEach(team => {
    allGames[team] = [];
    allTeamDates[team] = [];
  });
  
  // Fetch each team's schedule
  for (let i = 0; i < NHL_TEAMS.length; i++) {
    const team = NHL_TEAMS[i];
    
    try {
      const teamGames = await fetchTeamSchedule(team);
      
      if (teamGames) {
        allGames[team] = teamGames;
        allTeamDates[team] = teamGames.map(game => game.date);
      }
      
      // Rate limiting - wait 200ms between requests
      await delay(200);
      
      // Progress indicator
      if ((i + 1) % 8 === 0) {
        console.log(`\nProcessed ${i + 1}/${NHL_TEAMS.length} teams\n`);
      }
      
    } catch (error) {
      console.error(`Error processing team ${team}:`, error);
    }
  }
  
  console.log('\n✅ Fetch complete. Processing results...');
  
  // Generate final data structure
  const scheduleData = {
    season: "20252026",
    lastUpdated: new Date().toISOString(),
    teams: allTeamDates,
    games: allGames
  };
  
  return scheduleData;
}

// Save the schedule data
async function saveScheduleData() {
  try {
    // Read existing schedule data
    const existingPath = path.join(__dirname, '..', 'web', 'public', 'schedules-20252026.json');
    let existingData = null;
    
    if (fs.existsSync(existingPath)) {
      console.log('📖 Reading existing schedule data...');
      const existingContent = fs.readFileSync(existingPath, 'utf8');
      existingData = JSON.parse(existingContent);
    }
    
    const newScheduleData = await fetchCompleteSchedule();
    
    // If we have existing data, merge the start times into it
    let finalData;
    if (existingData) {
      console.log('🔄 Merging start times into existing data...');
      finalData = { ...existingData };
      finalData.lastUpdated = new Date().toISOString();
      
      // Add start times to existing games
      Object.keys(newScheduleData.games).forEach(team => {
        if (finalData.games[team]) {
          // Create lookup map of new games by date and opponent
          const newGamesMap = new Map();
          newScheduleData.games[team].forEach(game => {
            const key = `${game.date}-${game.opponent}-${game.isHome}`;
            newGamesMap.set(key, game);
          });
          
          // Add start times to existing games
          finalData.games[team].forEach(existingGame => {
            const key = `${existingGame.date}-${existingGame.opponent}-${existingGame.isHome}`;
            const newGame = newGamesMap.get(key);
            
            if (newGame && newGame.startTime && !existingGame.startTime) {
              existingGame.startTime = newGame.startTime;
            }
          });
        }
      });
    } else {
      finalData = newScheduleData;
    }
    
    // Count games with start times
    let gamesWithTimes = 0;
    let totalGames = 0;
    Object.values(finalData.games).forEach(teamGames => {
      teamGames.forEach(game => {
        totalGames++;
        if (game.startTime) {
          gamesWithTimes++;
        }
      });
    });
    
    console.log(`\n📊 Games with start times: ${gamesWithTimes}/${totalGames} (${Math.round(gamesWithTimes/totalGames*100)}%)`);
    
    // Save updated data
    fs.writeFileSync(existingPath, JSON.stringify(finalData, null, 2));
    
    console.log(`\n💾 Updated schedule data saved to: ${existingPath}`);
    console.log('✅ Schedule update successful!');
    
    // Show sample data
    const sampleTeam = 'TOR';
    if (finalData.games[sampleTeam] && finalData.games[sampleTeam].length > 0) {
      const sampleGame = finalData.games[sampleTeam].find(g => g.startTime) || finalData.games[sampleTeam][0];
      console.log(`\nSample game (${sampleTeam}):`);
      console.log(JSON.stringify(sampleGame, null, 2));
    }
    
  } catch (error) {
    console.error('Error saving schedule data:', error);
  }
}

// Run the script
if (require.main === module) {
  saveScheduleData();
}