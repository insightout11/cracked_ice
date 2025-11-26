import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Load roster
const rosterPath = join(__dirname, '..', 'data', 'coach', 'users', 'demo-user', 'roster.json');
const roster = JSON.parse(readFileSync(rosterPath, 'utf-8'));

// Load schedule
const schedulePath = join(__dirname, '..', 'data', 'schedule.json');
const scheduleData = JSON.parse(readFileSync(schedulePath, 'utf-8'));

console.log('Enriching roster with upcoming games from schedule...');

// Extract team schedules
const teamSchedules: Record<string, string[]> = scheduleData.teams || {};

// Enrich each player with upcoming games (extract just dates)
let enrichedCount = 0;
for (const player of roster.roster) {
  const teamCode = player.team?.toUpperCase();
  if (teamCode && teamSchedules[teamCode]) {
    // Extract just the dates from game objects
    const teamGames = teamSchedules[teamCode];
    if (Array.isArray(teamGames) && teamGames.length > 0) {
      // Check if it's an array of game objects or just dates
      if (typeof teamGames[0] === 'object' && teamGames[0].date) {
        player.upcoming_games = teamGames.map((game: any) => game.date);
      } else {
        player.upcoming_games = teamGames;
      }
    } else {
      player.upcoming_games = [];
    }
    enrichedCount++;
    console.log(`✓ ${player.full_name} (${teamCode}): ${player.upcoming_games.length} games`);
  } else {
    console.log(`⚠ ${player.full_name}: No schedule found for team ${teamCode}`);
    player.upcoming_games = [];
  }
}

// Save enriched roster
writeFileSync(rosterPath, JSON.stringify(roster, null, 2));
console.log(`\n✅ Enriched ${enrichedCount}/${roster.roster.length} players with upcoming games`);
