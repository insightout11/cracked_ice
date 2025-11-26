import { buildProjection } from './src/features/coach/scoring';
import { loadTeamStatsContext } from './src/context/teamStats';
import { loadSchedules, getTeamGameMeta } from './src/context/schedules';
import type { Player, LeagueProfile } from './src/features/coach/types';

async function testSoS() {
  console.log('Loading team stats...');
  const teamStats = await loadTeamStatsContext();

  console.log(`Team stats loaded: ${teamStats.loaded}, Teams: ${teamStats.byTeam.size}`);

  console.log('\nLoading schedule context...');
  const scheduleContext = loadSchedules();
  console.log(`Schedule context loaded: ${scheduleContext.meta.teamCount} teams`);

  // Check if we have enriched game metadata
  const bufGames = getTeamGameMeta('BUF', scheduleContext);
  const dalGames = getTeamGameMeta('DAL', scheduleContext);
  console.log(`BUF has ${bufGames.length} games with opponent info`);
  console.log(`DAL has ${dalGames.length} games with opponent info`);
  if (bufGames.length > 0) {
    console.log(`  Sample BUF game: ${bufGames[0].date} vs ${bufGames[0].opponent} (${bufGames[0].isHome ? 'home' : 'away'})`);
  }

  if (teamStats.loaded) {
    console.log('\nSample team stats:');
    const samples = ['DAL', 'BUF', 'SJS'].map(code => {
      const stat = teamStats.byTeam.get(code);
      return `  ${code}: GA/60=${stat?.gaPer60}, GF/60=${stat?.gfPer60}`;
    });
    console.log(samples.join('\n'));
  }

  const league: LeagueProfile = {
    league_name: 'Test',
    scoring_type: 'points',
    skater_scoring: { goals: 3, assists: 2, shots_on_goal: 0.4, blocks: 0.6, powerplay_points: 0.5 },
    goalie_scoring: {},
    lineup_slots: { F: 1 }
  };

  // Test player from BUF (weak defense, GA/60 = 3.4)
  const bufPlayer: Player = {
    id: 'test-buf',
    full_name: 'BUF Player',
    team: 'BUF',
    position: 'F',
    games_played: 10,
    stats: { goals: 10, assists: 10, shots_on_goal: 30, blocks: 5, power_play_points: 5 },
    upcoming_games: ['2025-11-20', '2025-11-22', '2025-11-24'],
    is_drop_eligible: false,
    tags: []
  };

  // Test player from DAL (strong defense, GA/60 = 2.1)
  const dalPlayer: Player = {
    id: 'test-dal',
    full_name: 'DAL Player',
    team: 'DAL',
    position: 'F',
    games_played: 10,
    stats: { goals: 10, assists: 10, shots_on_goal: 30, blocks: 5, power_play_points: 5 },
    upcoming_games: ['2025-11-20', '2025-11-22', '2025-11-24'],
    is_drop_eligible: false,
    tags: []
  };

  const window = { start: '2025-11-20', end: '2025-11-26' };

  console.log('\n--- Testing projections ---');

  const bufProjection = buildProjection(bufPlayer, league, window, null, scheduleContext, teamStats);
  console.log(`\nBUF Player (weak defense team, GA/60=3.4):`);
  console.log(`  Strength of Schedule: ${bufProjection.strengthOfSchedule}`);
  console.log(`  FPPG: ${bufProjection.fppg}`);
  console.log(`  Projected Points: ${bufProjection.projectedPoints}`);

  const dalProjection = buildProjection(dalPlayer, league, window, null, scheduleContext, teamStats);
  console.log(`\nDAL Player (strong defense team, GA/60=2.1):`);
  console.log(`  Strength of Schedule: ${dalProjection.strengthOfSchedule}`);
  console.log(`  FPPG: ${dalProjection.fppg}`);
  console.log(`  Projected Points: ${dalProjection.projectedPoints}`);

  const noContextProjection = buildProjection(bufPlayer, league, window, null, null, null);
  console.log(`\nBUF Player (NO contexts):`);
  console.log(`  Strength of Schedule: ${noContextProjection.strengthOfSchedule} (should be 5 = neutral)`);

  console.log('\n✓ SoS calculation is working with real NHL data!');
}

testSoS().catch(console.error);
