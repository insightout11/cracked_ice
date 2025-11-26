import { loadUserContext } from './src/features/coach/data-loader';
import { buildProjection, DateWindow } from './src/features/coach/scoring';
import { mergeUpcomingGames } from './src/features/coach/recommendations';
import { loadSchedules } from './src/context/schedules';
import { loadStats } from './src/context/stats';
import { buildDateRange } from './src/features/coach/simulation';
import type { PlayerProjection } from './src/features/coach/types';

const userId = 'demo-user';
const window: DateWindow = { start: '2025-10-30', end: '2025-10-30' };

const scheduleContext = loadSchedules();
const statsContext = loadStats();
const context = loadUserContext(userId);

const roster = context.roster.map((player) =>
  mergeUpcomingGames(player, scheduleContext, window)
);

const rosterProjections = roster.map((player) =>
  buildProjection(player, context.league_profile, window, statsContext)
);

// Manually replicate the simulation logic with detailed logging
const lineupSlots = context.league_profile.lineup_slots;
const calendar = buildDateRange(window);

console.log('===== LINEUP CONFIGURATION =====');
console.log('Active roster slots:', lineupSlots);

console.log('\n===== ALL PLAYERS WITH THEIR POSITIONS =====');
for (const p of rosterProjections) {
  const slot = p.base.current_slot?.toUpperCase() ?? '';
  const isIR = slot === 'IR' || slot === 'IR+' || slot === 'IR-LT';
  const irFlag = isIR ? ' [IR - EXCLUDED]' : '';
  console.log(`${p.base.full_name.padEnd(25)} ${p.base.position.padEnd(8)} FPPG=${p.fppg.toFixed(2)} Slot=${slot}${irFlag}`);
  console.log(`  Games: ${p.upcomingGamesInWindow.join(', ')}`);
}

function normalizePositions(playerPosition: string): string[] {
  return playerPosition
    .split('/')
    .map((pos) => pos.trim().toUpperCase())
    .filter(Boolean)
    .map((pos) => {
      if (pos === 'L') return 'LW';
      if (pos === 'R') return 'RW';
      return pos;
    });
}

function isEligibleForPosition(playerPosition: string, slotPosition: string): boolean {
  const positions = normalizePositions(playerPosition);
  const slot = slotPosition.toUpperCase();
  const isForward = positions.some((pos) => pos === 'C' || pos === 'LW' || pos === 'RW' || pos === 'W' || pos === 'F');
  const isSkater = positions.some((pos) => pos !== 'G');

  switch (slot) {
    case 'F':
      return isForward;
    case 'W':
      return positions.some((pos) => pos === 'LW' || pos === 'RW' || pos === 'W');
    case 'UTIL':
    case 'U':
    case 'FLEX':
      return isSkater;
    case 'D':
      return positions.includes('D');
    case 'G':
      return positions.includes('G');
    default:
      return positions.includes(slot);
  }
}

const activePositions = Object.entries(lineupSlots)
  .filter(([pos, limit]) => {
    const normalized = pos.toUpperCase();
    return (
      limit > 0 &&
      !Number.isNaN(limit) &&
      normalized !== 'BN' &&
      normalized !== 'BENCH' &&
      normalized !== 'IR' &&
      normalized !== 'IR+' &&
      normalized !== 'IR-LT'
    );
  })
  .map(([pos, limit]) => ({ position: pos, limit: Number(limit) }));

console.log('\n===== ACTIVE POSITIONS (excluding bench/IR) =====');
console.log(activePositions);

for (const day of calendar) {
  console.log(`\n\n===== SIMULATION FOR ${day} =====`);

  const usedPlayerIds = new Set<string>();
  const remainingSlots = new Map<string, number>();

  // Initialize remaining slots
  for (const { position, limit } of activePositions) {
    remainingSlots.set(position, limit);
  }

  console.log('\nInitial slots:', Object.fromEntries(remainingSlots));

  // Get all players with games today, sorted by FPPG (highest first)
  const playersWithGames = rosterProjections
    .filter((p) => {
      const slot = p.base.current_slot?.toUpperCase() ?? '';
      const isIR = slot === 'IR' || slot === 'IR+' || slot === 'IR-LT';
      return !isIR && p.upcomingGamesInWindow.includes(day);
    })
    .sort((a, b) => b.fppg - a.fppg || b.projectedPoints - a.projectedPoints);

  console.log('\nPlayers with games (sorted by FPPG):');
  for (const p of playersWithGames) {
    console.log(`  ${p.base.full_name.padEnd(25)} ${p.base.position.padEnd(8)} FPPG=${p.fppg.toFixed(2)}`);
  }

  // Categorize players by position flexibility
  const singlePositionPlayers: PlayerProjection[] = [];
  const multiPositionPlayers: PlayerProjection[] = [];

  for (const player of playersWithGames) {
    const positions = normalizePositions(player.base.position);
    if (positions.length === 1) {
      singlePositionPlayers.push(player);
    } else {
      multiPositionPlayers.push(player);
    }
  }

  console.log(`\nCategorization: ${singlePositionPlayers.length} single-position, ${multiPositionPlayers.length} multi-position`);

  console.log('\nSingle-position players:');
  for (const p of singlePositionPlayers) {
    console.log(`  ${p.base.full_name.padEnd(25)} ${p.base.position}`);
  }

  console.log('\nMulti-position players:');
  for (const p of multiPositionPlayers) {
    console.log(`  ${p.base.full_name.padEnd(25)} ${p.base.position}`);
  }

  // PASS 1: Assign single-position players first
  console.log('\n----- PASS 1: Single-position players -----');
  for (const player of singlePositionPlayers) {
    if (usedPlayerIds.has(player.base.id)) {
      console.log(`  SKIP ${player.base.full_name} (already used)`);
      continue;
    }

    const positions = normalizePositions(player.base.position);
    const primaryPos = positions[0];

    console.log(`\n  Processing ${player.base.full_name} (${player.base.position}, FPPG=${player.fppg.toFixed(2)})`);

    // Find a slot this player can fill
    let assigned = false;
    for (const { position } of activePositions) {
      const available = remainingSlots.get(position)! > 0;
      const eligible = isEligibleForPosition(player.base.position, position);

      console.log(`    Checking slot ${position}: available=${available}, eligible=${eligible}, remaining=${remainingSlots.get(position)}`);

      if (available && eligible) {
        // Assign to this slot
        remainingSlots.set(position, remainingSlots.get(position)! - 1);
        usedPlayerIds.add(player.base.id);
        console.log(`    ✓ ASSIGNED to ${position} (remaining: ${remainingSlots.get(position)})`);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      console.log(`    ✗ BENCHED (no available slot)`);
    }
  }

  console.log('\nAfter Pass 1, remaining slots:', Object.fromEntries(remainingSlots));
  console.log('Players used:', usedPlayerIds.size);

  // PASS 2: Assign multi-position players
  console.log('\n----- PASS 2: Multi-position players -----');
  for (const player of multiPositionPlayers) {
    if (usedPlayerIds.has(player.base.id)) {
      console.log(`  SKIP ${player.base.full_name} (already used)`);
      continue;
    }

    console.log(`\n  Processing ${player.base.full_name} (${player.base.position}, FPPG=${player.fppg.toFixed(2)})`);

    // Find eligible positions with available slots
    const eligibleSlots = activePositions
      .filter(({ position }) => {
        const available = remainingSlots.get(position)! > 0;
        const eligible = isEligibleForPosition(player.base.position, position);
        console.log(`    Checking slot ${position}: available=${available}, eligible=${eligible}, remaining=${remainingSlots.get(position)}`);
        return available && eligible;
      });

    console.log(`    Eligible slots: [${eligibleSlots.map(s => s.position).join(', ')}]`);

    if (eligibleSlots.length > 0) {
      // Prefer more specific positions over flex positions
      const preferredSlot = eligibleSlots.find(({ position }) => {
        const norm = position.toUpperCase();
        return norm === 'C' || norm === 'LW' || norm === 'RW' || norm === 'D' || norm === 'G';
      }) || eligibleSlots[0];

      const position = preferredSlot.position;
      remainingSlots.set(position, remainingSlots.get(position)! - 1);
      usedPlayerIds.add(player.base.id);
      console.log(`    ✓ ASSIGNED to ${position} (remaining: ${remainingSlots.get(position)})`);
    } else {
      console.log(`    ✗ BENCHED (no eligible slots available)`);
    }
  }

  console.log('\nAfter Pass 2, remaining slots:', Object.fromEntries(remainingSlots));
  console.log('Total players assigned:', usedPlayerIds.size);

  const totalSlots = Array.from(activePositions.values()).reduce((sum, { limit }) => sum + limit, 0);
  console.log(`Total active slots: ${totalSlots}`);
  console.log(`Slots filled: ${usedPlayerIds.size}/${totalSlots}`);
}
