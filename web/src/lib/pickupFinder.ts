import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { planningWeek, type LeagueWorkspace } from './leagueWorkspace';
import { activeSlotCapacities } from './acquisitionAnalysis';
import { canPlaySoon } from './pickupCandidateDiscovery';
import { normalizeRosterSlot } from './rosterEligibility';
import { likelyOnWaivers } from './startingRostersImport';
import { bestDailyLineup, isOut, planWeek, type WeekPlan, type WeekPlannerResult } from './weekPlanner';
import type { PlayerSearchResult } from '../types';

/**
 * Pickup finder: which unrostered players would improve your lineup over a range of
 * days, and how many of your adds are worth using now.
 *
 * Everything is worked out in the browser from the league-scored player directory and
 * the NHL schedule, so the pool is wide (every useful unrostered player) and the range
 * can run to the end of the season. Each day's lineup is re-solved with the candidate
 * in it, so a pickup only counts on nights he would start ("fills"). Goalies count
 * their expected share of their team's games, never every game.
 */

export type FinderRange = 'week' | 'next' | '14d' | 'season';

export interface FinderInput {
  workspace: LeagueWorkspace;
  /** Your roster, with saved slots. */
  roster: RosterPlayer[];
  /** League-scored player directory. */
  directory: PlayerSearchResult[];
  /** Each NHL team's game dates. */
  teamGames: Record<string, string[]>;
  /** Players on a team in your league (or estimated to be), never suggested. */
  ownedIds: string[];
  now?: string | number | Date;
}

export interface DaySpots {
  date: string;
  /** Open lineup spots that day, by slot type. */
  open: Record<string, number>;
  openTotal: number;
  /** Your available players with a game that day. */
  playing: number;
}

export interface WeekSpots {
  start: string;
  end: string;
  openTotal: number;
  open: Record<string, number>;
}

export interface Pickup {
  player: PlayerSearchResult;
  rosterPlayer: RosterPlayer;
  /** Points gained over making no move, after the dropped player's lost points. */
  gain: number;
  /** Games he'd be in your lineup (goalies: expected starts). */
  fills: number;
  games: number;
  startDates: string[];
  drop: RosterPlayer | null;
  /** First day he can play for you (waivers, next-day adds). */
  availableFrom: string;
  likelyOnWaivers: boolean;
  percentOwned: number | null;
}

const OUT_SLOTS = new Set(['IR', 'IR+', 'IR-LT', 'NA']);
const BENCH_SLOTS = new Set(['BN', 'BENCH']);
const DAY_MS = 86_400_000;
const normalizeId = (id: string) => id.replace(/^nhl:/, '');

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** The days a range covers, never before today: the rest of this matchup week, next week, two weeks, or the season. */
export function finderDays(workspace: LeagueWorkspace, range: FinderRange, now: string | number | Date = Date.now()): string[] {
  const week = planningWeek(workspace, now);
  const from = week.firstPlanDate;
  const end = range === 'week' ? week.end
    : range === 'next' ? week.nextEnd
      : range === '14d' ? addDays(from, 13)
        : workspace.season.end;
  const start = range === 'next' ? week.nextStart : from;
  return datesBetween(start, [end, workspace.season.end].sort()[0]);
}

/** Expected share of his team's games a goalie starts: this season once he has a few, else last season's. */
export function goalieStartShare(player: PlayerSearchResult): number {
  const recent = (player as PlayerSearchResult & { recentSeasons?: Array<{ season: string; gamesPlayed?: number }> }).recentSeasons ?? [];
  const team = player.teamGamesPlayed ?? 0;
  const current = recent[0]?.gamesPlayed ?? 0;
  const share = team >= 5 && current > 0 ? current / team : (recent.find((season, index) => index > 0 && (season.gamesPlayed ?? 0) > 0)?.gamesPlayed ?? 20) / 82;
  return Math.max(0.15, Math.min(0.8, share));
}

const isGoalie = (positions: string[]) => positions.length > 0 && positions.every((position) => position.toUpperCase() === 'G');

export function toFinderRosterPlayer(player: PlayerSearchResult): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    games_played: player.games_played ?? 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    blendedFppg: player.blendedFppg ?? undefined,
    injuryStatus: player.injuryStatus,
  } as RosterPlayer;
}

/** Shared setup: who's on your roster, what each player is worth per game, who plays when. */
function prepare(input: FinderInput) {
  const { workspace, roster, directory, teamGames } = input;
  const byId = new Map(directory.map((player) => [normalizeId(player.id), player]));
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  const slotOf = (player: RosterPlayer) => normalizeRosterSlot(entryById.get(normalizeId(player.id))?.slot ?? player.current_slot ?? '');
  const valueCache = new Map<string, number>();
  const valueOf = (player: RosterPlayer) => {
    const id = normalizeId(player.id);
    let value = valueCache.get(id);
    if (value === undefined) {
      const known = byId.get(id);
      const fppg = known?.blendedFppg ?? player.blendedFppg ?? 0;
      value = isGoalie(player.positions) ? fppg * (known ? goalieStartShare(known) : 0.5) : fppg;
      valueCache.set(id, value);
    }
    return value;
  };
  const games = new Map(Object.entries(teamGames).map(([team, dates]) => [team, new Set(dates)]));
  const plays = (player: RosterPlayer, date: string) => Boolean(games.get(player.team)?.has(date));
  const active = roster.filter((player) => !OUT_SLOTS.has(slotOf(player)));
  const lineupBase = active.filter((player) => !isOut(player));
  const slots = Object.entries(workspace.rosterRules.slots);
  const placeCapacity = slots.filter(([slot]) => !OUT_SLOTS.has(slot.toUpperCase())).reduce((sum, [, count]) => sum + count, 0);
  const hasRoom = active.length < placeCapacity;
  const protectedPlayer = (player: RosterPlayer) => {
    const entry = entryById.get(normalizeId(player.id));
    return Boolean(entry?.keeper || entry?.protected || entry?.undroppable);
  };
  // Drop options: the players you marked OK to drop, then your weakest few unprotected players.
  const marked = active.filter((player) => entryById.get(normalizeId(player.id))?.streamSpot && !protectedPlayer(player));
  const weakest = active.filter((player) => !protectedPlayer(player) && !marked.includes(player)).sort((a, b) => valueOf(a) - valueOf(b)).slice(0, 5);
  const dropOptions: Array<RosterPlayer | null> = [...(hasRoom ? [null] : []), ...marked, ...weakest];
  const lineupValue = (players: RosterPlayer[]) => bestDailyLineup(workspace, players, valueOf);
  return { byId, slotOf, valueOf, plays, active, lineupBase, dropOptions, lineupValue, hasRoom };
}

/** Open lineup spots per day: active slots your available players can't fill. */
export function openSpots(input: FinderInput, days: string[]): DaySpots[] {
  const { lineupBase, plays, lineupValue } = prepare(input);
  const units = Object.entries(activeSlotCapacities(input.workspace)).filter(([slot]) => !BENCH_SLOTS.has(slot.toUpperCase()));
  return days.map((date) => {
    const playing = lineupBase.filter((player) => plays(player, date));
    const { started } = lineupValue(playing);
    // Which slot types stay empty: fill greedily by how few slots each started player could take.
    const remaining = Object.fromEntries(units.map(([slot, count]) => [slot, count]));
    const order = started.map((player) => player.positions.map((position) => position.toUpperCase())).sort((a, b) => a.length - b.length);
    order.forEach((positions) => {
      const slot = Object.keys(remaining).find((key) => remaining[key] > 0 && (positions.includes(key) || (key === 'UTIL' && !positions.includes('G')) || (key === 'F' && positions.some((p) => ['C', 'LW', 'RW'].includes(p))) || (key === 'W' && positions.some((p) => ['LW', 'RW'].includes(p)))));
      if (slot) remaining[slot] -= 1;
    });
    const open = Object.fromEntries(Object.entries(remaining).filter(([, count]) => count > 0));
    return { date, open, openTotal: Object.values(open).reduce((sum, count) => sum + count, 0), playing: playing.length };
  });
}

/** Open spots summed per matchup week, for long ranges. */
export function weeklySpots(workspace: LeagueWorkspace, days: DaySpots[]): WeekSpots[] {
  const weekStartIndex = { sunday: 0, monday: 1, saturday: 6 }[workspace.schedule.matchupWeekStart];
  const weeks = new Map<string, WeekSpots>();
  days.forEach((day) => {
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    const start = addDays(day.date, -((weekday - weekStartIndex + 7) % 7));
    const week = weeks.get(start) ?? { start, end: day.date, openTotal: 0, open: {} };
    week.end = day.date;
    week.openTotal += day.openTotal;
    Object.entries(day.open).forEach(([slot, count]) => { week.open[slot] = (week.open[slot] ?? 0) + count; });
    weeks.set(start, week);
  });
  return [...weeks.values()];
}

/** First day a pickup can play for you: today plus next-day adds and any waiver wait. */
function firstPlayable(input: FinderInput, player: PlayerSearchResult, days: string[]): { from: string; waivers: boolean } {
  const { workspace } = input;
  const today = planningWeek(workspace, input.now ?? Date.now()).today;
  const nextDay = workspace.acquisitions.addTiming === 'next-day' ? 1 : 0;
  const waiverDays = Math.max(2, workspace.acquisitions.waiverDelayDays);
  const waivers = workspace.acquisitions.pickupMethod === 'waivers' || likelyOnWaivers(workspace, player.id, new Date(input.now ?? Date.now()).getTime());
  const from = addDays(today, nextDay + (waivers ? waiverDays : 0));
  return { from: [from, days[0]].sort()[1], waivers };
}

/**
 * Every useful unrostered player for these days, best first: what he adds over making no
 * move (after dropping your best drop option for him), and how many games he'd start.
 */
export function findPickups(input: FinderInput, days: string[], limit = 200): Pickup[] {
  if (!days.length) return [];
  const prep = prepare(input);
  const { lineupBase, plays, valueOf, dropOptions, lineupValue } = prep;
  const owned = new Set(input.ownedIds.map(normalizeId));
  const rosterIds = new Set(input.roster.map((player) => normalizeId(player.id)));
  const base = days.map((date) => lineupValue(lineupBase.filter((player) => plays(player, date))).points);
  const without = dropOptions.map((drop) => {
    const rest = drop ? lineupBase.filter((player) => player !== drop) : lineupBase;
    const perDay = days.map((date, index) => (drop && plays(drop, date) ? lineupValue(rest.filter((player) => plays(player, date))).points : base[index]));
    return { drop, rest, perDay, loss: perDay.reduce((sum, points, index) => sum + points - base[index], 0) };
  });
  const pool = input.directory
    .filter((player) => !owned.has(normalizeId(player.id)) && !rosterIds.has(normalizeId(player.id)) && canPlaySoon(player) && (player.blendedFppg ?? 0) > 0 && player.team)
    .map((player) => ({ player, rosterPlayer: toFinderRosterPlayer(player) }))
    .map((item) => ({ ...item, games: days.filter((date) => plays(item.rosterPlayer, date)).length }))
    .filter((item) => item.games > 0)
    .sort((a, b) => valueOf(b.rosterPlayer) * b.games - valueOf(a.rosterPlayer) * a.games)
    .slice(0, limit);
  return pool.map(({ player, rosterPlayer, games }) => {
    const { from, waivers } = firstPlayable(input, player, days);
    let best: { gain: number; fills: number; startDates: string[]; drop: RosterPlayer | null } | null = null;
    for (const option of without) {
      let gain = option.loss;
      let fills = 0;
      const startDates: string[] = [];
      days.forEach((date, index) => {
        if (date < from || !plays(rosterPlayer, date)) return;
        const lineup = lineupValue([...option.rest.filter((player) => plays(player, date)), rosterPlayer]);
        gain += lineup.points - option.perDay[index];
        if (lineup.started.includes(rosterPlayer)) {
          fills += isGoalie(rosterPlayer.positions) ? goalieStartShare(player) : 1;
          startDates.push(date);
        }
      });
      if (!best || gain > best.gain) best = { gain, fills, startDates, drop: option.drop };
    }
    return {
      player, rosterPlayer, games, availableFrom: from, likelyOnWaivers: waivers,
      percentOwned: player.yahooPercentOwned ?? null,
      ...(best ?? { gain: 0, fills: 0, startDates: [], drop: null }),
    };
  }).filter((pickup) => pickup.gain > 0.05).sort((a, b) => b.gain - a.gain);
}

export interface AddAdvice {
  /** Adds left this week, or null when the league has no limit. */
  remaining: number | null;
  /** Adds worth making now, and the plan that makes them together. */
  use: number;
  hold: number;
  plan: WeekPlan | null;
  /** Points each extra add gains when made together with the ones before it. */
  marginal: number[];
  /** About what one held add is worth for the rest of the week. */
  holdValue: number;
  holdReason: 'late' | 'injury' | 'none';
  /** The plan's whole result, for "plan several adds". */
  planner: WeekPlannerResult | null;
}

const INJURY_PER_PLAYER_DAY = 0.004;
const SECOND_HOLD_FACTOR = 0.3;

/**
 * How many of this week's adds to use now. Adds are scored together (the planner's joint
 * search: one roster place streamed twice, two places held all week, or a mix), and each
 * add is made only if it gains more than keeping it: for a late-week pickup on the last
 * days, or to replace a starter who gets hurt. A held add is worth nothing on the week's
 * last day, so then every useful add is used.
 */
export function adviseAdds(input: FinderInput, pickups: Pickup[]): AddAdvice {
  const { workspace } = input;
  const now = input.now ?? Date.now();
  const weekDays = finderDays(workspace, 'week', now);
  const prep = prepare(input);
  // The planner works from per-game projections; build them from the same values and schedule.
  const projectionFor = (player: RosterPlayer): PlayerProjection => {
    const gamesByDate = Object.fromEntries(weekDays.filter((date) => prep.plays(player, date)).map((date) => [date, {}]));
    return { fppg: prep.valueOf(player), starts: 0, gamesAvailable: 0, projectedPoints: 0, offNightRate: 0, strengthOfSchedule: 0, gamesByDate } as unknown as PlayerProjection;
  };
  const weekPicks = pickups.filter((pickup) => pickup.startDates.some((date) => date <= weekDays[weekDays.length - 1])).slice(0, 18);
  const projections: Record<string, PlayerProjection> = {};
  [...input.roster, ...weekPicks.map((pickup) => pickup.rosterPlayer)].forEach((player) => { projections[player.id] = projectionFor(player); });
  const streamSpotIds = prep.dropOptions.filter((player): player is RosterPlayer => player !== null).map((player) => player.id);
  const planner = weekDays.length ? planWeek(
    workspace,
    input.roster,
    weekPicks.map((pickup) => ({ player: pickup.rosterPlayer, confirmed: true, ...(pickup.availableFrom > weekDays[0] ? { availableFrom: pickup.availableFrom } : {}) })),
    projections,
    { now, includeGoalies: true, streamSpotIds, horizon: 'week' },
  ) : null;
  const plans = planner?.plans ?? [];
  const remaining = planner?.addsRemaining ?? null;
  const gains = plans.map((plan) => plan.gain);
  const marginal = gains.slice(1).map((gain, index) => gain - gains[index]);

  // What holding one add is worth: the best pickup on the week's last two days, or cover for an injury.
  const daysLeft = weekDays.length;
  const lateDays = weekDays.slice(-2);
  const late = daysLeft > 2 ? Math.max(0, ...findPickups(input, lateDays, 60).slice(0, 1).map((pickup) => pickup.gain)) : 0;
  const starters = Object.values(activeSlotCapacities(workspace)).reduce((sum, count) => sum + count, 0);
  const injuryChance = 1 - (1 - INJURY_PER_PLAYER_DAY) ** (starters * Math.max(0, daysLeft - 1));
  const bestPerDay = pickups.length ? pickups[0].gain / Math.max(1, days(pickups[0])) : 0;
  const injury = daysLeft > 1 ? injuryChance * bestPerDay * (daysLeft / 2) : 0;
  const holdValue = Math.max(late, injury);
  const holdReason: AddAdvice['holdReason'] = holdValue <= 0 ? 'none' : late >= injury ? 'late' : 'injury';
  const held = (count: number) => Array.from({ length: count }, (_, index) => holdValue * SECOND_HOLD_FACTOR ** index).reduce((sum, value) => sum + value, 0);

  const budget = remaining === null ? plans.length - 1 : Math.min(remaining, plans.length - 1);
  let use = 0;
  let bestTotal = -Infinity;
  for (let count = 0; count <= Math.max(0, budget); count += 1) {
    if (count > 0 && (marginal[count - 1] ?? 0) < 0.5) break;
    const total = (gains[count] ?? 0) + (remaining === null ? 0 : held(remaining - count));
    if (total > bestTotal + 0.05) { bestTotal = total; use = count; }
  }
  return {
    remaining, use, hold: remaining === null ? 0 : Math.max(0, remaining - use),
    plan: use > 0 ? plans[use] ?? null : null, marginal, holdValue, holdReason, planner,
  };
}

function days(pickup: Pickup): number {
  return Math.max(1, pickup.games);
}

export const finderToday = (workspace: LeagueWorkspace, now: string | number | Date = Date.now()) => planningWeek(workspace, now).today;
export const isStale = (timestamp: string | undefined, now = Date.now()) => !timestamp || now - new Date(timestamp).getTime() > 3 * DAY_MS;
