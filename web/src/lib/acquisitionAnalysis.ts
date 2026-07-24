import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace } from './leagueWorkspace';

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

function canFillSlot(player: RosterPlayer, rawSlot: string): boolean {
  const slot = rawSlot.toUpperCase();
  const positions = player.positions.map((position) => position.toUpperCase());
  if (positions.includes(slot)) return true;
  if ((slot === 'LW' || slot === 'RW' || slot === 'W') && positions.includes('W')) return true;
  if (slot === 'W') return positions.some((position) => position === 'LW' || position === 'RW');
  if (slot === 'F') return positions.some(isForwardPosition);
  if (['UTIL', 'U', 'FLEX'].includes(slot)) return positions.some((position) => position !== 'G');
  return false;
}

function activeSlotCapacities(workspace: LeagueWorkspace): Record<string, number> {
  return Object.fromEntries(Object.entries(workspace.rosterRules.slots)
    .filter(([slot, count]) => count > 0 && !INACTIVE_SLOTS.has(slot.toUpperCase())));
}

function hasGameOnDate(projection: PlayerProjection | undefined, date: string): boolean {
  return Boolean(projection?.gamesByDate?.[date]);
}

function gameDatesFor(projection: PlayerProjection | undefined): string[] {
  return Object.keys(projection?.gamesByDate ?? {}).sort();
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
    return !['IR', 'IR+', 'IR-LT', 'NA'].includes(savedSlot);
  });
  const dates = datesOverride ?? [...new Set(eligibleRoster.flatMap((player) => gameDatesFor(projectionFor(projections, player.id))))].sort();
  const startDatesByPlayer: Record<string, string[]> = {};
  let points = 0;
  let starts = 0;

  dates.forEach((date) => {
    const available = eligibleRoster
      .filter((player) => hasGameOnDate(projectionFor(projections, player.id), date))
      .map((player) => ({
        player,
        fppg: projectionFor(projections, player.id)?.fppg ?? 0,
        slots: slotTypes.filter((slot) => canFillSlot(player, slot)),
      }))
      .filter((item) => item.slots.length > 0)
      .sort((a, b) => b.fppg - a.fppg || a.player.id.localeCompare(b.player.id));

    type DayResult = { points: number; playerIds: string[] };
    const memo = new Map<string, DayResult>();
    const solve = (index: number, remaining: number[]): DayResult => {
      if (index >= available.length) return { points: 0, playerIds: [] };
      const key = `${index}|${remaining.join(',')}`;
      const cached = memo.get(key);
      if (cached) return cached;
      let best = solve(index + 1, remaining);
      available[index].slots.forEach((slot) => {
        const slotIndex = slotTypes.indexOf(slot);
        if (remaining[slotIndex] <= 0) return;
        const nextRemaining = [...remaining];
        nextRemaining[slotIndex] -= 1;
        const next = solve(index + 1, nextRemaining);
        const candidate: DayResult = {
          points: available[index].fppg + next.points,
          playerIds: [available[index].player.id, ...next.playerIds],
        };
        if (candidate.points > best.points || (candidate.points === best.points && candidate.playerIds.length > best.playerIds.length)) best = candidate;
      });
      memo.set(key, best);
      return best;
    };

    const result = solve(0, slotTypes.map((slot) => slotCapacities[slot]));
    points += result.points;
    starts += result.playerIds.length;
    result.playerIds.forEach((playerId) => {
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
    return !entry?.keeper && !entry?.protected && !entry?.undroppable && !['IR', 'IR+', 'IR-LT', 'NA'].includes(slot);
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
