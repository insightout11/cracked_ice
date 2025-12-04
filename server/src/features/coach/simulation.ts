import { PlayerProjection, SimulationResult, SimulationStartRecord, SimulationBenchRecord } from './types';
import { DateWindow } from './scoring';

export function buildDateRange(window: DateWindow): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${window.start}T00:00:00Z`);
  const end = new Date(`${window.end}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function normalizePositions(playerPosition: string): string[] {
  return playerPosition
    .split(/[\/,]/)  // Split by both slash and comma
    .map((pos) => pos.trim().toUpperCase())
    .filter(Boolean)
    .map((pos) => {
      if (pos === 'L') return 'LW';
      if (pos === 'R') return 'RW';
      return pos;
    });
}

/**
 * Check if a player is eligible for a given position slot.
 * Handles multi-position eligibility (e.g., "LW/RW", "C/LW").
 */
function isEligibleForPosition(playerPosition: string, slotPosition: string, playerId?: string): boolean {
  const positions = normalizePositions(playerPosition);
  const slot = slotPosition.toUpperCase();
  const isForward = positions.some((pos) => pos === 'C' || pos === 'LW' || pos === 'RW' || pos === 'W' || pos === 'F');
  const isSkater = positions.some((pos) => pos !== 'G');

  const debugPlayer = playerId && ['8479337', '8481557', '8477479'].includes(playerId);
  if (debugPlayer) {
    console.log(`[isEligibleForPosition ${playerId}] playerPosition=${playerPosition}, positions=${JSON.stringify(positions)}, slot=${slot}`);
  }

  let result: boolean;
  switch (slot) {
    case 'F':
      result = isForward;
      break;
    case 'W':
      result = positions.some((pos) => pos === 'LW' || pos === 'RW' || pos === 'W');
      break;
    case 'UTIL':
    case 'U':
    case 'FLEX':
      result = isSkater;
      break;
    case 'D':
      result = positions.includes('D');
      break;
    case 'G':
      result = positions.includes('G');
      break;
    default:
      result = positions.includes(slot);
      break;
  }

  if (debugPlayer) {
    console.log(`[isEligibleForPosition ${playerId}] result=${result}`);
  }

  return result;
}

/**
 * Optimized lineup simulation that maximizes roster slot usage.
 * Uses a single-pass greedy approach:
 * 1. Sort all players by FPPG (highest first)
 * 2. Assign each player to their most-specific eligible position
 * This ensures higher-FPPG players always get priority over lower-FPPG players,
 * regardless of position flexibility.
 */
export function simulateLineup(
  projections: PlayerProjection[],
  window: DateWindow,
  lineupSlots: Record<string, number>
): SimulationResult {
  const startsByPlayer = new Map<string, number>();
  const startRecords: SimulationStartRecord[] = [];
  const benchRecords: SimulationBenchRecord[] = [];
  const unusedSlotsByDate = new Map<string, Record<string, number>>();
  let totalPoints = 0;

  const calendar = buildDateRange(window);

  // Get active roster positions (exclude bench/IR)
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

  console.log('[simulation] Active positions:', activePositions);
  console.log('[simulation] Total projections:', projections.length);
  console.log('[simulation] All players with position data:', projections.slice(0, 10).map(p => ({
    id: p.base.id,
    name: p.base.full_name,
    position: p.base.position,
    positionType: typeof p.base.position,
    slot: p.base.current_slot,
    fppg: p.fppg
  })));

  for (const day of calendar) {
    // Track which players have been assigned and which slots are still available
    const usedPlayerIds = new Set<string>();
    const remainingSlots = new Map<string, number>();

    // Initialize remaining slots
    for (const { position, limit } of activePositions) {
      remainingSlots.set(position, limit);
    }

    // Get all players with games today, sorted by FPPG (highest first)
    // Exclude IR players - they occupy IR slots, not active roster slots
    // Include bench players - they can compete for active slots based on FPPG
    const playersWithGames = projections
      .filter((p) => {
        const slot = p.base.current_slot?.toUpperCase() ?? '';
        const isIR = slot === 'IR' || slot === 'IR+' || slot === 'IR-LT';
        return !isIR && p.upcomingGamesInWindow.includes(day);
      })
      .sort((a, b) => b.fppg - a.fppg || b.projectedPoints - a.projectedPoints);

    if (day === calendar[0]) {
      console.log(`[simulation] Day ${day}: ${playersWithGames.length} players with games`);
      console.log('[simulation] Top 5 players:', playersWithGames.slice(0, 5).map(p => ({
        name: p.base.full_name,
        position: p.base.position,
        fppg: p.fppg,
        slot: p.base.current_slot
      })));
    }

    // Single pass: assign all players in FPPG order
    for (const player of playersWithGames) {
      if (usedPlayerIds.has(player.base.id)) continue;

      // Debug specific problem players
      const debugPlayer = ['8479337', '8481557', '8477479'].includes(player.base.id);
      if (debugPlayer && day === calendar[0]) {
        console.log(`[DEBUG ${player.base.id}] ${player.base.full_name}:`, {
          position: player.base.position,
          fppg: player.fppg,
          slot: player.base.current_slot,
          remainingSlots: Array.from(remainingSlots.entries())
        });
      }

      // Find all eligible positions with available slots
      const eligibleSlots = activePositions.filter(({ position }) =>
        remainingSlots.get(position)! > 0 &&
        isEligibleForPosition(player.base.position, position, player.base.id)
      );

      if (debugPlayer && day === calendar[0]) {
        console.log(`[DEBUG ${player.base.id}] Eligible slots:`, eligibleSlots.map(s => s.position));
      }

      if (eligibleSlots.length > 0) {
        // Prefer more specific positions over flex positions
        // (e.g., prefer C over F, LW over W, D over UTIL, etc.)
        const preferredSlot = eligibleSlots.find(({ position }) => {
          const norm = position.toUpperCase();
          return norm === 'C' || norm === 'LW' || norm === 'RW' || norm === 'D' || norm === 'G';
        }) || eligibleSlots[0];

        const position = preferredSlot.position;
        remainingSlots.set(position, remainingSlots.get(position)! - 1);
        usedPlayerIds.add(player.base.id);
        totalPoints += player.fppg;
        startsByPlayer.set(player.base.id, (startsByPlayer.get(player.base.id) ?? 0) + 1);
        startRecords.push({
          playerId: player.base.id,
          playerName: player.base.full_name,
          position,
          date: day,
          fppg: player.fppg
        });
        if (debugPlayer && day === calendar[0]) {
          console.log(`[DEBUG ${player.base.id}] Assigned to ${position}`);
        }
      } else {
        // No available slots for this player
        const positions = normalizePositions(player.base.position);
        const primaryPos = positions[0];
        benchRecords.push({
          playerId: player.base.id,
          playerName: player.base.full_name,
          position: primaryPos,
          date: day,
          fppg: player.fppg,
          reason: 'slot_filled'
        });
        if (debugPlayer && day === calendar[0]) {
          console.log(`[DEBUG ${player.base.id}] Benched - no eligible slots`);
        }
      }
    }

    // Record unused slots
    const unusedSlots: Record<string, number> = {};
    for (const { position } of activePositions) {
      const remaining = remainingSlots.get(position) ?? 0;
      if (remaining > 0) {
        unusedSlots[position] = remaining;
      }
    }
    unusedSlotsByDate.set(day, unusedSlots);
  }

  return {
    totalPoints: Number(totalPoints.toFixed(2)),
    startsByPlayer,
    startRecords,
    benchRecords,
    unusedSlotsByDate
  };
}

