import type { RosterPlayer } from './coachSchemas';
import { activeSlotCapacities } from './acquisitionAnalysis';
import type { LeagueWorkspace } from './leagueWorkspace';
import { bestDailyLineup, isOut } from './weekPlanner';

export interface TradeIdea {
  team: string;
  give: RosterPlayer[];
  get: RosterPlayer[];
  /** Projected lineup points gained over the window beyond free-agent pickups, for you and for them. */
  myGain: number;
  theirGain: number;
  /** Market (ADP) rank of each player, so the offer can be judged as fair. */
  giveRanks: number[];
  getRanks: number[];
  /** How closely the two sides' draft value matches, 0–1. */
  valueMatch: number;
  /** Why the other manager might say yes, in a sentence. */
  pitch: string;
}

export interface TradeInputs {
  /**
   * Each player's playable dates in the window, keyed by bare NHL id. From the
   * projections, so a goalie's dates are his expected starts, not every team game.
   */
  gameDates: Record<string, string[]>;
  /** Market rank (ADP); players without one aren't offered or asked for. */
  marketRank: (player: RosterPlayer) => number | undefined;
  /**
   * The best free agents, available to both teams: a trade only counts for what it
   * adds beyond picking one of them up. Never offered or asked for.
   */
  replacement?: RosterPlayer[];
  /** Least draft-value match for an offer to look fair (default 0.7). */
  minValueMatch?: number;
  /** Least gain per 28 days for you and for them (defaults 3 and 1), scaled to the window. */
  minMyGain?: number;
  minTheirGain?: number;
  /** Players sent and received per trade (default 1-for-1, 2-for-1, 1-for-2). */
  shapes?: Array<[give: number, get: number]>;
}

type Team = { name: string; roster: RosterPlayer[] };

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const fppg = (player: RosterPlayer) => player.blendedFppg ?? player.seasonFppg ?? 0;
const isGoalie = (player: RosterPlayer) => player.positions.length > 0 && player.positions.every((position) => position.toUpperCase() === 'G');
const DEFAULT_SHAPES: Array<[number, number]> = [[1, 1], [2, 1], [1, 2]];
const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];

/** Draft value of a market rank: early picks are worth far more than late ones. */
export const draftValue = (rank: number) => 1000 / (rank + 10);

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 1) return items.map((item) => [item]);
  const out: T[][] = [];
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) out.push([items[first], items[second]]);
  }
  return out;
}

/** Lineup points for each of the given days: the best lineup of players with a game. */
function dailyValues(workspace: LeagueWorkspace, roster: RosterPlayer[], inputs: TradeInputs, dates: string[]): number[] {
  const pool = [...roster, ...(inputs.replacement ?? [])].filter((player) => !isOut(player));
  const gameDays = new Map(pool.map((player) => [player, new Set(inputs.gameDates[normalizeId(player.id)] ?? [])]));
  return dates.map((date) => bestDailyLineup(workspace, pool.filter((player) => gameDays.get(player)?.has(date)), fppg).points);
}

/** Lineup points over the given days, free agents included. */
export function lineupValue(workspace: LeagueWorkspace, roster: RosterPlayer[], inputs: TradeInputs, dates: string[]): number {
  return dailyValues(workspace, roster, inputs, dates).reduce((sum, value) => sum + value, 0);
}

/** Points over the window if he played every game: how rosters decide whom to cut. */
const windowPoints = (player: RosterPlayer, inputs: TradeInputs) => fppg(player) * (inputs.gameDates[normalizeId(player.id)]?.length ?? 0);

/**
 * The roster after sending `out` and receiving `incoming`. A roster that grows cuts its
 * least valuable players back to its old size (a free agent covers any gap it leaves).
 */
function afterTrade(roster: RosterPlayer[], out: RosterPlayer[], incoming: RosterPlayer[], inputs: TradeInputs): { roster: RosterPlayer[]; cut: RosterPlayer[] } {
  const outIds = new Set(out.map((player) => normalizeId(player.id)));
  const next = [...roster.filter((player) => !outIds.has(normalizeId(player.id))), ...incoming];
  if (next.length <= roster.length) return { roster: next, cut: [] };
  const ranked = [...next].sort((a, b) => windowPoints(b, inputs) - windowPoints(a, inputs));
  return { roster: ranked.slice(0, roster.length), cut: ranked.slice(roster.length) };
}

/** Points gained by a trade: only days a moved or cut player plays can change. */
function tradeGain(workspace: LeagueWorkspace, roster: RosterPlayer[], base: number[], out: RosterPlayer[], incoming: RosterPlayer[], inputs: TradeInputs, dates: string[]): number {
  const { roster: next, cut } = afterTrade(roster, out, incoming, inputs);
  const affected = new Set([...out, ...incoming, ...cut].flatMap((player) => inputs.gameDates[normalizeId(player.id)] ?? []));
  const indexes = dates.map((date, index) => (affected.has(date) ? index : -1)).filter((index) => index >= 0);
  const values = dailyValues(workspace, next, inputs, indexes.map((index) => dates[index]));
  return indexes.reduce((sum, index, position) => sum + values[position] - base[index], 0);
}

/** Healthy players who can play each position. */
function depth(roster: RosterPlayer[]): Record<string, number> {
  const healthy = roster.filter((player) => !isOut(player));
  return Object.fromEntries(POSITIONS.map((position) => [position, healthy.filter((player) => player.positions.map((item) => item.toUpperCase()).includes(position)).length]));
}

const plural = (position: string, count: number) => (position === 'G' ? (count === 1 ? 'goalie' : 'goalies') : `${position}${count === 1 ? '' : 's'}`);
const label = (position: string) => (position === 'G' ? 'goalie' : position);

/** Why the other manager might say yes: the position he's deep at for one he's thin at. */
function pitchFor(workspace: LeagueWorkspace, mine: RosterPlayer[], theirs: RosterPlayer[], give: RosterPlayer[], get: RosterPlayer[], team: string): string {
  const slots = activeSlotCapacities(workspace);
  const spots = (position: string) => Object.entries(slots).filter(([slot]) => slot.toUpperCase() === position).reduce((sum, [, count]) => sum + count, 0);
  const theirDepth = depth(theirs);
  const myDepth = depth(mine);
  const gotten = get[0].positions.map((item) => item.toUpperCase()).find((position) => POSITIONS.includes(position)) ?? get[0].positions[0];
  const sent = give[0].positions.map((item) => item.toUpperCase()).find((position) => POSITIONS.includes(position)) ?? give[0].positions[0];
  const parts: string[] = [];
  if (spots(gotten) && theirDepth[gotten] > spots(gotten)) parts.push(`${team} have ${theirDepth[gotten]} ${plural(gotten, theirDepth[gotten])} for ${spots(gotten)} spot${spots(gotten) === 1 ? '' : 's'}`);
  if (spots(sent) && theirDepth[sent] < spots(sent) + 1) parts.push(`they're thin at ${label(sent)}`);
  if (spots(gotten) && myDepth[gotten] <= spots(gotten)) parts.push(`you're short at ${label(gotten)}`);
  if (give.length > get.length) parts.push('they get two players for one');
  if (get.length > give.length) parts.push('they get one better player for two');
  return parts.length ? `${parts.join('; ')}.` : 'Both lineups start more points.';
}

export const byBalance = (a: TradeIdea, b: TradeIdea) => Math.min(b.myGain, 2 * b.theirGain) - Math.min(a.myGain, 2 * a.theirGain);

/**
 * One team's trade ideas with you: trades (1-for-1, 2-for-1, 1-for-2) that make both
 * lineups better over `dates` beyond what free agents give, by at least a minimum,
 * and look fair on the market (draft value of the two sides within `minValueMatch`).
 * Ranked so the other side gains enough to say yes. At most `perTeam`, each with
 * different players.
 */
export function tradesWithTeam(workspace: LeagueWorkspace, mine: RosterPlayer[], team: Team, inputs: TradeInputs, dates: string[], perTeam = 2): TradeIdea[] {
  const scale = dates.length / 28;
  const minMine = (inputs.minMyGain ?? 3) * scale;
  const minTheirs = (inputs.minTheirGain ?? 1) * scale;
  const minMatch = inputs.minValueMatch ?? 0.7;
  const replacementIds = new Set((inputs.replacement ?? []).map((player) => normalizeId(player.id)));
  const tradable = (player: RosterPlayer) => !isOut(player) && fppg(player) > 0 && !replacementIds.has(normalizeId(player.id)) && inputs.marketRank(player) !== undefined;
  const myBase = dailyValues(workspace, mine, inputs, dates);
  const theirBase = dailyValues(workspace, team.roster, inputs, dates);
  const found: TradeIdea[] = [];
  for (const [giveCount, getCount] of inputs.shapes ?? DEFAULT_SHAPES) {
    const gives = combinations(mine.filter(tradable), giveCount);
    const gets = combinations(team.roster.filter(tradable), getCount);
    for (const give of gives) {
      const giveRanks = give.map((player) => inputs.marketRank(player) as number);
      const giveValue = giveRanks.reduce((sum, rank) => sum + draftValue(rank), 0);
      for (const get of gets) {
        const getRanks = get.map((player) => inputs.marketRank(player) as number);
        const getValue = getRanks.reduce((sum, rank) => sum + draftValue(rank), 0);
        const valueMatch = Math.min(giveValue, getValue) / Math.max(giveValue, getValue);
        if (valueMatch < minMatch) continue;
        const myGain = tradeGain(workspace, mine, myBase, give, get, inputs, dates);
        if (myGain < minMine) continue;
        const theirGain = tradeGain(workspace, team.roster, theirBase, get, give, inputs, dates);
        if (theirGain < minTheirs) continue;
        found.push({ team: team.name, give, get, myGain, theirGain, giveRanks, getRanks, valueMatch, pitch: '' });
      }
    }
  }
  found.sort(byBalance);
  const used = new Set<string>();
  return found.filter((idea) => {
    const ids = [...idea.give, ...idea.get].map((player) => normalizeId(player.id));
    if (ids.some((id) => used.has(id))) return false;
    ids.forEach((id) => used.add(id));
    return true;
  }).slice(0, perTeam).map((idea) => ({ ...idea, pitch: pitchFor(workspace, mine, team.roster, idea.give, idea.get, team.name) }));
}

/** Trade ideas across the league; see tradesWithTeam. */
export function findTrades(
  workspace: LeagueWorkspace,
  mine: RosterPlayer[],
  teams: Team[],
  inputs: TradeInputs,
  dates: string[],
  { limit = 6, perTeam = 2 }: { limit?: number; perTeam?: number } = {},
): TradeIdea[] {
  return teams.flatMap((team) => tradesWithTeam(workspace, mine, team, inputs, dates, perTeam)).sort(byBalance).slice(0, limit);
}

/**
 * The free agents both teams could pick up instead of trading: the best by points over
 * the window at each skater position, and as many goalies as there are G spots.
 */
export function replacementLevel(workspace: LeagueWorkspace, freeAgents: RosterPlayer[], gameDates: Record<string, string[]>): RosterPlayer[] {
  const inputs: TradeInputs = { gameDates, marketRank: () => undefined };
  const goalieSpots = Object.entries(activeSlotCapacities(workspace)).filter(([slot]) => slot.toUpperCase() === 'G').reduce((sum, [, count]) => sum + count, 0);
  const healthy = freeAgents.filter((player) => !isOut(player) && fppg(player) > 0);
  const chosen = new Map<string, RosterPlayer>();
  const take = (candidates: RosterPlayer[], count: number) => candidates
    .filter((player) => !chosen.has(normalizeId(player.id)))
    .sort((a, b) => windowPoints(b, inputs) - windowPoints(a, inputs))
    .slice(0, count)
    .forEach((player) => chosen.set(normalizeId(player.id), player));
  ['C', 'LW', 'RW', 'D'].forEach((position) => take(healthy.filter((player) => !isGoalie(player) && player.positions.map((item) => item.toUpperCase()).includes(position)), 1));
  take(healthy.filter(isGoalie), goalieSpots);
  return [...chosen.values()];
}
