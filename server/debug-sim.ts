import { loadUserContext } from './src/features/coach/data-loader';
import { buildProjection, DateWindow } from './src/features/coach/scoring';
import { simulateLineup } from './src/features/coach/simulation';
import { mergeUpcomingGames } from './src/features/coach/recommendations';
import { loadSchedules } from './src/context/schedules';
import { loadStats } from './src/context/stats';

const userId = 'demo-user';
const window: DateWindow = { start: '2025-10-30', end: '2025-11-02' };

const scheduleContext = loadSchedules();
const statsContext = loadStats();
const context = loadUserContext(userId);

const roster = context.roster.map((player) =>
  mergeUpcomingGames(player, scheduleContext, window)
);

const rosterProjections = roster.map((player) =>
  buildProjection(player, context.league_profile, window, statsContext)
);

console.log('===== BASELINE SIMULATION =====');
const baseline = simulateLineup(
  rosterProjections,
  window,
  context.league_profile.lineup_slots
);

console.log('\nBaseline total points:', baseline.totalPoints);
console.log('\n===== STARTS BY DATE (BASELINE) =====');
const dates = ['2025-10-30', '2025-10-31', '2025-11-01', '2025-11-02'];
for (const date of dates) {
  console.log(`\n${date}:`);
  const starts = baseline.startRecords.filter(r => r.date === date);
  for (const start of starts) {
    console.log(`  ${start.playerName.padEnd(25)} ${start.position.padEnd(4)} FPPG=${start.fppg.toFixed(2)}`);
  }
  const unused = baseline.unusedSlotsByDate.get(date);
  if (unused) {
    const unusedList = Object.entries(unused)
      .filter(([, count]) => count > 0)
      .map(([slot, count]) => `${count} ${slot}`)
      .join(', ');
    console.log(`  UNUSED: ${unusedList || 'none'}`);
  }
}

// Now simulate with Bo Horvat added and Luke Hughes dropped
console.log('\n\n===== SIMULATION WITH BO HORVAT (drop Luke Hughes) =====');
const boHorvat = context.free_agents.find(fa => fa.full_name === 'Bo Horvat');
if (!boHorvat) {
  console.log('Bo Horvat not found in free agents!');
  process.exit(1);
}

const horvatMerged = mergeUpcomingGames(boHorvat, scheduleContext, window);
const horvatProjection = buildProjection(horvatMerged, context.league_profile, window, statsContext);

console.log('\nBo Horvat details:');
console.log('  Position:', boHorvat.position);
console.log('  Team:', boHorvat.team);
console.log('  Games in window:', horvatProjection.upcomingGamesInWindow);
console.log('  FPPG:', horvatProjection.fppg.toFixed(2));

const trimmedRoster = rosterProjections.filter(p => p.base.full_name !== 'Luke Hughes');
const newRoster = [...trimmedRoster, horvatProjection];

const simulated = simulateLineup(
  newRoster,
  window,
  context.league_profile.lineup_slots
);

console.log('\nSimulated total points:', simulated.totalPoints);
console.log('Delta:', (simulated.totalPoints - baseline.totalPoints).toFixed(2));

console.log('\n===== STARTS BY DATE (WITH HORVAT) =====');
for (const date of dates) {
  console.log(`\n${date}:`);
  const starts = simulated.startRecords.filter(r => r.date === date);
  for (const start of starts) {
    const isHorvat = start.playerName === 'Bo Horvat';
    const marker = isHorvat ? ' ← NEW' : '';
    console.log(`  ${start.playerName.padEnd(25)} ${start.position.padEnd(4)} FPPG=${start.fppg.toFixed(2)}${marker}`);
  }
  const unused = simulated.unusedSlotsByDate.get(date);
  if (unused) {
    const unusedList = Object.entries(unused)
      .filter(([, count]) => count > 0)
      .map(([slot, count]) => `${count} ${slot}`)
      .join(', ');
    console.log(`  UNUSED: ${unusedList || 'none'}`);
  }
}

console.log('\n===== COMPARISON FOR 2025-10-30 =====');
const baselineOct30 = baseline.startRecords.filter(r => r.date === '2025-10-30');
const simulatedOct30 = simulated.startRecords.filter(r => r.date === '2025-10-30');

console.log('\nBaseline starters:');
for (const start of baselineOct30) {
  console.log(`  ${start.playerName.padEnd(25)} in slot ${start.position}`);
}

console.log('\nWith Horvat starters:');
for (const start of simulatedOct30) {
  const isHorvat = start.playerName === 'Bo Horvat';
  const marker = isHorvat ? ' ← NEW ADD' : '';
  const wasInBaseline = baselineOct30.find(b => b.playerName === start.playerName && b.position === start.position);
  const moved = !isHorvat && !wasInBaseline ? ' ← MOVED FROM ANOTHER SLOT' : '';
  console.log(`  ${start.playerName.padEnd(25)} in slot ${start.position}${marker}${moved}`);
}

console.log('\nPlayers who left lineup:');
for (const baseStart of baselineOct30) {
  const stillStarting = simulatedOct30.find(s => s.playerName === baseStart.playerName);
  if (!stillStarting) {
    console.log(`  ${baseStart.playerName.padEnd(25)} was in slot ${baseStart.position}`);
  }
}
