import type { RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace } from './leagueWorkspace';
import { bestDailyLineup, isOut } from './weekPlanner';

export interface TradeIdea {
  team: string;
  give: RosterPlayer;
  get: RosterPlayer;
  /** Projected lineup points gained over the window, for you and for them. */
  myGain: number;
  theirGain: number;
  /** Market (ADP) rank of each player, so the offer can be judged as fair. */
  giveRank: number;
  getRank: number;
}

export interface TradeInputs {
  /**
   * Each player's playable dates in the window, keyed by bare NHL id. From the
   * projections, so a goalie's dates are his expected starts, not every team game.
   */
  gameDates: Record<string, string[]>;
  /** Market rank (ADP); players without one aren't offered or asked for. */
  marketRank: (player: RosterPlayer) => number | undefined;
  /** Widest ratio between the two players' market ranks for an offer to look fair. */
  maxRankRatio?: number;
}

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const fppg = (player: RosterPlayer) => player.blendedFppg ?? player.seasonFppg ?? 0;
export const DEFAULT_MAX_RANK_RATIO = 1.5;

/** Lineup points for each of the given days: the best lineup of players with a game. */
function dailyValues(workspace: LeagueWorkspace, roster: RosterPlayer[], inputs: TradeInputs, dates: string[]): number[] {
  const healthy = roster.filter((player) => !isOut(player));
  const gameDays = new Map(healthy.map((player) => [player.id, new Set(inputs.gameDates[normalizeId(player.id)] ?? [])]));
  return dates.map((date) => bestDailyLineup(workspace, healthy.filter((player) => gameDays.get(player.id)?.has(date)), fppg).points);
}

/** Lineup points over the given days: each day, the best lineup of players with a game. */
export function lineupValue(workspace: LeagueWorkspace, roster: RosterPlayer[], inputs: TradeInputs, dates: string[]): number {
  return dailyValues(workspace, roster, inputs, dates).reduce((sum, value) => sum + value, 0);
}

/** Points gained by swapping `out` for `incoming`: only days either one plays can change. */
function swapGain(workspace: LeagueWorkspace, roster: RosterPlayer[], base: number[], out: RosterPlayer, incoming: RosterPlayer, inputs: TradeInputs, dates: string[]): number {
  const after = [...roster.filter((player) => normalizeId(player.id) !== normalizeId(out.id)), incoming];
  const affected = new Set([...(inputs.gameDates[normalizeId(out.id)] ?? []), ...(inputs.gameDates[normalizeId(incoming.id)] ?? [])]);
  const indexes = dates.map((date, index) => (affected.has(date) ? index : -1)).filter((index) => index >= 0);
  const afterValues = dailyValues(workspace, after, inputs, indexes.map((index) => dates[index]));
  return indexes.reduce((sum, index, position) => sum + afterValues[position] - base[index], 0);
}

export const byBalance = (a: TradeIdea, b: TradeIdea) => Math.min(b.myGain, b.theirGain) - Math.min(a.myGain, a.theirGain);

/**
 * One team's trade ideas with you: one-for-one swaps that make both lineups better
 * over `dates` and look fair on the market (the two ADP ranks within `maxRankRatio`
 * of each other). Ranked by the smaller gain, so the other manager has a reason to
 * say yes. At most `perTeam`, each with different players.
 */
export function tradesWithTeam(
  workspace: LeagueWorkspace,
  mine: RosterPlayer[],
  team: { name: string; roster: RosterPlayer[] },
  inputs: TradeInputs,
  dates: string[],
  perTeam = 2,
): TradeIdea[] {
  const maxRatio = inputs.maxRankRatio ?? DEFAULT_MAX_RANK_RATIO;
  const myBase = dailyValues(workspace, mine, inputs, dates);
  const theirBase = dailyValues(workspace, team.roster, inputs, dates);
  const tradable = (player: RosterPlayer) => !isOut(player) && fppg(player) > 0 && inputs.marketRank(player) !== undefined;
  const found: TradeIdea[] = [];
  mine.filter(tradable).forEach((give) => {
    const giveRank = inputs.marketRank(give) as number;
    team.roster.filter(tradable).forEach((get) => {
      const getRank = inputs.marketRank(get) as number;
      if (Math.max(giveRank, getRank) / Math.max(1, Math.min(giveRank, getRank)) > maxRatio) return;
      const myGain = swapGain(workspace, mine, myBase, give, get, inputs, dates);
      if (myGain <= 0.01) return;
      const theirGain = swapGain(workspace, team.roster, theirBase, get, give, inputs, dates);
      if (theirGain <= 0.01) return;
      found.push({ team: team.name, give, get, myGain, theirGain, giveRank, getRank });
    });
  });
  found.sort(byBalance);
  const used = new Set<string>();
  return found.filter((idea) => {
    if (used.has(idea.give.id) || used.has(idea.get.id)) return false;
    used.add(idea.give.id);
    used.add(idea.get.id);
    return true;
  }).slice(0, perTeam);
}

/** Trade ideas across the league; see tradesWithTeam. */
export function findTrades(
  workspace: LeagueWorkspace,
  mine: RosterPlayer[],
  teams: { name: string; roster: RosterPlayer[] }[],
  inputs: TradeInputs,
  dates: string[],
  { limit = 6, perTeam = 2 }: { limit?: number; perTeam?: number } = {},
): TradeIdea[] {
  return teams.flatMap((team) => tradesWithTeam(workspace, mine, team, inputs, dates, perTeam)).sort(byBalance).slice(0, limit);
}
