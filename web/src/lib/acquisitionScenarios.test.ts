import { describe, expect, it } from 'vitest';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { evaluateAcquisitionScenarios } from './acquisitionScenarios';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const player = (id: string, positions: string[], slot?: string, gamesPlayed = 40): RosterPlayer => ({
  id,
  full_name: id,
  team: 'TBL',
  positions,
  current_slot: slot,
  games_played: gamesPlayed,
  stats,
});
const projection = (fppg: number, dates: string[]): PlayerProjection => ({
  fppg,
  starts: dates.length,
  gamesAvailable: dates.length,
  projectedPoints: fppg * dates.length,
  offNightRate: 0.5,
  strengthOfSchedule: 50,
  startsByDate: Object.fromEntries(dates.map((date) => [date, 1])),
  gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'BOS', isHome: true, isOffNight: true, startTime: '' }])),
});

function workspaceWithSlots(slots: Record<string, number>) {
  const workspace = createDefaultLeagueWorkspace({ id: 'league-1', now: '2026-09-20T00:00:00.000Z', timezone: 'UTC' });
  workspace.rosterRules.slots = slots;
  workspace.acquisitions = { limit: 4, period: 'week', movesUsed: 0, addTiming: 'same-day', waiverDelayDays: 0 };
  return workspace;
}

describe('acquisition scenario foundation', () => {
  it('uses an add-only scenario when legal regular roster capacity remains', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 1, IR: 2 });
    workspace.roster = [{ playerId: 'anchor', fullName: 'anchor', team: 'BOS', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
    const result = evaluateAcquisitionScenarios(
      workspace,
      [player('anchor', ['C'], 'C')],
      player('add', ['C']),
      {
        anchor: projection(4, ['2026-10-01']),
        add: projection(5, ['2026-10-02']),
      },
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', calculatedAt: '2026-09-20T00:00:00.000Z', availabilityStatus: 'available', availabilityExpiresAt: '2026-09-21T00:00:00.000Z', transactionType: 'free-agent', productionBasis: 'upcoming-projection' },
    );

    expect(result.status).toBe('ready');
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]).toMatchObject({
      lane: 'fill-roster',
      drop: null,
      baseline: { projectedPoints: 4, usableStarts: 1 },
      result: { projectedPoints: 9, usableStarts: 2 },
      impact: { projectedPointsDelta: 5, usableStartsDelta: 1 },
      dropProtection: { status: 'not-needed' },
      materiality: { outcome: 'recommend' },
    });
  });

  it('never turns games before a conservative waiver effective date into points', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 1 });
    workspace.acquisitions = { limit: 4, period: 'week', movesUsed: 0, addTiming: 'next-day', waiverDelayDays: 1 };
    workspace.roster = [{ playerId: 'anchor', fullName: 'anchor', team: 'BOS', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
    const result = evaluateAcquisitionScenarios(
      workspace,
      [player('anchor', ['C'], 'C')],
      player('add', ['C']),
      { anchor: projection(4, ['2026-10-01']), add: projection(5, ['2026-10-01', '2026-10-03']) },
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', transactionType: 'unknown' },
    );

    expect(result.scenarios[0].transaction).toMatchObject({ effectiveDate: '2026-10-03' });
    expect(result.scenarios[0].transaction.assumptions).toContain('Availability type is unknown; waiver delay is applied conservatively.');
    expect(result.scenarios[0].impact).toMatchObject({ candidateGames: 1, candidateStartDates: ['2026-10-03'] });
    expect(result.scenarios[0].materiality.outcome).toBe('conditional');
  });

  it('withholds automatic no-sample targets without participation evidence', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 1 });
    workspace.roster = [{ playerId: 'anchor', fullName: 'anchor', team: 'BOS', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
    const result = evaluateAcquisitionScenarios(
      workspace,
      [player('anchor', ['C'], 'C')],
      player('prospect', ['C'], undefined, 0),
      { anchor: projection(4, ['2026-10-01']), prospect: projection(8, ['2026-10-02']) },
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', discoverySource: 'automatic', transactionType: 'free-agent' },
    );

    expect(result.scenarios[0].participation.status).toBe('unsupported');
    expect(result.scenarios[0].materiality.outcome).toBe('conditional');
    expect(result.scenarios[0].materiality.reason).toContain('unsupported participation');
  });

  it('keeps a positive move conditional while availability is unknown', () => {
    const workspace = workspaceWithSlots({ C: 1 });
    workspace.roster = [{ playerId: 'drop', fullName: 'drop', team: 'BOS', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
    const result = evaluateAcquisitionScenarios(
      workspace,
      [player('drop', ['C'], 'C')],
      player('candidate', ['C']),
      { drop: projection(2, ['2026-10-01']), candidate: projection(6, ['2026-10-01']) },
      {
        analysisStart: '2026-10-01',
        analysisEnd: '2026-10-01',
        availabilityStatus: 'unknown',
        transactionType: 'free-agent',
        participation: { confirmedRole: true },
        productionBasis: 'upcoming-projection',
      },
    );

    expect(result.scenarios[0].materiality).toMatchObject({ outcome: 'conditional' });
    expect(result.scenarios[0].materiality.reason).toContain('availability');
  });

  it('keeps goalie team schedules separate from uncertain future participation', () => {
    const workspace = workspaceWithSlots({ G: 1, BN: 1 });
    workspace.roster = [{ playerId: 'starter', fullName: 'starter', team: 'BOS', positions: ['G'], slot: 'G', keeper: false, protected: false, undroppable: false }];
    const result = evaluateAcquisitionScenarios(
      workspace,
      [player('starter', ['G'], 'G')],
      player('goalie', ['G']),
      { starter: projection(4, ['2026-10-01']), goalie: projection(6, ['2026-10-02']) },
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', transactionType: 'free-agent' },
    );

    expect(result.scenarios[0].impact.candidateGames).toBe(1);
    expect(result.scenarios[0].participation).toMatchObject({ status: 'uncertain' });
    expect(result.scenarios[0].participation.reason).toContain('team games are known');
  });

  it('protects stronger long-term holds and prioritizes a user-selected drop without hiding alternatives', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 1 });
    workspace.roster = [
      { playerId: 'star', fullName: 'star', team: 'BOS', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false },
      { playerId: 'bench', fullName: 'bench', team: 'NYR', positions: ['C'], slot: 'BN', keeper: false, protected: false, undroppable: false },
    ];
    const result = evaluateAcquisitionScenarios(
      workspace,
      [player('star', ['C'], 'C'), player('bench', ['C'], 'BN')],
      player('add', ['C']),
      {
        star: projection(8, ['2026-10-01']),
        bench: projection(2, ['2026-10-02']),
        add: projection(5, ['2026-10-03']),
      },
      {
        analysisStart: '2026-10-01',
        analysisEnd: '2026-10-07',
        selectedDropId: 'star',
        productionBasis: 'upcoming-projection',
        transactionType: 'free-agent',
        participation: { confirmedRole: true },
      },
    );

    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0].drop?.id).toBe('star');
    expect(result.scenarios[0].dropProtection.status).toBe('warning');
    expect(result.scenarios[0].materiality.outcome).toBe('no-positive-improvement');
    expect(result.scenarios[1].drop?.id).toBe('bench');
    expect(result.scenarios[1].dropProtection.status).toBe('passed');
  });

  it('distinguishes no legal move from no positive improvement', () => {
    const workspace = workspaceWithSlots({ C: 1 });
    workspace.roster = [{ playerId: 'anchor', fullName: 'anchor', team: 'BOS', positions: ['C'], slot: 'C', keeper: true, protected: true, undroppable: true }];
    const noLegal = evaluateAcquisitionScenarios(
      workspace,
      [player('anchor', ['C'], 'C')],
      player('add', ['C']),
      { anchor: projection(5, ['2026-10-01']), add: projection(4, ['2026-10-01']) },
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07' },
    );
    expect(noLegal).toMatchObject({ status: 'no-legal-move', scenarios: [] });

    workspace.roster[0] = { ...workspace.roster[0], keeper: false, protected: false, undroppable: false };
    const noGain = evaluateAcquisitionScenarios(
      workspace,
      [player('anchor', ['C'], 'C')],
      player('add', ['C']),
      { anchor: projection(5, ['2026-10-01']), add: projection(4, ['2026-10-01']) },
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', productionBasis: 'upcoming-projection', transactionType: 'free-agent', participation: { confirmedRole: true } },
    );
    expect(noGain.scenarios[0].materiality.outcome).toBe('no-positive-improvement');
  });

  it('keeps scenario identity stable while fingerprinting changed calculations', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 1 });
    workspace.roster = [{ playerId: 'anchor', fullName: 'anchor', team: 'BOS', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
    const baseOptions = { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', calculatedAt: '2026-09-20T00:00:00.000Z' } as const;
    const first = evaluateAcquisitionScenarios(workspace, [player('anchor', ['C'], 'C')], player('add', ['C']), {
      anchor: projection(4, ['2026-10-01']), add: projection(5, ['2026-10-02']),
    }, baseOptions).scenarios[0];
    const recalculated = evaluateAcquisitionScenarios(workspace, [player('anchor', ['C'], 'C')], player('add', ['C']), {
      anchor: projection(4, ['2026-10-01']), add: projection(6, ['2026-10-02']),
    }, baseOptions).scenarios[0];

    expect(recalculated.id).toBe(first.id);
    expect(recalculated.calculationFingerprint).not.toBe(first.calculationFingerprint);
  });

  it('bounds exact drop calculations while preserving a selected drop', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 3 });
    workspace.roster = ['one', 'two', 'three', 'four'].map((id, index) => ({
      playerId: id,
      fullName: id,
      team: 'BOS',
      positions: ['C'],
      slot: index === 0 ? 'C' : 'BN',
      keeper: false,
      protected: false,
      undroppable: false,
    }));
    const projections = Object.fromEntries([
      ...workspace.roster.map((entry, index) => [entry.playerId, projection(index + 1, [`2026-10-0${index + 1}`])]),
      ['add', projection(5, ['2026-10-05'])],
    ]);
    const result = evaluateAcquisitionScenarios(
      workspace,
      workspace.roster.map((entry) => player(entry.playerId, ['C'], entry.slot)),
      player('add', ['C']),
      projections,
      { analysisStart: '2026-10-01', analysisEnd: '2026-10-07', selectedDropId: 'four', maxDropCandidates: 2 },
    );

    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0].drop?.id).toBe('four');
  });
});
