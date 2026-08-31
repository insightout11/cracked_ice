import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import type { DraftPlayer } from './playerSearch';
import { estimateNextPickAvailability, simulateYahooOpponentPicks } from './draftPlanner';

function player(index: number): DraftPlayer {
  return {
    id: String(index),
    name: `Player ${index}`,
    team: 'TBL',
    pos: ['C'],
    aliases: [],
    blendedFppg: 6 - (index / 100),
    productionValue: 6 - (index / 100),
    productionLabel: 'FPPG',
    yahooAdp: index,
    scoringBreakdown: null,
  };
}

describe('Draft planner simulations', () => {
  it('fills only opponent cells and stops before the next user pick', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { C: 2, BN: 1 };
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 3;
    const simulated = simulateYahooOpponentPicks(workspace, Array.from({ length: 20 }, (_, index) => player(index + 1)), 'to-next-pick', 7);
    expect(simulated.map((pick) => pick.overallPick)).toEqual([1, 2]);
    expect(simulated.every((pick) => pick.source === 'simulation' && pick.status === 'taken')).toBe(true);
  });

  it('fills all opponent cells while leaving every user round open', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { C: 2, BN: 1 };
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 2;
    const simulated = simulateYahooOpponentPicks(workspace, Array.from({ length: 30 }, (_, index) => player(index + 1)), 'rest-of-draft', 11);
    expect(simulated).toHaveLength(9);
    expect(simulated.map((pick) => pick.overallPick)).not.toContain(2);
    expect(simulated.map((pick) => pick.overallPick)).not.toContain(7);
    expect(simulated.map((pick) => pick.overallPick)).not.toContain(10);
  });

  it('returns bounded availability probabilities without changing the workspace', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 10;
    workspace.draftSession.mode = 'planner';
    workspace.draftSession.draftPosition = 5;
    const players = Array.from({ length: 40 }, (_, index) => player(index + 1));
    const estimates = estimateNextPickAvailability(workspace, players, players.slice(0, 8), 50);
    expect(estimates).toHaveLength(8);
    expect(estimates.every(({ probability }) => probability >= 0 && probability <= 100)).toBe(true);
    expect(workspace.draftSession.picks).toEqual([]);
  });
});
