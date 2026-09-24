import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { activeSlotCapacities, canFillSlot, simulateDailyLineup } from './acquisitionAnalysis';
import {
  acquisitionMovesRemaining,
  irEligibleStatuses,
  planningWeek,
  type LeagueWorkspace,
  type PlanningWeek,
} from './leagueWorkspace';
import { normalizeRosterSlot } from './rosterEligibility';

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
 * only counts on nights he would actually start. Only the planned week is scored.
 *
 * Separately, "bridge" players play on both the week's last day and next week's
 * first day: added with a spare add at the end of the week, they score that day and
 * are already rostered when the add limit resets.
 */

const IR_SLOTS = new Set(['IR', 'IR+', 'IR-LT']);
const INACTIVE_SLOTS = new Set([...IR_SLOTS, 'NA']);
/** Yahoo statuses meaning a player will not play this week. Day-to-day players may. */
const OUT_STATUSES = new Set(['IR', 'IR-LT', 'O', 'NA', 'SUSP']);
const MAX_POOL = 18;
// Enough for a 30-day window at 4 adds a week; the search stays well under a second.
const MAX_ADDS = 20;

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
  /**
   * The earliest day he can be added at no cost: the place is empty, or whoever he
   * replaces has no games left before him. Adding early secures him; waiting until
   * actionDate keeps the option open. Equals actionDate when there is no slack.
   */
  earliestActionDate: string;
  confirmed: boolean;
  /** Lineup starts and points this add earns this week in the plan. */
  starts: number;
  points: number;
  /** Last day he holds the spot (the day before the next add), or null when he stays to the window's end. */
  until: string | null;
  /** His game dates while he holds the spot, and the ones he starts in the plan's lineups. */
  gameDates: string[];
  startDates: string[];
  /** He is still in the spot at the end of the week. */
  carriesOver: boolean;
  /** He stays through the week and also plays on the first day of next week. */
  playsNextWeekStart: boolean;
}

/** How far ahead to plan: the matchup week (weekly streaming), or a longer stretch to add and hold. */
export type PlannerHorizon = 'week' | '14d' | '30d';

export interface BridgeCandidate {
  player: RosterPlayer;
  fppg: number;
  confirmed: boolean;
  /** When to add him so he plays the week's last day. */
  actionDate: string;
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
  daily: WeekPlanDay[];
}

export interface PlanSubstitute {
  player: RosterPlayer;
  confirmed: boolean;
  /** His first game in the replaced add's days. */
  effectiveDate: string;
  /** The plan's gain with him instead, and how much less that is. */
  gain: number;
  loss: number;
}

export interface SingleAdd {
  gain: number;
  effectiveDate: string;
  /** Who leaves: the player dropped for him, or null for an open place. */
  drop: RosterPlayer | null;
  /** Injured player moved to IR to make room, when that's how he fits. */
  irMove: RosterPlayer | null;
}

export interface IrSuggestion {
  player: RosterPlayer;
  status: string;
  /** He may play this week (day-to-day), so moving him costs his games. */
  holderPlays: boolean;
}

export interface WeekPlannerResult {
  week: PlanningWeek;
  horizon: PlannerHorizon;
  /** The scored window: from the first day a move can matter to the horizon's end. */
  window: { start: string; end: string };
  planDates: string[];
  addsRemaining: number | null;
  maxAdds: number;
  transactionDelay: number;
  spots: PlannerSpot[];
  irSuggestions: IrSuggestion[];
  /** IR-eligible players who don't fit: every IR slot is full. */
  irOverflow: IrSuggestion[];
  streamSuggestions: RosterPlayer[];
  /** FPPG of each roster player (normalized id), for showing who is weakest. */
  rosterFppg: Record<string, number>;
  /** Per plan date: how many of your available players have a game, against the lineup's active slots. */
  dayLoad: Array<{ date: string; games: number; slots: number }>;
  /** Players with games on the week's last day and next week's first day. */
  bridgeCandidates: BridgeCandidate[];
  baseline: { points: number; starts: number };
  /** plans[k] is the best plan found using k adds; plans[0] is making no moves. */
  plans: WeekPlan[];
  /**
   * For the plan with this many adds: if a player in it is taken, the best two
   * replacements for that add (same roster place and days), keyed by the taken
   * player's normalized id. Computed on request.
   */
  substitutesFor: (addCount: number) => Record<string, PlanSubstitute[]>;
  /**
   * Each candidate's best one-add plan (any roster place, any of his game days),
   * keyed by normalized id: what adding just him is worth. Candidates with no legal
   * or useful add are absent.
   */
  singleAdds: Record<string, SingleAdd>;
  warnings: string[];
  assumptions: string[];
}

export interface WeekPlannerOptions {
  now?: string | number | Date;
  includeGoalies?: boolean;
  /** Stream spots to use instead of the ones saved on the roster. */
  streamSpotIds?: string[];
  maxAdds?: number;
  horizon?: PlannerHorizon;
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
  /** Points gained over making no moves: what the planner ranks by. */
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

/** Injured, suspended or otherwise out, per the player's injury status. */
export function isOut(player: RosterPlayer): boolean {
  const status = injuryStatus(player);
  return status !== null && OUT_STATUSES.has(status);
}

/** Season value used to pick which players are the weakest to stream: FPPG, best estimate first. */
export function seasonValue(player: RosterPlayer, projections: Record<string, PlayerProjection>): number {
  return player.blendedFppg ?? player.seasonFppg ?? projectionFor(projections, player.id)?.fppg ?? 0;
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
  const weekly = workspace.rosterRules.lockingMode === 'weekly';
  // Weekly-lock leagues set one lineup per week, so they plan one week at a time.
  const horizon: PlannerHorizon = weekly ? 'week' : options.horizon ?? 'week';
  const windowEnd = horizon === 'week'
    ? week.end
    : [addDays(week.firstPlanDate, horizon === '14d' ? 13 : 29), workspace.season.end].sort()[0];
  const planDates = datesBetween(week.firstPlanDate, windowEnd);
  const includeGoalies = options.includeGoalies ?? false;
  const warnings: string[] = [];

  // Adds: a week that hasn't started yet has its full limit.
  const addsRemaining = workspace.acquisitions.limit !== null && workspace.acquisitions.period !== 'season' && week.start > week.today
    ? workspace.acquisitions.limit
    : acquisitionMovesRemaining(workspace, now);
  const transactionDelay = (workspace.acquisitions.addTiming === 'next-day' ? 1 : 0)
    + (workspace.acquisitions.pickupMethod === 'waivers' ? workspace.acquisitions.waiverDelayDays : 0);
  // Each matchup week has its own add limit: this week's remaining adds, then the full limit.
  const { limit, period } = workspace.acquisitions;
  const weekStartIndex = { sunday: 0, monday: 1, saturday: 6 }[workspace.schedule.matchupWeekStart];
  const periodOf = (date: string) => {
    if (period === 'season') return 'season';
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return addDays(date, -((weekday - weekStartIndex + 7) % 7));
  };
  const currentPeriod = periodOf(week.start);
  const addBudget = (key: string) => (limit === null ? Infinity : key === currentPeriod ? addsRemaining ?? 0 : limit);
  const windowBudget = [...new Set(planDates.map((date) => periodOf(addDays(date, -transactionDelay))))]
    .reduce((total, key) => total + addBudget(key), 0);
  const maxAdds = Math.max(0, Math.min(options.maxAdds ?? MAX_ADDS, limit === null ? 4 : windowBudget, MAX_ADDS));

  // Roster places.
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  // Saved slots carry a position suffix ("IR+-0", "BN-2"); compare the slot type.
  const slotOf = (player: RosterPlayer) => normalizeRosterSlot(entryById.get(normalizeId(player.id))?.slot ?? player.current_slot ?? '');
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

  const streamSuggestions = active
    .filter((player) => !chosenStreamIds.has(normalizeId(player.id))
      && !protectedPlayer(player)
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
  const lastEffectiveDate = weekly ? week.start : windowEnd;
  const firstEffectiveDate = [week.firstPlanDate, addDays(week.today, transactionDelay)].sort()[1];
  const pool = candidates
    .filter(({ player }) => !rosterIds.has(normalizeId(player.id)) && !injuryStatus(player) && (includeGoalies || !isGoalie(player)))
    .map((candidate) => {
      const projection = projectionFor(projections, candidate.player.id);
      const dates = gamesBetween(projection, firstEffectiveDate, windowEnd);
      return { ...candidate, projection, dates, value: (projection?.fppg ?? 0) * dates.length };
    })
    .filter((candidate) => candidate.projection && candidate.dates.length > 0)
    // Confirmed players first, then the best of the rest, up to the search cap.
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.value - a.value)
    .slice(0, MAX_POOL);

  const lineupSlots = Object.values(activeSlotCapacities(workspace)).reduce((sum, count) => sum + count, 0);

  // Lineup evaluation, cached per day by what the plan changes that day (see solvePlanDay).
  const dayCache = new Map<string, { points: number; starts: number; started: string[] }>();

  const rosterOn = (date: string, stints: Stint[]): RosterPlayer[] => {
    const { removed, added } = changesOn(date, stints);
    return [...lineupBase.filter((player) => !removed.has(normalizeId(player.id))), ...added];
  };

  /** Who a plan removes from, and adds to, the roster on a date. */
  const changesOn = (date: string, stints: Stint[]) => {
    const removed = new Set<string>();
    const added: RosterPlayer[] = [];
    spots.forEach((spot) => {
      const spotStints = stints.filter((stint) => stint.spotId === spot.id);
      if (!spotStints.length || spotStints[0].from > date) return;
      if (spot.holder) removed.add(normalizeId(spot.holder.id));
      const current = spotStints.filter((stint) => stint.from <= date).pop();
      if (current) added.push(current.add);
    });
    return { removed, added };
  };

  // Your own players with a game each day: fixed for the whole search.
  const playsOn = (player: RosterPlayer, date: string) => Boolean(projectionFor(projections, player.id)?.gamesByDate?.[date]);
  const basePlaying = new Map(planDates.map((date) => [date, lineupBase.filter((player) => playsOn(player, date))]));

  /** A day's lineup, cached by what the plan changes that day (the rest of the roster is fixed). */
  const solvePlanDay = (date: string, stints: Stint[]) => {
    const { removed, added } = changesOn(date, stints);
    const base = basePlaying.get(date) ?? [];
    const removedPlaying = base.filter((player) => removed.has(normalizeId(player.id)));
    const addedPlaying = added.filter((player) => playsOn(player, date));
    const key = `${date}|-${removedPlaying.map((player) => normalizeId(player.id)).sort().join(',')}|+${addedPlaying.map((player) => normalizeId(player.id)).sort().join(',')}`;
    let result = dayCache.get(key);
    if (!result) {
      const players = [...base.filter((player) => !removed.has(normalizeId(player.id))), ...addedPlaying];
      const lineup = bestDailyLineup(workspace, players, (player) => projectionFor(projections, player.id)?.fppg ?? 0);
      result = { points: lineup.points, starts: lineup.started.length, started: lineup.started.map((player) => normalizeId(player.id)) };
      dayCache.set(key, result);
    }
    return result;
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
      const day = solvePlanDay(date, stints);
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

  const baselineEvaluation = evaluate([]);
  const makeState = (stints: Stint[], parent: State, changedFrom: string): State => {
    const evaluation = evaluate(stints, parent.evaluation, changedFrom);
    return { stints, evaluation, score: evaluation.points - baselineEvaluation.points };
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
      const drop = index > 0 ? spotStints[index - 1].add : spot.kind === 'stream' ? spot.holder : null;
      // Who he displaces: the previous streamer, a dropped player, or a day-to-day player
      // moved to IR. He can join the day after their last game before his own start.
      const displaced = index > 0 ? spotStints[index - 1] : null;
      const displacedPlayer = displaced ? displaced.add : spot.holderPlays ? spot.holder : null;
      let earliestFrom = displaced ? addDays(displaced.from, 1) : firstEffectiveDate;
      if (displacedPlayer) {
        const lastGame = gamesBetween(projectionFor(projections, displacedPlayer.id), earliestFrom, addDays(stint.from, -1)).pop();
        if (lastGame) earliestFrom = addDays(lastGame, 1);
      }
      // Stay within the same week's add limit.
      const periodKey = periodOf(stint.actionDate);
      if (periodKey !== 'season' && periodOf(addDays(earliestFrom, -transactionDelay)) !== periodKey) earliestFrom = addDays(periodKey, transactionDelay);
      if (weekly || earliestFrom > stint.from) earliestFrom = stint.from;
      return {
        spotId: stint.spotId,
        add: stint.add,
        drop,
        actionDate: stint.actionDate,
        effectiveDate: stint.from,
        earliestActionDate: [addDays(earliestFrom, -transactionDelay), week.today].sort()[1],
        confirmed: stint.confirmed,
        until: until ? addDays(until, -1) : null,
        gameDates: gamesBetween(projectionFor(projections, stint.add.id), stint.from, until ? addDays(until, -1) : windowEnd),
        startDates,
        starts: startDates.length,
        points: startDates.length * fppg,
        carriesOver: !until,
        playsNextWeekStart: horizon === 'week' && !until && Boolean(projectionFor(projections, stint.add.id)?.gamesByDate?.[week.nextStart]),
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

  const baselineState: State = { stints: [], evaluation: baselineEvaluation, score: 0 };
  const plans: WeekPlan[] = [toPlan(baselineState)];
  const bestStates: State[] = [baselineState];
  const singleAdds: Record<string, SingleAdd> = {};
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
        const addsByPeriod = new Map<string, number>();
        state.stints.forEach((stint) => addsByPeriod.set(periodOf(stint.actionDate), (addsByPeriod.get(periodOf(stint.actionDate)) ?? 0) + 1));
        pool.forEach((candidate) => {
          if (usedIds.has(normalizeId(candidate.player.id))) return;
          // Longer windows: the first several game dates are enough to find each add's best start.
          const dates = weekly ? (firstEffectiveDate <= week.start ? [week.start] : []) : candidate.dates.slice(0, 8);
          dates.forEach((from) => {
            if ((after && from <= after) || from > lastEffectiveDate) return;
            const periodKey = periodOf(addDays(from, -transactionDelay));
            if ((addsByPeriod.get(periodKey) ?? 0) >= addBudget(periodKey)) return;
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
    if (depth === 1) {
      next.forEach((state) => {
        const stint = state.stints[0];
        const id = normalizeId(stint.add.id);
        const gain = state.evaluation.points - baselineEvaluation.points;
        if (gain <= 0.05 || (singleAdds[id] && singleAdds[id].gain >= gain)) return;
        const spot = spotById.get(stint.spotId) as PlannerSpot;
        singleAdds[id] = {
          gain,
          effectiveDate: stint.from,
          drop: spot.kind === 'stream' ? spot.holder : null,
          irMove: spot.kind === 'ir' ? spot.holder : null,
        };
      });
    }
    beam = [...next.values()]
      .sort((a, b) => b.score - a.score || b.evaluation.starts - a.evaluation.starts || stateKey(a.stints).localeCompare(stateKey(b.stints)))
      .slice(0, beamWidth);
    if (!beam.length) break;
    plans[depth] = toPlan(beam[0]);
    bestStates[depth] = beam[0];
  }

  // "If a target is taken": swap just that add for each other candidate over the same
  // days in the same roster place, keeping the rest of the plan, and keep the best two.
  const substituteCache = new Map<number, Record<string, PlanSubstitute[]>>();
  const substitutesFor = (addCount: number): Record<string, PlanSubstitute[]> => {
    const cached = substituteCache.get(addCount);
    if (cached) return cached;
    const state = bestStates[addCount];
    const result: Record<string, PlanSubstitute[]> = {};
    if (!state || !addCount) return result;
    const planGain = state.evaluation.points - baselineEvaluation.points;
    const used = new Set(state.stints.map((stint) => normalizeId(stint.add.id)));
    state.stints.forEach((stint) => {
      const spotStints = state.stints.filter((item) => item.spotId === stint.spotId).sort((a, b) => a.from.localeCompare(b.from));
      const nextFrom = spotStints[spotStints.indexOf(stint) + 1]?.from;
      result[normalizeId(stint.add.id)] = pool
        .flatMap((candidate): PlanSubstitute[] => {
          if (used.has(normalizeId(candidate.player.id))) return [];
          const from = weekly ? stint.from : candidate.dates.find((date) => date >= stint.from && (!nextFrom || date < nextFrom));
          if (!from || periodOf(addDays(from, -transactionDelay)) !== periodOf(stint.actionDate)) return [];
          const stints = state.stints.map((item) => (item === stint
            ? { ...item, add: candidate.player, from, actionDate: addDays(from, -transactionDelay), confirmed: candidate.confirmed }
            : item));
          const gain = evaluate(stints).points - baselineEvaluation.points;
          return [{ player: candidate.player, confirmed: candidate.confirmed, effectiveDate: from, gain, loss: planGain - gain }];
        })
        .sort((a, b) => b.gain - a.gain || a.player.full_name.localeCompare(b.player.full_name))
        .slice(0, 2);
    });
    substituteCache.set(addCount, result);
    return result;
  };

  // Back-to-back across the week boundary (e.g. Sunday then Monday).
  const bridgeActionDate = addDays(week.end, -transactionDelay);
  const bridgeCandidates: BridgeCandidate[] = horizon === 'week' && week.end >= firstEffectiveDate && !weekly
    ? candidates
      .filter(({ player }) => !rosterIds.has(normalizeId(player.id)) && !injuryStatus(player) && (includeGoalies || !isGoalie(player)))
      .map((candidate) => ({ ...candidate, projection: projectionFor(projections, candidate.player.id) }))
      .filter(({ projection }) => projection?.gamesByDate?.[week.end] && projection.gamesByDate[week.nextStart])
      .sort((a, b) => (b.projection?.fppg ?? 0) - (a.projection?.fppg ?? 0))
      .slice(0, 3)
      .map(({ player, projection, confirmed }) => ({ player, fppg: projection?.fppg ?? 0, confirmed, actionDate: bridgeActionDate }))
    : [];

  if (irOverflow.length) warnings.push(`${irOverflow.map((item) => item.player.full_name).join(', ')} could go to IR, but every IR slot is full.`);
  if (irSuggestions.some((item) => item.holderPlays)) warnings.push('Day-to-day players may play: the planner only uses their spot when a streamer beats them, and they need a roster place when they come back.');
  if (!spots.length) warnings.push('No roster place is free. Mark a player OK to stream, or move an injured player to IR.');

  const assumptions = [
    `${workspace.scoring.label} FPPG × games each player would start in your best daily lineup (${workspace.schedule.timezone}).`,
    transactionDelay === 0 ? 'Adds count the same day.' : `Adds count ${transactionDelay} day${transactionDelay === 1 ? '' : 's'} after you make them.`,
    addsRemaining === null ? 'No add limit set in League settings; comparing up to 4 adds.' : `${addsRemaining} add${addsRemaining === 1 ? '' : 's'} left this ${period === 'season' ? 'season' : `week${horizon === 'week' ? '' : `, then ${limit} each later week`}`}. Drops and IR moves are free.`,
    `Only ${week.firstPlanDate === windowEnd ? windowEnd : `${week.firstPlanDate} to ${windowEnd}`} is scored${horizon === 'week' ? '; next week is not counted' : ''}.`,
    ...(horizon === 'week' ? [] : ['Injured players are treated as out for the whole window.']),
    'Players you haven\'t marked available must be checked before each add.',
  ];

  return {
    week,
    horizon,
    window: { start: week.firstPlanDate, end: windowEnd },
    planDates,
    addsRemaining,
    maxAdds,
    transactionDelay,
    spots,
    irSuggestions,
    irOverflow,
    streamSuggestions,
    rosterFppg: Object.fromEntries(roster.map((player) => [normalizeId(player.id), seasonValue(player, projections)])),
    dayLoad: planDates.map((date) => ({
      date,
      games: lineupBase.filter((player) => projectionFor(projections, player.id)?.gamesByDate?.[date]).length,
      slots: lineupSlots,
    })),
    bridgeCandidates,
    baseline: { points: baselineEvaluation.points, starts: baselineEvaluation.starts },
    plans,
    substitutesFor,
    singleAdds,
    warnings,
    assumptions,
  };
}
