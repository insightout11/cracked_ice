import { nhlApiWebProvider } from '../src/services/providers/nhl_api_web.ts';

// Test with Connor McDavid
const skaterId = '8478402';
const season = '20252026';

console.log(`Fetching stats for skater ${skaterId}, season ${season}...`);

const stats = await nhlApiWebProvider.fetchPlayerFppg(skaterId, season);

if (stats) {
  console.log('\nResult:');
  console.log('Season FPPG:', stats.seasonFppg);
  console.log('Last30 FPPG:', stats.last30Fppg);
  console.log('Last7 FPPG:', stats.last7Fppg);
  console.log('Blended FPPG:', stats.blendedFppg);

  if (stats.skaterStats) {
    console.log('\nSkater stats:');
    console.log('  Games:', stats.skaterStats.gamesPlayed);
    console.log('  Goals:', stats.skaterStats.goals);
    console.log('  Assists:', stats.skaterStats.assists);
    console.log('  Points:', stats.skaterStats.points);
  }

  console.log('\nGoalie stats:', stats.goalieStats ? 'YES' : 'NO');
  if (stats.goalieStats) {
    console.log('Goalie stats object:', JSON.stringify(stats.goalieStats, null, 2));
  }
} else {
  console.log('No stats returned!');
}
