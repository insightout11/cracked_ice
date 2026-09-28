import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { findTrades } from './tradeFinder';

const player = (id: string, positions: string[], fppg: number): RosterPlayer => ({
  id, full_name: id, team: 'VAN', positions, games_played: 10, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 }, blendedFppg: fppg,
});

describe('trade finder', () => {
  const base = createDefaultLeagueWorkspace({ id: 'trades' });
  const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, D: 1, BN: 2 } } };
  const teamGames = { VAN: ['2026-10-06', '2026-10-08'] };
  const dates = ['2026-10-06', '2026-10-07', '2026-10-08'];

  it('swaps surplus for need when both lineups get better, and skips one-sided deals', () => {
    // I have two good centres and a weak D; they have two good D and a weak centre.
    const mine = [player('myC1', ['C'], 3), player('myC2', ['C'], 2.5), player('myD', ['D'], 0.5)];
    const theirs = [player('theirD1', ['D'], 2.8), player('theirD2', ['D'], 2.2), player('theirC', ['C'], 0.6)];
    const lopsided = [player('star', ['C'], 5), player('bench', ['D'], 0.4)];
    const ideas = findTrades(workspace, mine, [{ name: 'Chubbs', roster: theirs }, { name: 'Ladybugs', roster: lopsided }], teamGames, dates);
    // Best balanced: my 3.0 C for their 2.8 D gains both sides 1.8 a game day, over two game days.
    expect(ideas.map((idea) => [idea.team, idea.give.id, idea.get.id])).toEqual([['Chubbs', 'myC1', 'theirD1'], ['Chubbs', 'myC2', 'theirD2']]);
    expect(ideas[0].myGain).toBeCloseTo(3.6);
    expect(ideas[0].theirGain).toBeCloseTo(3.6);
    // Ladybugs would only lose by trading their star or gain nothing from my spare centre.
    expect(ideas.some((idea) => idea.team === 'Ladybugs')).toBe(false);
  });
});
