const { loadSchedules, getTeamGameMeta } = require('./dist/server/src/context/schedules');

// Load schedules
const scheduleContext = loadSchedules();

console.log('Schedule context loaded:', {
  teamCount: scheduleContext.meta.teamCount,
  season: scheduleContext.meta.season
});

// Try to get GameMeta for CAR (should have off-nights on Nov 19, 21, 23)
const carGames = getTeamGameMeta('CAR', scheduleContext);

console.log('\nCAR GameMeta count:', carGames.length);
console.log('\nFirst 10 CAR games:', carGames.slice(0, 10).map(g => ({
  date: g.date,
  opponent: g.opponent,
  isHome: g.isHome,
  isOffNight: g.isOffNight
})));

// Filter to Nov 19-26
const novGames = carGames.filter(g => g.date >= '2025-11-19' && g.date <= '2025-11-26');
console.log('\nCAR games Nov 19-26:', novGames.map(g => ({
  date: g.date,
  opponent: g.opponent,
  isOffNight: g.isOffNight
})));

const offNightCount = novGames.filter(g => g.isOffNight).length;
const offNightRate = novGames.length > 0 ? offNightCount / novGames.length : 0;
console.log('\nOff-night rate for CAR Nov 19-26:', offNightRate);
