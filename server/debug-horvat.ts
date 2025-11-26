import { loadUserContext } from './src/features/coach/data-loader';
import { buildProjection, DateWindow } from './src/features/coach/scoring';
import { mergeUpcomingGames } from './src/features/coach/recommendations';
import { loadSchedules } from './src/context/schedules';
import { loadStats } from './src/context/stats';

const window: DateWindow = { start: '2025-10-30', end: '2025-10-30' };
const scheduleContext = loadSchedules();
const statsContext = loadStats();
const context = loadUserContext('demo-user');

const boHorvat = context.free_agents.find(fa => fa.full_name === 'Bo Horvat')!;
const horvatMerged = mergeUpcomingGames(boHorvat, scheduleContext, window);
const horvatProjection = buildProjection(horvatMerged, context.league_profile, window, statsContext);

console.log('Bo Horvat FPPG:', horvatProjection.fppg);
console.log('Bo Horvat position:', horvatProjection.base.position);
console.log('Bo Horvat games:', horvatProjection.upcomingGamesInWindow);

const roster = context.roster.map(p => mergeUpcomingGames(p, scheduleContext, window));
const rosterProjections = roster.map(p => buildProjection(p, context.league_profile, window, statsContext));

// Drop Luke Hughes and add Horvat
const trimmed = rosterProjections.filter(p => p.base.full_name !== 'Luke Hughes');
const newRoster = [...trimmed, horvatProjection];

console.log('\nAll players sorted by FPPG (Oct 30):');
newRoster
  .filter(p => {
    const slot = p.base.current_slot?.toUpperCase() ?? '';
    const isIR = slot === 'IR' || slot === 'IR+' || slot === 'IR-LT';
    return !isIR && p.upcomingGamesInWindow.includes('2025-10-30');
  })
  .sort((a, b) => b.fppg - a.fppg)
  .forEach(p => {
    console.log(`  ${p.base.full_name.padEnd(25)} ${p.base.position.padEnd(8)} FPPG=${p.fppg.toFixed(2)}`);
  });
