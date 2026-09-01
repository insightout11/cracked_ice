import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import type { DraftPlayer } from './playerSearch';
import { estimateAvailabilityCurves, estimateNextPickAvailability, estimatePickAvailability, plannerPickTargets, simulateYahooOpponentPicks } from './draftPlanner';

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
    expect(estimates.every(({ probability }) => probability > 0 && probability < 100)).toBe(true);
    expect(workspace.draftSession.picks).toEqual([]);
  });

  it('exposes every open future user pick in snake-draft order', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 10;
    workspace.rosterRules.slots = { C: 2, LW: 2, RW: 2 };
    workspace.draftSession.draftPosition = 5;

    expect(plannerPickTargets(workspace).slice(0, 4)).toEqual([
      { round: 1, overallPick: 5 },
      { round: 2, overallPick: 16 },
      { round: 3, overallPick: 25 },
      { round: 4, overallPick: 36 },
    ]);
  });

  it('supports the same team order in every round for linear drafts', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 10;
    workspace.rosterRules.slots = { C: 2, LW: 2, RW: 2 };
    workspace.draftSession.draftPosition = 5;
    workspace.draftSession.orderType = 'linear';

    expect(plannerPickTargets(workspace).slice(0, 4)).toEqual([
      { round: 1, overallPick: 5 },
      { round: 2, overallPick: 15 },
      { round: 3, overallPick: 25 },
      { round: 4, overallPick: 35 },
    ]);
  });

  it('lowers availability at later picks and ignores prior simulated picks as settled truth', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 10;
    workspace.rosterRules.slots = { C: 4, BN: 2 };
    workspace.draftSession.draftPosition = 5;
    const players = Array.from({ length: 80 }, (_, index) => player(index + 1));
    const early = estimatePickAvailability(workspace, players, players.slice(15, 25), 16, 100);
    const later = estimatePickAvailability(workspace, players, players.slice(15, 25), 36, 100);
    expect(later[5].probability).toBeLessThan(early[5].probability);

    workspace.draftSession.picks = [{ playerId: '20', fullName: 'Player 20', team: 'TBL', positions: ['C'], status: 'taken', overallPick: 1, source: 'simulation', madeAt: '2026-08-31T00:00:00.000Z' }];
    expect(estimatePickAvailability(workspace, players, [players[19]], 16, 100)).toEqual(estimatePickAvailability({ ...workspace, draftSession: { ...workspace.draftSession, picks: [] } }, players, [players[19]], 16, 100));
  });

  it('keeps consensus elite players anchored to the opening picks', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 13;
    workspace.rosterRules.slots = { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4 };
    workspace.draftSession.draftPosition = 4;
    const players = Array.from({ length: 220 }, (_, index) => player(index + 1));
    players[0] = { ...players[0], name: 'Connor McDavid', yahooAdp: 1.5 };
    players[1] = { ...players[1], name: 'Nathan MacKinnon', yahooAdp: 2.5 };

    const atFour = estimatePickAvailability(workspace, players, [players[0], players[1]], 4, 500);
    const atSeventeen = estimatePickAvailability(workspace, players, [players[0], players[1]], 17, 500);

    expect(atFour[0].probability).toBeLessThan(5);
    expect(atFour[1].probability).toBeLessThan(8);
    expect(atSeventeen[0].probability).toBeLessThan(1);
    expect(atSeventeen[1].probability).toBeLessThan(1);
  });

  it('leaves a useful decision zone around a second-round pick', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 13;
    workspace.rosterRules.slots = { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4 };
    workspace.draftSession.draftPosition = 4;
    const players = Array.from({ length: 220 }, (_, index) => player(index + 1));
    const candidates = players.slice(13, 28);

    const estimates = estimatePickAvailability(workspace, players, candidates, 17, 500);
    const decisionZone = estimates.filter(({ probability }) => probability >= 30 && probability < 80);

    expect(decisionZone.length, JSON.stringify(estimates.map(({ yahooAdp, probability }) => ({ yahooAdp, probability })))).toBeGreaterThanOrEqual(4);
  });

  it('does not treat a five-pick slide from early-round ADP as nearly impossible', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 13;
    workspace.draftSession.draftPosition = 4;
    const players = Array.from({ length: 220 }, (_, index) => player(index + 1));
    players[11] = { ...players[11], name: 'Nick Suzuki', yahooAdp: 12 };

    const [estimate] = estimatePickAvailability(workspace, players, [players[11]], 17, 500);
    expect(estimate.probability).toBeGreaterThan(5);
    expect(estimate.probability).toBeLessThan(40);
  });

  it('does not leave the users earlier planner slots empty when estimating a late pick', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 13;
    workspace.draftSession.draftPosition = 4;
    const players = Array.from({ length: 240 }, (_, index) => player(index + 1));
    players[144] = { ...players[144], name: 'Elias Pettersson', yahooAdp: 144.5 };

    const [estimate] = estimatePickAvailability(workspace, players, [players[144]], 157, 500);

    expect(estimate.probability).toBeLessThan(50);
  });

  it('centers a players availability curve on Yahoo ADP', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 13;
    workspace.draftSession.draftPosition = 4;
    const players = Array.from({ length: 240 }, (_, index) => player(index + 1));
    players[144] = { ...players[144], name: 'Elias Pettersson', yahooAdp: 144.5 };

    const [estimate] = estimatePickAvailability(workspace, players, [players[144]], 144, 500);

    expect(estimate.probability).toBeGreaterThan(40);
    expect(estimate.probability).toBeLessThan(60);
  });

  it('builds a monotonic availability curve across every future user pick', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 10;
    workspace.rosterRules.slots = { C: 4, BN: 4 };
    workspace.draftSession.draftPosition = 5;
    const players = Array.from({ length: 100 }, (_, index) => player(index + 1));
    const targets = plannerPickTargets(workspace).slice(0, 5);
    const [curve] = estimateAvailabilityCurves(workspace, players, [players[39]], targets, 200);

    expect(curve.points).toHaveLength(5);
    expect(curve.points.every((point, index) => index === 0 || point.probability <= curve.points[index - 1].probability)).toBe(true);
  });

  it('removes reserved keeper picks from future planner targets', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-08-31T00:00:00.000Z', timezone: 'UTC' });
    workspace.numberOfTeams = 4;
    workspace.rosterRules.slots = { C: 1, BN: 2 };
    workspace.draftSession.draftPosition = 2;
    workspace.roster = [{
      playerId: 'keeper-1',
      fullName: 'Reserved Keeper',
      team: 'EDM',
      positions: ['C'],
      slot: 'BN',
      keeper: true,
      protected: false,
      undroppable: false,
    }];
    workspace.draftSession.keeperPickAssignments = [{ playerId: 'keeper-1', overallPick: 10 }];

    expect(plannerPickTargets(workspace).map((target) => target.overallPick)).toEqual([2, 7]);
  });
});
