import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { findTrades, replacementLevel, type TradeInputs } from './tradeFinder';

const player = (id: string, positions: string[], fppg: number): RosterPlayer => ({
  id, full_name: id, team: 'VAN', positions, games_played: 10, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 }, blendedFppg: fppg,
});

describe('trade finder', () => {
  const base = createDefaultLeagueWorkspace({ id: 'trades' });
  const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, D: 1, G: 1, BN: 2 } } };
  const dates = ['2026-10-06', '2026-10-07', '2026-10-08'];
  const bothGames = ['2026-10-06', '2026-10-08'];

  const inputs = (ranks: Record<string, number>, extra: Partial<TradeInputs> & { dates?: Record<string, string[]> } = {}): TradeInputs => ({
    gameDates: new Proxy(extra.dates ?? {}, { get: (target, id: string) => target[id] ?? bothGames }),
    marketRank: (entry) => ranks[entry.id],
    minMyGain: 0.5,
    minTheirGain: 0.5,
    ...extra,
  });

  it('swaps surplus for need when both lineups get better and the draft values match', () => {
    // I have two good centres and a weak D; they have two good D and a weak centre.
    const mine = [player('myC1', ['C'], 3), player('myC2', ['C'], 2.5), player('myD', ['D'], 0.5)];
    const theirs = [player('theirD1', ['D'], 2.8), player('theirD2', ['D'], 2.2), player('theirC', ['C'], 0.6)];
    const ranks = { myC1: 30, myC2: 60, myD: 250, theirD1: 35, theirD2: 80, theirC: 240 };
    const ideas = findTrades(workspace, mine, [{ name: 'Chubbs', roster: theirs }], inputs(ranks, { shapes: [[1, 1]] }), dates);
    expect(ideas.map((idea) => [idea.give.map((p) => p.id), idea.get.map((p) => p.id)])).toEqual([[['myC1'], ['theirD1']], [['myC2'], ['theirD2']]]);
    expect(ideas[0]).toMatchObject({ giveRanks: [30], getRanks: [35] });
    expect(ideas[0].myGain).toBeCloseTo(3.6);
    expect(ideas[0].pitch).toContain("you're short at D");
  });

  it('never offers a star for a player the market values far lower', () => {
    const mine = [player('star', ['C'], 3), player('depth', ['C'], 2.8)];
    const theirs = [player('goalie', ['G'], 4.5), player('theirC', ['C'], 0.5)];
    const ideas = findTrades(workspace, mine, [{ name: 'Ackbar', roster: theirs }], inputs({ star: 20, depth: 90, goalie: 160, theirC: 300 }), dates);
    expect(ideas.find((idea) => idea.give.some((p) => p.id === 'star'))).toBeUndefined();
  });

  it('counts a goalie only on his expected starts', () => {
    const mine = [player('myC', ['C'], 2), player('myC2', ['C'], 1.9)];
    const theirs = [player('starter', ['G'], 4), player('backup', ['G'], 4), player('theirC', ['C'], 0.5)];
    const ranks = { myC: 100, myC2: 110, starter: 20, backup: 105, theirC: 300 };
    // The backup starts one of the three days: 4 points in my empty G spot, not 8 from his team's two games.
    // Sending my bench centre costs nothing.
    const ideas = findTrades(workspace, mine, [{ name: 'Nybo', roster: theirs }], inputs(ranks, { shapes: [[1, 1]], dates: { starter: dates, backup: ['2026-10-07'] } }), dates);
    expect(ideas.find((entry) => entry.get[0].id === 'backup')).toMatchObject({ give: [{ id: 'myC2' }] });
    expect(ideas.find((entry) => entry.get[0].id === 'backup')?.myGain).toBeCloseTo(4);
    expect(ideas[0].pitch).toContain('Nybo have 2 goalies for 1 spot');
  });

  it('only counts what a trade adds beyond the best free agent', () => {
    const mine = [player('myC', ['C'], 2), player('myC2', ['C'], 1.9)];
    const theirs = [player('starter', ['G'], 4), player('backup', ['G'], 4), player('theirC', ['C'], 0.5)];
    const ranks = { myC: 100, myC2: 110, starter: 20, backup: 105, theirC: 300 };
    // A free-agent goalie as good as their backup, starting the same night: the trade adds nothing.
    const freeAgent = player('fa-goalie', ['G'], 4);
    const ideas = findTrades(workspace, mine, [{ name: 'Nybo', roster: theirs }], inputs(ranks, { shapes: [[1, 1]], replacement: [freeAgent], dates: { starter: dates, backup: ['2026-10-07'], 'fa-goalie': ['2026-10-07'] } }), dates);
    expect(ideas).toEqual([]);
  });

  it('finds a 2-for-1 when two of your players are worth one of theirs', () => {
    // My two spare D for their star C: I upgrade C, they fill D and cut their weakest.
    const mine = [player('myD1', ['D'], 3), player('myD2', ['D'], 2.8), player('myD3', ['D'], 2.6), player('myC', ['C'], 0.5)];
    const theirs = [player('star', ['C'], 3.4), player('theirC2', ['C'], 3), player('theirD', ['D'], 0.4)];
    const ranks = { myD1: 40, myD2: 50, myD3: 60, myC: 250, star: 15, theirC2: 70, theirD: 260 };
    const ideas = findTrades(workspace, mine, [{ name: 'Ladybugs', roster: theirs }], inputs(ranks, { shapes: [[2, 1]] }), dates);
    expect(ideas[0]).toMatchObject({ give: [{ id: 'myD2' }, { id: 'myD3' }], get: [{ id: 'star' }] });
    // (3.4 - 0.5) x 2 game days for me; (3.0 + 2.8 - 3.4 - 0.4) x 2 for them.
    expect(ideas[0].myGain).toBeCloseTo(5.8);
    expect(ideas[0].theirGain).toBeCloseTo(4);
    expect(ideas[0].valueMatch).toBeGreaterThan(0.7);
    expect(ideas[0].pitch).toContain('they get two players for one');
  });

  it('leaves out players without a market rank', () => {
    const mine = [player('myC1', ['C'], 3), player('myC2', ['C'], 2.5), player('myD', ['D'], 0.5)];
    const theirs = [player('theirD1', ['D'], 2.8), player('theirC', ['C'], 0.6)];
    expect(findTrades(workspace, mine, [{ name: 'Chubbs', roster: theirs }], inputs({ myC1: 30, myC2: 60 }), dates)).toEqual([]);
  });

  it('picks replacement level: the best free agent at each skater position and one per G spot', () => {
    const agents = [player('c-good', ['C'], 2), player('c-meh', ['C'], 1), player('lw', ['LW'], 1.5), player('d', ['D'], 1.2), player('g1', ['G'], 3), player('g2', ['G'], 2.5)];
    const chosen = replacementLevel(workspace, agents, new Proxy({}, { get: () => bothGames }));
    expect(chosen.map((p) => p.id).sort()).toEqual(['c-good', 'd', 'g1', 'lw']);
  });
});
