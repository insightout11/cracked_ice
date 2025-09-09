const fs = require('fs');
const path = require('path');

async function fetchCGYScheduleFast() {
  try {
    console.log('Fetching Calgary Flames schedule (fast method)...');
    
    const cgyDates = new Set(); // Use Set to avoid duplicates
    
    // Check only regular season months
    const months = [
      '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04'
    ];
    
    for (const month of months) {
      console.log(`Checking ${month}...`);
      
      // Check each day of the month (1-31)
      for (let day = 1; day <= 31; day++) {
        const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
        const url = `https://api-web.nhle.com/v1/schedule/${dateStr}`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) continue; // Skip invalid dates
          
          const data = await response.json();
          
          // Check if Calgary has a game this day
          if (data.gameWeek && Array.isArray(data.gameWeek)) {
            for (const week of data.gameWeek) {
              if (week.games && Array.isArray(week.games)) {
                for (const game of week.games) {
                  // Check if CGY is playing (home or away) and it's regular season (gameType: 2)
                  if (game.gameType === 2 && 
                      (game.homeTeam?.abbrev === 'CGY' || game.awayTeam?.abbrev === 'CGY')) {
                    cgyDates.add(dateStr);
                    console.log(`✓ Found CGY game on ${dateStr}`);
                    break;
                  }
                }
              }
            }
          }
        } catch (error) {
          // Skip errors (invalid dates, network issues, etc.)
          continue;
        }
      }
    }
    
    const cgyDatesArray = Array.from(cgyDates).sort();
    
    console.log(`\nFound ${cgyDatesArray.length} Calgary Flames regular season games`);
    
    if (cgyDatesArray.length === 0) {
      throw new Error('No Calgary games found');
    }
    
    console.log(`Date range: ${cgyDatesArray[0]} to ${cgyDatesArray[cgyDatesArray.length - 1]}`);
    console.log(`Sample games: ${cgyDatesArray.slice(0, 10).join(', ')}...`);
    
    // Read existing schedule file
    const schedulePath = path.join(__dirname, '..', 'data', 'schedules-20252026.json');
    const existingData = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    
    // Add CGY schedule
    existingData.teams.CGY = cgyDatesArray;
    existingData.lastRefreshed = new Date().toISOString();
    
    // Write back to file
    fs.writeFileSync(schedulePath, JSON.stringify(existingData, null, 2));
    
    console.log('\n✅ Successfully added CGY schedule to schedules-20252026.json');
    console.log(`Total teams now: ${Object.keys(existingData.teams).length}`);
    
    return cgyDatesArray;
    
  } catch (error) {
    console.error('\n❌ Error fetching CGY schedule:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fetchCGYScheduleFast()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { fetchCGYScheduleFast };