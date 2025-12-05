import { nhlApiWebProvider } from '../src/services/providers/nhl_api_web.ts';

// Test with a known goalie: Connor Hellebuyck (8476432)
const goalieId = '8476432';
const season = '20252026';

console.log(`Fetching stats for goalie ${goalieId}, season ${season}...`);

const stats = await nhlApiWebProvider.fetchPlayerFppg(goalieId, season);

if (stats) {
  console.log('\nResult:');
  console.log('Season goalie stats:', stats.goalieStats ? 'YES' : 'NO');
  console.log('Last30 goalie stats:', stats.last30GoalieStats ? 'YES' : 'NO');
  console.log('Last7 goalie stats:', stats.last7GoalieStats ? 'YES' : 'NO');
  console.log('\nFull result:');
  console.log(JSON.stringify(stats, null, 2));
} else {
  console.log('No stats returned!');
}
