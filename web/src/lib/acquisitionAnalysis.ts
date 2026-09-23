import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace } from './leagueWorkspace';
import { isUnavailableRosterSlot } from './rosterEligibility';

export interface AddDropRecommendation {
  candidate: RosterPlayer;
  drop: RosterPlayer;
  projectedPointsDelta: number;
  startsDelta: number;
  gamesDelta: number;
  dropCost: number;
  dropStarts: number;
  candidateStarts: number;
  candidateGames: number;
  candidateCongestionGames: number;
  candidateStartDates: string[];
  candidateBlockedDates: string[];
}

export interface LineupResult {
  points: number;
  starts: number;
  startDatesByPlayer: Record<string, string[]>;
}

const INACTIVE_SLOTS = new Set(['BN', 'BENCH', 'IR', 'IR+', 'IR-LT', 'NA']);

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function projectionFor(projections: Record<string, PlayerProjection>, playerId: string): PlayerProjection | undefined {
  return projections[playerId] ?? projections[normalizeId(playerId)] ?? projections[`nhl:${normalizeId(playerId)}`];
}

function isForwardPosition(position: string): boolean {
  return ['C', 'LW', 'RW', 'W', 'F'].includes(position.toUpperCase());
}

export function canFillSlot(player: RosterPlayer, rawSlot: string): boolean {
  const slot = rawSlot.toUpperCase();
  const positions = player.positions.map((position) => position.toUpperCase());
  if (positions.includes(slot)) return true;
  if ((slot === 'LW' || slot === 'RW' || slot === 'W') && positions.includes('W')) return true;
  if (slot === 'W') return positions.some((position) => position === 'LW' || position === 'RW');
  if (slot === 'F') return positions.some(isForwardPosition);
  if (['UTIL', 'U', 'FLEX'].includes(slot)) return positions.some((position) => position !== 'G');
  return false;
}

export function activeSlotCapacities(workspace: LeagueWorkspace): Record<string, number> {
  return Object.fromEntries(Object.entries(workspace.rosterRules.slots)
    .filter(([slot, count]) => count > 0 && !INACTIVE_SLOTS.has(slot.toUpperCase())));
}

function hasGameOnDate(projection: PlayerProjection | undefined, date: string): boolean {
  return Boolean(projection?.gamesByDate?.[date]);
}

function gameDatesFor(projection: PlayerProjection | undefined): string[] {
  return Object.keys(projection?.gamesByDate ?? {}).sort();
}

interface LineupCandidate { player: RosterPlayer; value: number; slots: string[] }

/**
 * Best lineup: which players fill the active slots for the most value. Lineup slots
 * form a transversal matroid, so taking players best-first and keeping each one who
 * can still be seated (moving others between their eligible slots via an augmenting
 * path) is optimal. Microseconds per solve; the exhaustive search it replaced took
 * about 1.4ms per day, which froze pages evaluating many pickups over a season.
 */
function solveLineup(available: LineupCandidate[], slotTypes: string[], capacities: Record<string, number>): string[] {
  const units = slotTypes.flatMap((slot) => Array.from({ length: capacities[slot] ?? 0 }, () => slot));
  const seatedIn: Array<number | null> = units.map(() => null);
  const eligible = available.map((item) => units.map((slot) => item.slots.includes(slot)));
  const seat = (index: number, visited: boolean[]): boolean => {
    for (let unit = 0; unit < units.length; unit += 1) {
      if (!eligible[index][unit] || visited[unit]) continue;
      visited[unit] = true;
      const occupant = seatedIn[unit];
      if (occupant === null || seat(occupant, visited)) {
        seatedIn[unit] = index;
        return true;
      }
    }
    return false;
  };
  const selected: string[] = [];
  // Callers pass players sorted best-first; negative values never help a lineup.
  available.forEach((item, index) => {
    if (item.value < 0) return;
    if (seat(index, units.map(() => false))) selected.push(item.player.id);
  });
  return selected;
}

function mondayOf(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
}

/**
 * Finds the highest-scoring legal daily lineup. This intentionally re-solves the
 * whole roster for every date so bench players, multi-position eligibility and
 * flex slots are handled as lineup choices rather than fixed saved slots.
 */
export function simulateDailyLineup(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  projections: Record<string, PlayerProjection>,
  datesOverride?: string[],
): LineupResult {
  const slotCapacities = activeSlotCapacities(workspace);
  const slotTypes = Object.keys(slotCapacities).sort();
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  const eligibleRoster = roster.filter((player) => {
    const savedSlot = (entryById.get(normalizeId(player.id))?.slot ?? player.current_slot ?? '').toUpperCase();
    return !isUnavailableRosterSlot(savedSlot);
  });
  const dates = datesOverride ?? [...new Set(eligibleRoster.flatMap((player) => gameDatesFor(projectionFor(projections, player.id))))].sort();
  const startDatesByPlayer: Record<string, string[]> = {};
  let points = 0;
  let starts = 0;

  if (workspace.rosterRules.lockingMode === 'weekly') {
    const periods = new Map<string, string[]>();
    dates.forEach((date) => (periods.get(mondayOf(date)) ?? (periods.set(mondayOf(date), []), periods.get(mondayOf(date))!)).push(date));
    for (const periodDates of periods.values()) {
      const available = eligibleRoster.map((player) => {
        const projection = projectionFor(projections, player.id);
        const games = periodDates.filter((date) => hasGameOnDate(projection, date)).length;
        return { player, value: (projection?.fppg ?? 0) * games, slots: slotTypes.filter((slot) => canFillSlot(player, slot)) };
      }).filter((item) => item.value > 0 && item.slots.length > 0)
        .sort((a, b) => b.value - a.value || a.player.id.localeCompare(b.player.id));
      const selectedIds = solveLineup(available, slotTypes, slotCapacities);
      selectedIds.forEach((playerId) => {
        const projection = projectionFor(projections, playerId);
        periodDates.filter((date) => hasGameOnDate(projection, date)).forEach((date) => {
          points += projection?.fppg ?? 0;
          starts += 1;
          (startDatesByPlayer[normalizeId(playerId)] ??= []).push(date);
        });
      });
    }
    return { points, starts, startDatesByPlayer };
  }

  dates.forEach((date) => {
    const available = eligibleRoster
      .filter((player) => hasGameOnDate(projectionFor(projections, player.id), date))
      .map((player) => ({
        player,
        value: projectionFor(projections, player.id)?.fppg ?? 0,
        slots: slotTypes.filter((slot) => canFillSlot(player, slot)),
      }))
      .filter((item) => item.slots.length > 0)
      .sort((a, b) => b.value - a.value || a.player.id.localeCompare(b.player.id));

    const selectedIds = solveLineup(available, slotTypes, slotCapacities);
    points += selectedIds.reduce((total, playerId) => total + (projectionFor(projections, playerId)?.fppg ?? 0), 0);
    starts += selectedIds.length;
    selectedIds.forEach((playerId) => {
      (startDatesByPlayer[normalizeId(playerId)] ??= []).push(date);
    });
  });

  return { points, starts, startDatesByPlayer };
}

export function rankAddDropPairs(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  candidates: RosterPlayer[],
  projections: Record<string, PlayerProjection>,
): AddDropRecommendation[] {
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  const droppable = roster.filter((player) => {
    const entry = entryById.get(normalizeId(player.id));
    const slot = (entry?.slot ?? player.current_slot ?? '').toUpperCase();
    return !entry?.keeper && !entry?.protected && !entry?.undroppable && !isUnavailableRosterSlot(slot);
  });
  const baseline = simulateDailyLineup(workspace, roster, projections);

  return candidates.flatMap((candidate) => droppable.map((drop): AddDropRecommendation | null => {
    const candidateProjection = projectionFor(projections, candidate.id);
    const dropProjection = projectionFor(projections, drop.id);
    if (!candidateProjection || !dropProjection || !candidateProjection.gamesByDate || !dropProjection.gamesByDate) return null;

    const postSwapRoster = [...roster.filter((player) => normalizeId(player.id) !== normalizeId(drop.id)), candidate];
    const postSwap = simulateDailyLineup(workspace, postSwapRoster, projections);
    const candidateDates = gameDatesFor(candidateProjection);
    const candidateStartDates = postSwap.startDatesByPlayer[normalizeId(candidate.id)] ?? [];
    const candidateStartSet = new Set(candidateStartDates);
    const dropStartDates = baseline.startDatesByPlayer[normalizeId(drop.id)] ?? [];

    return {
      candidate,
      drop,
      projectedPointsDelta: postSwap.points - baseline.points,
      startsDelta: postSwap.starts - baseline.starts,
      gamesDelta: candidateDates.length - gameDatesFor(dropProjection).length,
      dropCost: dropStartDates.length * dropProjection.fppg,
      dropStarts: dropStartDates.length,
      candidateStarts: candidateStartDates.length,
      candidateGames: candidateDates.length,
      candidateCongestionGames: candidateDates.length - candidateStartDates.length,
      candidateStartDates,
      candidateBlockedDates: candidateDates.filter((date) => !candidateStartSet.has(date)),
    };
  }).filter((recommendation): recommendation is AddDropRecommendation => Boolean(recommendation)))
    .sort((a, b) =>
      b.projectedPointsDelta - a.projectedPointsDelta ||
      b.startsDelta - a.startsDelta ||
      a.dropCost - b.dropCost ||
      a.candidate.full_name.localeCompare(b.candidate.full_name));
}
