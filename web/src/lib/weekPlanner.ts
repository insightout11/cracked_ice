import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { activeSlotCapacities, canFillSlot, simulateDailyLineup } from './acquisitionAnalysis';
import {
  acquisitionMovesRemaining,
  irEligibleStatuses,
  planningWeek,
  type LeagueWorkspace,
  type PlanningWeek,
} from './leagueWorkspace';

/**
 * Weekly transaction planner.
 *
 * The roster has a fixed number of places a streamer can go ("spots"):
 * - open: an empty roster place;
 * - ir: a place freed by moving an injured player to an IR slot (a free move);
 * - stream: a player the owner marked OK to drop, dropped when the spot is first used.
 * Each spot holds a sequence of adds through the matchup week (pick up a Tue/Wed
 * player, swap for Thursday, then Fri/Sun...). Every add uses one of the league's
 * remaining adds; drops and IR moves are free. The objective is league fantasy points:
 * each day's best legal lineup is re-solved with the roster of that day, so a streamer
 * only counts on nights he would actually start. The last add in each spot also
 * carries into next week, valued at CARRY_OVER_WEIGHT because that spot can be
 * streamed again next week.
 */

const IR_SLOTS = new Set(['IR', 'IR+', 'IR-LT']);
const INACTIVE_SLOTS = new Set([...IR_SLOTS, 'NA']);
/** Yahoo statuses meaning a player will not play this week. Day-to-day players may. */
const OUT_STATUSES = new Set(['IR', 'IR-LT', 'O', 'NA', 'SUSP']);
export const CARRY_OVER_WEIGHT = 0.5;
const MAX_POOL = 18;
const MAX_ADDS = 6;

export type PlannerSpotKind = 'open' | 'ir' | 'stream';

export interface PlannerSpot {
  id: string;
  kind: PlannerSpotKind;
  /** The injured player moved to IR, or the player dropped for a streamer. */
  holder: RosterPlayer | null;
  /** The holder is expected to play this week, so using the spot costs his games. */
  holderPlays: boolean;
}

export interface PlannerCandidate {
  player: RosterPlayer;
  /** Marked available in the league; otherwise availability still needs checking. */
  confirmed: boolean;
}

export interface PlannedAdd {
  spotId: string;
  add: RosterPlayer;
  /** The previous streamer in the spot, or the spot's holder for a first add in a stream spot. */
  drop: RosterPlayer | null;
  actionDate: string;
  effectiveDate: string;
  confirmed: boolean;
  /** Lineup starts and points this add earns this week in the plan. */
  starts: number;
  points: number;
  /** He is still in the spot at the end of the week. */
  carriesOver: boolean;
  nextWeekGames: number;
}

export interface PlannedIrMove {
  player: RosterPlayer;
  status: string;
  spotId: string;
  holderPlays: boolean;
}

export interface WeekPlanDay {
  date: string;
  baselinePoints: number;
  plannedPoints: number;
  baselineStarts: number;
  plannedStarts: number;
  adds: PlannedAdd[];
}

export interface WeekPlan {
  addCount: number;
  adds: PlannedAdd[];
  irMoves: PlannedIrMove[];
  points: number;
  starts: number;
  /** Points gained this week over making no moves. */
  gain: number;
  startsGain: number;
  /** Points the added players score in the plan's lineups. */
  pickupPoints: number;
  /** Points the dropped (or IR'd) players would have scored in the no-move lineups after they leave. */
  droppedPoints: number;
  /** Weighted next-week value of the players still in their spots, net of any dropped player's next week. */
  carryOver: number;
  /** gain + carryOver: what the planner ranks by. */
  score: number;
  daily: WeekPlanDay[];
}

export interface IrSuggestion {
  player: RosterPlayer;
  status: string;
  /** He may play this week (day-to-day), so moving him costs his games. */
  holderPlays: boolean;
}

export interface WeekPlannerResult {
  week: PlanningWeek;
  planDates: string[];
  addsRemaining: number | null;
  maxAdds: number;
  transactionDelay: number;
  spots: PlannerSpot[];
  irSuggestions: IrSuggestion[];
  /** IR-eligible players who don't fit: every IR slot is full. */
  irOverflow: IrSuggestion[];
  streamSuggestions: RosterPlayer[];
  baseline: { points: number; starts: number };
  /** plans[k] is the best plan found using k adds; plans[0] is making no moves. */
  plans: WeekPlan[];
  /** Runner-up plans per add count, for when the first target is taken. */
  alternatives: Record<number, WeekPlan[]>;
  warnings: string[];
  assumptions: string[];
}

export interface WeekPlannerOptions {
  now?: string | number | Date;
  includeGoalies?: boolean;
  /** Stream spots to use instead of the ones saved on the roster. */
  streamSpotIds?: string[];
  maxAdds?: number;
  beamWidth?: number;
}

interface Stint {
  spotId: string;
  add: RosterPlayer;
  from: string;
  actionDate: string;
  confirmed: boolean;
}

interface Evaluation {
  points: number;
  starts: number;
  /** Per plan date: lineup points, starts, and who started (normalized ids). */
  daily: Array<{ date: string; points: number; starts: number; started: string[] }>;
}

interface State {
  stints: Stint[];
  evaluation: Evaluation;
  carryOver: number;
  score: number;
}

const normalizeId = (id: string) => id.replace(/^nhl:/, '');

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function projectionFor(projections: Record<string, PlayerProjection>, playerId: string): PlayerProjection | undefined {
  const id = normalizeId(playerId);
  return projections[playerId] ?? projections[id] ?? projections[`nhl:${id}`];
}

function gamesBetween(projection: PlayerProjection | undefined, start: string, end: string): string[] {
  return Object.keys(projection?.gamesByDate ?? {}).filter((date) => date >= start && date <= end).sort();
}

function isGoalie(player: RosterPlayer): boolean {
  return player.positions.length > 0 && player.positions.every((position) => position.toUpperCase() === 'G');
}

function injuryStatus(player: RosterPlayer): string | null {
  return player.injuryStatus ? player.injuryStatus.toUpperCase() : null;
}

function isOut(player: RosterPlayer): boolean {
  const status = injuryStatus(player);
  return status !== null && OUT_STATUSES.has(status);
}

/** Season value used to pick which players are the weakest to stream: FPPG, best estimate first. */
export function seasonValue(player: RosterPlayer, projections: Record<string, PlayerProjection>): number {
  return player.blendedFppg ?? player.seasonFppg ?? projectionFor(projections, player.id)?.fppg ?? 0;
}

/**
 * Players the owner drafted in the first half of their picks. The planner never
 * suggests streaming them (a slow start is not a reason to drop an early pick).
 */
export function earlyDraftPickIds(workspace: LeagueWorkspace): Set<string> {
  const mine = workspace.draftSession.picks
    .filter((pick) => pick.status === 'mine' && pick.overallPick)
    .sort((a, b) => (a.overallPick ?? 0) - (b.overallPick ?? 0));
  return new Set(mine.slice(0, Math.ceil(mine.length / 2)).map((pick) => normalizeId(pick.playerId)));
}

/**
 * The best lineup for one day: which of `players` (all with a game that day) start.
 * Lineup slots form a transversal matroid, so taking players best-first and keeping
 * each one who can still be seated (via an augmenting path) is optimal. Same result
 * as simulateDailyLineup for a day, much faster; the planner solves thousands of days.
 */
export function bestDailyLineup(
  workspace: LeagueWorkspace,
  players: RosterPlayer[],
  fppgOf: (player: RosterPlayer) => number,
): { points: number; started: RosterPlayer[] } {
  const units = Object.entries(activeSlotCapacities(workspace)).flatMap(([slot, count]) => Array.from({ length: count }, () => slot));
  const seatedIn: Array<number | null> = units.map(() => null);
  const ordered = players
    .map((player) => ({ player, value: fppgOf(player) }))
    .filter((item) => item.value >= 0)
    .sort((a, b) => b.value - a.value || normalizeId(a.player.id).localeCompare(normalizeId(b.player.id)));
  const fits = ordered.map(({ player }) => units.map((slot) => canFillSlot(player, slot)));
  const seat = (index: number, visited: boolean[]): boolean => {
    for (let unit = 0; unit < units.length; unit += 1) {
      if (!fits[index][unit] || visited[unit]) continue;
      visited[unit] = true;
      const occupant = seatedIn[unit];
      if (occupant === null || seat(occupant, visited)) {
        seatedIn[unit] = index;
        return true;
      }
    }
    return false;
  };
  const started: RosterPlayer[] = [];
  let points = 0;
  ordered.forEach((item, index) => {
    if (seat(index, units.map(() => false))) {
      started.push(item.player);
      points += item.value;
    }
  });
  return { points, started };
}

export function planWeek(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  candidates: PlannerCandidate[],
  projections: Record<string, PlayerProjection>,
  options: WeekPlannerOptions = {},
): WeekPlannerResult {
  const now = options.now ?? Date.now();
  const week = planningWeek(workspace, now);
  const planDates = datesBetween(week.firstPlanDate, week.end);
  const weekly = workspace.rosterRules.lockingMode === 'weekly';
  const includeGoalies = options.includeGoalies ?? false;
  const warnings: string[] = [];

  // Adds: a week that hasn't started yet has its full limit.
  const addsRemaining = workspace.acquisitions.limit !== null && workspace.acquisitions.period !== 'season' && week.start > week.today
    ? workspace.acquisitions.limit
    : acquisitionMovesRemaining(workspace, now);
  const maxAdds = Math.max(0, Math.min(options.maxAdds ?? MAX_ADDS, addsRemaining ?? 4, MAX_ADDS));
  const transactionDelay = (workspace.acquisitions.addTiming === 'next-day' ? 1 : 0)
    + (workspace.acquisitions.pickupMethod === 'waivers' ? workspace.acquisitions.waiverDelayDays : 0);

  // Roster places.
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  const slotOf = (player: RosterPlayer) => (entryById.get(normalizeId(player.id))?.slot ?? player.current_slot ?? '').toUpperCase();
  const slotCounts = Object.entries(workspace.rosterRules.slots);
  const irCapacity = slotCounts.filter(([slot]) => IR_SLOTS.has(slot.toUpperCase())).reduce((sum, [, count]) => sum + count, 0);
  const activeCapacity = slotCounts.filter(([slot]) => !INACTIVE_SLOTS.has(slot.toUpperCase())).reduce((sum, [, count]) => sum + count, 0);
  const onIr = roster.filter((player) => IR_SLOTS.has(slotOf(player)));
  const active = roster.filter((player) => !INACTIVE_SLOTS.has(slotOf(player)));
  const openCount = Math.max(0, activeCapacity - active.length);
  if (active.length > activeCapacity) warnings.push(`Your roster has ${active.length} players for ${activeCapacity} places outside IR. Move someone to IR or drop a player first.`);

  const protectedPlayer = (player: RosterPlayer) => {
    const entry = entryById.get(normalizeId(player.id));
    return Boolean(entry?.keeper || entry?.protected || entry?.undroppable);
  };

  // IR moves: out players first (free), day-to-day last (costs their games if they play).
  const eligible = new Set(irEligibleStatuses(workspace).map((status) => status.toUpperCase()));
  const irCandidates: IrSuggestion[] = active
    .filter((player) => {
      const status = injuryStatus(player);
      return status !== null && eligible.has(status);
    })
    .map((player) => ({ player, status: injuryStatus(player) as string, holderPlays: !isOut(player) }))
    .sort((a, b) => Number(a.holderPlays) - Number(b.holderPlays) || seasonValue(a.player, projections) - seasonValue(b.player, projections));
  const irFree = Math.max(0, irCapacity - onIr.length);
  const irSuggestions = irCandidates.slice(0, irFree);
  const irOverflow = irCandidates.slice(irFree);

  // Stream spots: the owner's choice, never a keeper, protected or undroppable player.
  const irIds = new Set(irSuggestions.map((item) => normalizeId(item.player.id)));
  const chosenStreamIds = new Set((options.streamSpotIds ?? workspace.roster.filter((entry) => entry.streamSpot).map((entry) => entry.playerId)).map(normalizeId));
  const streamHolders = active.filter((player) => chosenStreamIds.has(normalizeId(player.id)) && !protectedPlayer(player) && !irIds.has(normalizeId(player.id)));

  const earlyPicks = earlyDraftPickIds(workspace);
  const streamSuggestions = active
    .filter((player) => !chosenStreamIds.has(normalizeId(player.id))
      && !protectedPlayer(player)
      && !earlyPicks.has(normalizeId(player.id))
      && !injuryStatus(player)
      && (includeGoalies || !isGoalie(player)))
    .sort((a, b) => seasonValue(a, projections) - seasonValue(b, projections) || a.full_name.localeCompare(b.full_name))
    .slice(0, 3);

  const spots: PlannerSpot[] = [
    ...Array.from({ length: openCount }, (_, index): PlannerSpot => ({ id: `open-${index + 1}`, kind: 'open', holder: null, holderPlays: false })),
    ...irSuggestions.map((item): PlannerSpot => ({ id: `ir-${normalizeId(item.player.id)}`, kind: 'ir', holder: item.player, holderPlays: item.holderPlays })),
    ...streamHolders.map((player): PlannerSpot => ({ id: `stream-${normalizeId(player.id)}`, kind: 'stream', holder: player, holderPlays: !isOut(player) })),
  ];
  const spotById = new Map(spots.map((spot) => [spot.id, spot]));
  // Spots that cost nothing to use are interchangeable: only the first empty one is tried.
  const isFree = (spot: PlannerSpot) => !spot.holderPlays;

  // Players who can be in a lineup this week: not in IR/NA slots and not out.
  const lineupBase = active.filter((player) => !isOut(player));

  // Candidate pool: unrostered, healthy, with games left this week.
  const rosterIds = new Set(roster.map((player) => normalizeId(player.id)));
  const lastEffectiveDate = weekly ? week.start : week.end;
  const firstEffectiveDate = [week.firstPlanDate, addDays(week.today, transactionDelay)].sort()[1];
  const pool = candidates
    .filter(({ player }) => !rosterIds.has(normalizeId(player.id)) && !injuryStatus(player) && (includeGoalies || !isGoalie(player)))
    .map((candidate) => {
      const projection = projectionFor(projections, candidate.player.id);
      const dates = gamesBetween(projection, firstEffectiveDate, week.end);
      return { ...candidate, projection, dates, value: (projection?.fppg ?? 0) * dates.length };
    })
    .filter((candidate) => candidate.projection && candidate.dates.length > 0)
    // Confirmed players first, then the best of the rest, up to the search cap.
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.value - a.value)
    .slice(0, MAX_POOL);

  // Lineup evaluation, cached per day by the players who play that day (no one else
  // can change that day's lineup, so most rosters in the search share a result).
  const dayCache = new Map<string, { points: number; starts: number; started: string[] }>();
  const solveDay = (date: string, roster: RosterPlayer[]) => {
    const players = roster.filter((player) => projectionFor(projections, player.id)?.gamesByDate?.[date]);
    const key = `${date}|${players.map((player) => normalizeId(player.id)).sort().join(',')}`;
    let result = dayCache.get(key);
    if (!result) {
      const lineup = bestDailyLineup(workspace, players, (player) => projectionFor(projections, player.id)?.fppg ?? 0);
      result = { points: lineup.points, starts: lineup.started.length, started: lineup.started.map((player) => normalizeId(player.id)) };
      dayCache.set(key, result);
    }
    return result;
  };

  const rosterOn = (date: string, stints: Stint[]): RosterPlayer[] => {
    const removed = new Set<string>();
    const added: RosterPlayer[] = [];
    spots.forEach((spot) => {
      const spotStints = stints.filter((stint) => stint.spotId === spot.id);
      if (!spotStints.length || spotStints[0].from > date) return;
      if (spot.holder) removed.add(normalizeId(spot.holder.id));
      const current = spotStints.filter((stint) => stint.from <= date).pop();
      if (current) added.push(current.add);
    });
    return [...lineupBase.filter((player) => !removed.has(normalizeId(player.id))), ...added];
  };

  /** Lineups for every plan date. A new add changes nothing before its date, so those days are reused from the parent plan. */
  const evaluate = (stints: Stint[], parent?: Evaluation, changedFrom?: string): Evaluation => {
    if (weekly) {
      const lineup = simulateDailyLineup(workspace, rosterOn(week.start, stints), projections, planDates);
      const daily = planDates.map((date) => {
        const started = Object.entries(lineup.startDatesByPlayer).filter(([, dates]) => dates.includes(date)).map(([id]) => id);
        return { date, points: started.reduce((sum, id) => sum + (projectionFor(projections, id)?.fppg ?? 0), 0), starts: started.length, started };
      });
      return { points: lineup.points, starts: lineup.starts, daily };
    }
    const daily = planDates.map((date, index) => {
      if (parent && changedFrom && date < changedFrom) return parent.daily[index];
      const day = solveDay(date, rosterOn(date, stints));
      return { date, points: day.points, starts: day.starts, started: day.started };
    });
    return {
      points: daily.reduce((sum, day) => sum + day.points, 0),
      starts: daily.reduce((sum, day) => sum + day.starts, 0),
      daily,
    };
  };
  const startDatesOf = (evaluation: Evaluation, playerId: string) => {
    const id = normalizeId(playerId);
    return evaluation.daily.filter((day) => day.started.includes(id)).map((day) => day.date);
  };

  const nextWeekPoints = (player: RosterPlayer) => {
    const projection = projectionFor(projections, player.id);
    return (projection?.fppg ?? 0) * gamesBetween(projection, week.nextStart, week.nextEnd).length;
  };
  const carryOverOf = (stints: Stint[]) => spots.reduce((total, spot) => {
    const last = stints.filter((stint) => stint.spotId === spot.id).pop();
    if (!last) return total;
    const lost = spot.kind === 'stream' && spot.holder ? nextWeekPoints(spot.holder) : 0;
    return total + CARRY_OVER_WEIGHT * (nextWeekPoints(last.add) - lost);
  }, 0);

  const baselineEvaluation = evaluate([]);
  const makeState = (stints: Stint[], parent: State, changedFrom: string): State => {
    const evaluation = evaluate(stints, parent.evaluation, changedFrom);
    const carryOver = carryOverOf(stints);
    return { stints, evaluation, carryOver, score: evaluation.points - baselineEvaluation.points + carryOver };
  };

  // Free spots are interchangeable, so plans that differ only in which free spot holds
  // a streamer sequence are the same plan.
  const stateKey = (stints: Stint[]) => spots
    .map((spot) => {
      const sequence = stints.filter((stint) => stint.spotId === spot.id).map((stint) => `${normalizeId(stint.add.id)}@${stint.from}`).join('>');
      return sequence ? `${isFree(spot) ? 'free' : spot.id}:${sequence}` : '';
    })
    .filter(Boolean)
    .sort()
    .join('|');

  /** Puts streamer sequences in free spots in a stable order, so every plan suggests the same IR moves first. */
  const freeSpots = spots.filter(isFree);
  const canonicalStints = (stints: Stint[]): Stint[] => {
    const used = freeSpots
      .map((spot) => stints.filter((stint) => stint.spotId === spot.id))
      .filter((sequence) => sequence.length)
      .sort((a, b) => a[0].from.localeCompare(b[0].from) || a[0].add.full_name.localeCompare(b[0].add.full_name));
    const relabel = new Map(used.map((sequence, index) => [sequence[0].spotId, freeSpots[index].id]));
    return stints.map((stint) => (relabel.has(stint.spotId) ? { ...stint, spotId: relabel.get(stint.spotId) as string } : stint));
  };

  const toPlan = (rawState: State): WeekPlan => {
    const state = { ...rawState, stints: canonicalStints(rawState.stints) };
    const ordered = [...state.stints].sort((a, b) => a.from.localeCompare(b.from) || a.spotId.localeCompare(b.spotId));
    const adds: PlannedAdd[] = ordered.map((stint) => {
      const spot = spotById.get(stint.spotId) as PlannerSpot;
      const spotStints = state.stints.filter((item) => item.spotId === stint.spotId).sort((a, b) => a.from.localeCompare(b.from));
      const index = spotStints.indexOf(stint);
      const until = spotStints[index + 1]?.from;
      const startDates = startDatesOf(state.evaluation, stint.add.id)
        .filter((date) => date >= stint.from && (!until || date < until));
      const fppg = projectionFor(projections, stint.add.id)?.fppg ?? 0;
      return {
        spotId: stint.spotId,
        add: stint.add,
        drop: index > 0 ? spotStints[index - 1].add : spot.kind === 'stream' ? spot.holder : null,
        actionDate: stint.actionDate,
        effectiveDate: stint.from,
        confirmed: stint.confirmed,
        starts: startDates.length,
        points: startDates.length * fppg,
        carriesOver: !until,
        nextWeekGames: gamesBetween(projectionFor(projections, stint.add.id), week.nextStart, week.nextEnd).length,
      };
    });
    const usedSpotIds = new Set(state.stints.map((stint) => stint.spotId));
    const irMoves = spots
      .filter((spot) => spot.kind === 'ir' && spot.holder && usedSpotIds.has(spot.id))
      .map((spot) => ({ player: spot.holder as RosterPlayer, status: injuryStatus(spot.holder as RosterPlayer) as string, spotId: spot.id, holderPlays: spot.holderPlays }));
    // What the players who leave (dropped or moved to IR) score in the no-move lineups after they go.
    const droppedPoints = spots.reduce((total, spot) => {
      const first = state.stints.filter((stint) => stint.spotId === spot.id).sort((a, b) => a.from.localeCompare(b.from))[0];
      if (!first || !spot.holder) return total;
      const dates = startDatesOf(baselineEvaluation, spot.holder.id).filter((date) => date >= first.from);
      return total + dates.length * (projectionFor(projections, spot.holder.id)?.fppg ?? 0);
    }, 0);
    return {
      addCount: state.stints.length,
      adds,
      irMoves,
      points: state.evaluation.points,
      starts: state.evaluation.starts,
      gain: state.evaluation.points - baselineEvaluation.points,
      startsGain: state.evaluation.starts - baselineEvaluation.starts,
      pickupPoints: adds.reduce((sum, add) => sum + add.points, 0),
      droppedPoints,
      carryOver: state.carryOver,
      score: state.score,
      daily: planDates.map((date, index) => ({
        date,
        baselinePoints: baselineEvaluation.daily[index]?.points ?? 0,
        plannedPoints: state.evaluation.daily[index]?.points ?? 0,
        baselineStarts: baselineEvaluation.daily[index]?.starts ?? 0,
        plannedStarts: state.evaluation.daily[index]?.starts ?? 0,
        adds: adds.filter((add) => add.effectiveDate === date),
      })),
    };
  };

  const baselineState: State = { stints: [], evaluation: baselineEvaluation, carryOver: 0, score: 0 };
  const plans: WeekPlan[] = [toPlan(baselineState)];
  const alternatives: Record<number, WeekPlan[]> = {};
  const beamWidth = Math.max(1, options.beamWidth ?? 10);
  let beam: State[] = [baselineState];

  for (let depth = 1; depth <= maxAdds && spots.length > 0 && pool.length > 0; depth += 1) {
    const next = new Map<string, State>();
    beam.forEach((state) => {
      const usedIds = new Set(state.stints.map((stint) => normalizeId(stint.add.id)));
      let triedEmptyFreeSpot = false;
      spots.forEach((spot) => {
        const spotStints = state.stints.filter((stint) => stint.spotId === spot.id);
        if (!spotStints.length && isFree(spot)) {
          if (triedEmptyFreeSpot) return;
          triedEmptyFreeSpot = true;
        }
        // Weekly lineups lock once, so each spot takes one add before the week starts.
        if (weekly && spotStints.length) return;
        const after = spotStints.length ? spotStints[spotStints.length - 1].from : null;
        pool.forEach((candidate) => {
          if (usedIds.has(normalizeId(candidate.player.id))) return;
          const dates = weekly ? (firstEffectiveDate <= week.start ? [week.start] : []) : candidate.dates;
          dates.forEach((from) => {
            if ((after && from <= after) || from > lastEffectiveDate) return;
            const stints = [...state.stints, {
              spotId: spot.id,
              add: candidate.player,
              from,
              actionDate: addDays(from, -transactionDelay),
              confirmed: candidate.confirmed,
            }];
            const key = stateKey(stints);
            if (!next.has(key)) next.set(key, makeState(stints, state, from));
          });
        });
      });
    });
    beam = [...next.values()]
      .sort((a, b) => b.score - a.score || b.evaluation.starts - a.evaluation.starts || stateKey(a.stints).localeCompare(stateKey(b.stints)))
      .slice(0, beamWidth);
    if (!beam.length) break;
    plans[depth] = toPlan(beam[0]);
    alternatives[depth] = beam.slice(1, 4).map(toPlan);
  }

  if (irOverflow.length) warnings.push(`${irOverflow.map((item) => item.player.full_name).join(', ')} could go to IR, but every IR slot is full.`);
  if (irSuggestions.some((item) => item.holderPlays)) warnings.push('Day-to-day players may play: the planner only uses their spot when a streamer beats them, and they need a roster place when they come back.');
  if (!spots.length) warnings.push('No roster place is free. Mark a player OK to stream, or move an injured player to IR.');

  const assumptions = [
    `${workspace.scoring.label} FPPG × games each player would start in your best daily lineup (${workspace.schedule.timezone}).`,
    transactionDelay === 0 ? 'Adds count the same day.' : `Adds count ${transactionDelay} day${transactionDelay === 1 ? '' : 's'} after you make them.`,
    addsRemaining === null ? 'No add limit set in League settings; comparing up to 4 adds.' : `${addsRemaining} add${addsRemaining === 1 ? '' : 's'} left this ${workspace.acquisitions.period === 'season' ? 'season' : 'week'}. Drops and IR moves are free.`,
    `A player still in his spot at week's end carries over; his next-week points count at ${Math.round(CARRY_OVER_WEIGHT * 100)}% because the spot can be streamed again.`,
    'Players you haven\'t marked available must be checked before each add.',
  ];

  return {
    week,
    planDates,
    addsRemaining,
    maxAdds,
    transactionDelay,
    spots,
    irSuggestions,
    irOverflow,
    streamSuggestions,
    baseline: { points: baselineEvaluation.points, starts: baselineEvaluation.starts },
    plans,
    alternatives,
    warnings,
    assumptions,
  };
}
