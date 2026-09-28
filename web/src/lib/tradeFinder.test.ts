import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { findTrades, type TradeInputs } from './tradeFinder';

const player = (id: string, positions: string[], fppg: number): RosterPlayer => ({
  id, full_name: id, team: 'VAN', positions, games_played: 10, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 }, blendedFppg: fppg,
});

describe('trade finder', () => {
  const base = createDefaultLeagueWorkspace({ id: 'trades' });
  const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, D: 1, G: 1, BN: 2 } } };
  const dates = ['2026-10-06', '2026-10-07', '2026-10-08'];
  const bothGames = ['2026-10-06', '2026-10-08'];

  const inputs = (ranks: Record<string, number>, gameDates: Record<string, string[]> = {}): TradeInputs => ({
    gameDates: new Proxy(gameDates, { get: (target, id: string) => target[id] ?? bothGames }),
    marketRank: (entry) => ranks[entry.id],
  });

  it('swaps surplus for need when both lineups get better and the ranks are close', () => {
    // I have two good centres and a weak D; they have two good D and a weak centre.
    const mine = [player('myC1', ['C'], 3), player('myC2', ['C'], 2.5), player('myD', ['D'], 0.5)];
    const theirs = [player('theirD1', ['D'], 2.8), player('theirD2', ['D'], 2.2), player('theirC', ['C'], 0.6)];
    const ranks = { myC1: 30, myC2: 60, myD: 250, theirD1: 35, theirD2: 80, theirC: 240 };
    const ideas = findTrades(workspace, mine, [{ name: 'Chubbs', roster: theirs }], inputs(ranks), dates);
    expect(ideas.map((idea) => [idea.give.id, idea.get.id])).toEqual([['myC1', 'theirD1'], ['myC2', 'theirD2']]);
    expect(ideas[0]).toMatchObject({ giveRank: 30, getRank: 35 });
    expect(ideas[0].myGain).toBeCloseTo(3.6);
  });

  it("never offers a star for a player the market ranks far lower, however the lineups work out", () => {
    const mine = [player('star', ['C'], 3), player('depth', ['C'], 2.8)];
    const theirs = [player('goalie', ['G'], 4.5), player('theirC', ['C'], 0.5)];
    const ideas = findTrades(workspace, mine, [{ name: 'Ackbar', roster: theirs }], inputs({ star: 20, depth: 90, goalie: 160, theirC: 300 }), dates);
    expect(ideas.find((idea) => idea.give.id === 'star')).toBeUndefined();
  });

  it("counts a goalie only on his expected starts, not every team game", () => {
    const mine = [player('myC', ['C'], 2), player('myC2', ['C'], 1.9)];
    // Their starter plays every day, so their backup is spare.
    const theirs = [player('starter', ['G'], 4), player('backup', ['G'], 4), player('theirC', ['C'], 0.5)];
    const ranks = { myC: 100, myC2: 110, starter: 20, backup: 105, theirC: 300 };
    // The backup starts one of the three days: 4 points in my empty G spot (not 8 from two team games), less 0.1 x 2 at C.
    const ideas = findTrades(workspace, mine, [{ name: 'Nybo', roster: theirs }], inputs(ranks, { starter: dates, backup: ['2026-10-07'] }), dates);
    const idea = ideas.find((entry) => entry.get.id === 'backup');
    expect(idea?.myGain).toBeCloseTo(3.8);
  });

  it('leaves out players without a market rank', () => {
    const mine = [player('myC1', ['C'], 3), player('myC2', ['C'], 2.5), player('myD', ['D'], 0.5)];
    const theirs = [player('theirD1', ['D'], 2.8), player('theirC', ['C'], 0.6)];
    expect(findTrades(workspace, mine, [{ name: 'Chubbs', roster: theirs }], inputs({ myC1: 30, myC2: 60 }), dates)).toEqual([]);
  });
});
