import { describe, expect, it } from 'vitest';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { planStreamingMoves } from './streamingPlanner';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const player = (id: string, fppg: number, dates: string[]): { player: RosterPlayer; projection: PlayerProjection } => ({
  player: { id, full_name: id, team: id.toUpperCase(), positions: ['C'], games_played: 0, stats },
  projection: {
    fppg,
    starts: dates.length,
    gamesAvailable: dates.length,
    projectedPoints: fppg * dates.length,
    offNightRate: 0.5,
    strengthOfSchedule: 50,
    startsByDate: Object.fromEntries(dates.map((date) => [date, 1])),
    gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'BOS', isHome: true, isOffNight: true, startTime: '' }])),
  },
});

function fixture() {
  const workspace = createDefaultLeagueWorkspace({ now: '2026-07-22T00:00:00.000Z', timezone: 'UTC' });
  workspace.rosterRules.slots = { C: 1, BN: 3 };
  workspace.acquisitions = { limit: 3, movesUsed: 0, period: 'matchup', addTiming: 'same-day', waiverDelayDays: 0 };
  workspace.roster = [{ playerId: 'base', fullName: 'base', team: 'TBL', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
  const base = player('base', 1, ['2026-10-01']);
  const a = player('a', 5, ['2026-10-01', '2026-10-02']);
  const b = player('b', 5, ['2026-10-03', '2026-10-04']);
  const c = player('c', 5, ['2026-10-05', '2026-10-06']);
  workspace.candidates = [a, b, c].map(({ player: candidate }) => ({
    playerId: candidate.id,
    availability: 'user-confirmed' as const,
    observedAt: '2026-09-30T12:00:00.000Z',
    expiresAt: '2026-10-01T12:00:00.000Z',
  }));
  return {
    workspace,
    roster: [base.player],
    candidates: [a.player, b.player, c.player],
    projections: { base: base.projection, a: a.projection, b: b.projection, c: c.projection } as Record<string, PlayerProjection>,
  };
}

describe('streaming planner', () => {
  it('proves one-, two-, and three-move gains against a zero-move baseline', () => {
    const data = fixture();
    const result = planStreamingMoves(data.workspace, data.roster, data.candidates, data.projections, { start: '2026-10-01', end: '2026-10-06' });

    expect(result.baseline).toMatchObject({ moveCount: 0, projectedPoints: 1, projectedStarts: 1 });
    expect(result.plansByMoveCount[1][0]).toMatchObject({ projectedPoints: 11, pointsDelta: 10, projectedStarts: 3 });
    expect(result.plansByMoveCount[2][0]).toMatchObject({ projectedPoints: 21, pointsDelta: 20, projectedStarts: 5 });
    expect(result.plansByMoveCount[3][0]).toMatchObject({ projectedPoints: 30, pointsDelta: 29, projectedStarts: 6, remainingMoves: 0 });
  });

  it('never drops a protected player or counts a same-night blocked game as a start', () => {
    const data = fixture();
    const anchor = player('anchor', 10, ['2026-10-01']);
    data.workspace.roster.push({ playerId: 'anchor', fullName: 'anchor', team: 'BOS', positions: ['C'], slot: 'BN', keeper: false, protected: true, undroppable: false });
    data.roster.push(anchor.player);
    data.projections.anchor = anchor.projection;
    const result = planStreamingMoves(data.workspace, data.roster, [data.candidates[0]], data.projections, { start: '2026-10-01', end: '2026-10-02' }, { maxMoves: 1 });
    const plan = result.plansByMoveCount[1][0];

    expect(plan.moves[0].drop.id).toBe('base');
    expect(plan.daily[0]).toMatchObject({ baselineStarts: 1, plannedStarts: 1, startsDelta: 0 });
    expect(plan.projectedStarts).toBe(2);
  });

  it('caps plans at remaining moves and restricts weekly-lock moves to the window start', () => {
    const data = fixture();
    data.workspace.acquisitions.movesUsed = 2;
    data.workspace.acquisitions.addTiming = 'next-day';
    data.workspace.rosterRules.lockingMode = 'weekly';
    const result = planStreamingMoves(data.workspace, data.roster, data.candidates, data.projections, { start: '2026-10-01', end: '2026-10-06' });

    expect(result.maxMoves).toBe(1);
    expect(result.plansByMoveCount[2]).toBeUndefined();
    expect(result.plansByMoveCount[1][0].moves[0].effectiveDate).toBe('2026-10-01');
    expect(result.plansByMoveCount[1][0].moves[0].actionDate).toBe('2026-09-30');
  });

  it('handles a realistic roster and candidate set within the bounded search', () => {
    const data = fixture();
    data.workspace.rosterRules.slots = { C: 4, BN: 12 };
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
    const rosterPlayers = Array.from({ length: 16 }, (_, index) => player(`roster-${index}`, 1 + (index % 4), dates.filter((_, day) => (day + index) % 3 === 0)));
    const candidatePlayers = Array.from({ length: 12 }, (_, index) => player(`candidate-${index}`, 3 + (index % 4), dates.filter((_, day) => (day + index) % 2 === 0)));
    data.workspace.roster = rosterPlayers.map(({ player: rosterPlayer }, index) => ({
      playerId: rosterPlayer.id,
      fullName: rosterPlayer.full_name,
      team: rosterPlayer.team,
      positions: rosterPlayer.positions,
      slot: index < 4 ? 'C' : 'BN',
      keeper: false,
      protected: false,
      undroppable: false,
    }));
    data.workspace.candidates = candidatePlayers.map(({ player: candidate }) => ({
      playerId: candidate.id,
      availability: 'user-confirmed' as const,
      observedAt: '2026-09-30T12:00:00.000Z',
      expiresAt: '2026-10-01T12:00:00.000Z',
    }));
    const projections = Object.fromEntries([...rosterPlayers, ...candidatePlayers].map(({ player: item, projection }) => [item.id, projection]));

    const result = planStreamingMoves(
      data.workspace,
      rosterPlayers.map(({ player: rosterPlayer }) => rosterPlayer),
      candidatePlayers.map(({ player: candidate }) => candidate),
      projections,
      { start: dates[0], end: dates[6] },
    );

    expect(result.plansByMoveCount[3]).toHaveLength(3);
    expect(result.plansByMoveCount[3][0].projectedPoints).toBeGreaterThanOrEqual(result.baseline.projectedPoints);
  }, 10_000);
});
