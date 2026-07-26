import type { PlayerProjection, SimulationResult, SimulationStartRecord, SimulationBenchRecord } from './types';
import type { DateWindow } from './scoring';

const INACTIVE_SLOTS = new Set(['BN', 'BENCH', 'IR', 'IR+', 'IR-LT', 'NA']);

export function buildDateRange(window: DateWindow): string[] {
  const dates: string[] = [];
  const startDate = window.start.includes('T') ? window.start.slice(0, 10) : window.start;
  const endDate = window.end.includes('T') ? window.end.slice(0, 10) : window.end;
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function normalizePositions(playerPosition: string): string[] {
  return playerPosition
    .split(/[/,]/)
    .map((position) => position.trim().toUpperCase())
    .filter(Boolean)
    .map((position) => position === 'L' ? 'LW' : position === 'R' ? 'RW' : position);
}

export function isEligibleForPosition(playerPosition: string, slotPosition: string): boolean {
  const positions = normalizePositions(playerPosition);
  const slot = slotPosition.toUpperCase();
  const isForward = positions.some((position) => ['C', 'LW', 'RW', 'W', 'F'].includes(position));
  const isSkater = positions.some((position) => position !== 'G');

  if (slot === 'F') return isForward;
  if (slot === 'W') return positions.some((position) => ['LW', 'RW', 'W'].includes(position));
  if (['UTIL', 'U', 'FLEX'].includes(slot)) return isSkater;
  return positions.includes(slot);
}

interface DayAssignment {
  projection: PlayerProjection;
  slot: string;
}

interface DayResult {
  points: number;
  assignments: DayAssignment[];
}

function isBetterDayResult(candidate: DayResult, current: DayResult): boolean {
  if (candidate.points > current.points + Number.EPSILON) return true;
  if (Math.abs(candidate.points - current.points) <= Number.EPSILON) {
    if (candidate.assignments.length !== current.assignments.length) {
      return candidate.assignments.length > current.assignments.length;
    }
    const candidateKey = candidate.assignments.map(({ projection, slot }) => `${projection.base.id}:${slot}`).join('|');
    const currentKey = current.assignments.map(({ projection, slot }) => `${projection.base.id}:${slot}`).join('|');
    return candidateKey < currentKey;
  }
  return false;
}

/**
 * Finds the maximum projected-points legal lineup for one date. The state is
 * slot capacity rather than a greedy player order, so multi-position and flex
 * choices cannot strand a more limited teammate.
 */
function solveDay(players: PlayerProjection[], slotTypes: string[], initialCapacity: number[]): DayResult {
  const eligible = players
    .map((projection) => ({
      projection,
      slots: slotTypes.filter((slot) => isEligibleForPosition(projection.base.position, slot)),
    }))
    .filter(({ slots }) => slots.length > 0)
    .sort((a, b) => b.projection.fppg - a.projection.fppg || a.projection.base.id.localeCompare(b.projection.base.id));
  const slotIndex = new Map(slotTypes.map((slot, index) => [slot, index]));
  const memo = new Map<string, DayResult>();

  const solve = (playerIndex: number, remaining: number[]): DayResult => {
    if (playerIndex >= eligible.length) return { points: 0, assignments: [] };
    const key = `${playerIndex}|${remaining.join(',')}`;
    const cached = memo.get(key);
    if (cached) return cached;

    let best = solve(playerIndex + 1, remaining);
    const current = eligible[playerIndex];
    current.slots.forEach((slot) => {
      const index = slotIndex.get(slot);
      if (index === undefined || remaining[index] <= 0) return;
      const nextRemaining = [...remaining];
      nextRemaining[index] -= 1;
      const next = solve(playerIndex + 1, nextRemaining);
      const candidate: DayResult = {
        points: current.projection.fppg + next.points,
        assignments: [{ projection: current.projection, slot }, ...next.assignments],
      };
      if (isBetterDayResult(candidate, best)) best = candidate;
    });

    memo.set(key, best);
    return best;
  };

  return solve(0, initialCapacity);
}

export function simulateLineup(
  projections: PlayerProjection[],
  window: DateWindow,
  lineupSlots: Record<string, number>,
): SimulationResult {
  const startsByPlayer = new Map<string, number>();
  const startRecords: SimulationStartRecord[] = [];
  const benchRecords: SimulationBenchRecord[] = [];
  const unusedSlotsByDate = new Map<string, Record<string, number>>();
  let totalPoints = 0;

  const activeSlots = Object.entries(lineupSlots)
    .filter(([slot, count]) => count > 0 && Number.isFinite(count) && !INACTIVE_SLOTS.has(slot.toUpperCase()))
    .map(([slot, count]) => ({ slot, count: Number(count) }));
  const slotTypes = activeSlots.map(({ slot }) => slot);
  const initialCapacity = activeSlots.map(({ count }) => count);

  buildDateRange(window).forEach((date) => {
    const playersWithGames = projections.filter((projection) => {
      const savedSlot = projection.base.current_slot?.toUpperCase() ?? '';
      return !['IR', 'IR+', 'IR-LT', 'NA'].includes(savedSlot) && projection.upcomingGamesInWindow.includes(date);
    });
    const result = solveDay(playersWithGames, slotTypes, initialCapacity);
    const startedIds = new Set(result.assignments.map(({ projection }) => projection.base.id));
    const usedBySlot = new Map<string, number>();

    result.assignments.forEach(({ projection, slot }) => {
      totalPoints += projection.fppg;
      startsByPlayer.set(projection.base.id, (startsByPlayer.get(projection.base.id) ?? 0) + 1);
      usedBySlot.set(slot, (usedBySlot.get(slot) ?? 0) + 1);
      startRecords.push({
        playerId: projection.base.id,
        playerName: projection.base.full_name,
        position: slot,
        date,
        fppg: projection.fppg,
      });
    });

    playersWithGames
      .filter((projection) => !startedIds.has(projection.base.id))
      .forEach((projection) => {
        const record: SimulationBenchRecord = {
          playerId: projection.base.id,
          playerName: projection.base.full_name,
          position: normalizePositions(projection.base.position)[0] ?? 'BN',
          date,
          fppg: projection.fppg,
          reason: 'slot_filled',
        };
        benchRecords.push(record);
      });

    const unusedSlots: Record<string, number> = {};
    activeSlots.forEach(({ slot, count }) => {
      const remaining = count - (usedBySlot.get(slot) ?? 0);
      if (remaining > 0) unusedSlots[slot] = remaining;
    });
    unusedSlotsByDate.set(date, unusedSlots);
  });

  return {
    totalPoints: Number(totalPoints.toFixed(2)),
    startsByPlayer,
    startRecords,
    benchRecords,
    unusedSlotsByDate,
  };
}
