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
}

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const fppg = (player: RosterPlayer) => player.blendedFppg ?? player.seasonFppg ?? 0;

/** Lineup points for each of the given days: the best lineup of players with a game. */
function dailyValues(workspace: LeagueWorkspace, roster: RosterPlayer[], teamGames: Record<string, string[]>, dates: string[]): number[] {
  const healthy = roster.filter((player) => !isOut(player));
  const gameDays = new Map(healthy.map((player) => [player.id, new Set(teamGames[player.team] ?? [])]));
  return dates.map((date) => bestDailyLineup(workspace, healthy.filter((player) => gameDays.get(player.id)?.has(date)), fppg).points);
}

/** Lineup points over the given days: each day, the best lineup of players with a game. */
export function lineupValue(workspace: LeagueWorkspace, roster: RosterPlayer[], teamGames: Record<string, string[]>, dates: string[]): number {
  return dailyValues(workspace, roster, teamGames, dates).reduce((sum, value) => sum + value, 0);
}

/** Points gained by swapping `out` for `in`: only days either one plays can change. */
function swapGain(workspace: LeagueWorkspace, roster: RosterPlayer[], base: number[], out: RosterPlayer, incoming: RosterPlayer, teamGames: Record<string, string[]>, dates: string[]): number {
  const after = [...roster.filter((player) => normalizeId(player.id) !== normalizeId(out.id)), incoming];
  const affected = new Set([...(teamGames[out.team] ?? []), ...(teamGames[incoming.team] ?? [])]);
  const indexes = dates.map((date, index) => (affected.has(date) ? index : -1)).filter((index) => index >= 0);
  const afterValues = dailyValues(workspace, after, teamGames, indexes.map((index) => dates[index]));
  return indexes.reduce((sum, index, position) => sum + afterValues[position] - base[index], 0);
}

/** One team's trade ideas with you; see findTrades. */
export function tradesWithTeam(
  workspace: LeagueWorkspace,
  mine: RosterPlayer[],
  team: { name: string; roster: RosterPlayer[] },
  teamGames: Record<string, string[]>,
  dates: string[],
  perTeam = 2,
): TradeIdea[] {
  const myBase = dailyValues(workspace, mine, teamGames, dates);
  const theirBase = dailyValues(workspace, team.roster, teamGames, dates);
  const tradable = (player: RosterPlayer) => !isOut(player) && fppg(player) > 0;
  const found: TradeIdea[] = [];
  mine.filter(tradable).forEach((give) => {
    team.roster.filter(tradable).forEach((get) => {
      const myGain = swapGain(workspace, mine, myBase, give, get, teamGames, dates);
      if (myGain <= 0.01) return;
      const theirGain = swapGain(workspace, team.roster, theirBase, get, give, teamGames, dates);
      if (theirGain <= 0.01) return;
      found.push({ team: team.name, give, get, myGain, theirGain });
    });
  });
  found.sort(byBalance);
  // Different players in each idea from the same team.
  const used = new Set<string>();
  return found.filter((idea) => {
    if (used.has(idea.give.id) || used.has(idea.get.id)) return false;
    used.add(idea.give.id);
    used.add(idea.get.id);
    return true;
  }).slice(0, perTeam);
}

export const byBalance = (a: TradeIdea, b: TradeIdea) => Math.min(b.myGain, b.theirGain) - Math.min(a.myGain, a.theirGain);

/**
 * One-for-one trades that make both lineups better over `dates`: for every other
 * team, every swap of one of your players for one of theirs is scored for both
 * sides. Kept only when both gain; ranked by the smaller gain, so the ideas are
 * ones the other manager has a reason to accept. At most `perTeam` per team.
 */
export function findTrades(
  workspace: LeagueWorkspace,
  mine: RosterPlayer[],
  teams: { name: string; roster: RosterPlayer[] }[],
  teamGames: Record<string, string[]>,
  dates: string[],
  { limit = 6, perTeam = 2 }: { limit?: number; perTeam?: number } = {},
): TradeIdea[] {
  return teams.flatMap((team) => tradesWithTeam(workspace, mine, team, teamGames, dates, perTeam)).sort(byBalance).slice(0, limit);
}
