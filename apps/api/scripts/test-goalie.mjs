import { nhlApiWebProvider } from '../src/services/providers/nhl_api_web.ts';
import { SEASON_ID } from './_season.mjs';

// Test with a known goalie: Linus Ullmark (8476999)
const goalieId = '8476999';
const season = SEASON_ID;

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
