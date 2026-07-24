import { describe, expect, it } from 'vitest';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { rankAddDropPairs } from './acquisitionAnalysis';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { createAcquisitionDemo } from './acquisitionDemo';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const player = (id: string, positions: string[], slot?: string): RosterPlayer => ({ id, full_name: id, team: 'TBL', positions, current_slot: slot, games_played: 0, stats });
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
  const workspace = createDefaultLeagueWorkspace({ now: '2026-07-22T00:00:00.000Z', timezone: 'UTC' });
  workspace.rosterRules.slots = slots;
  return workspace;
}

describe('Acquisition analysis', () => {
  it('ranks a hand-computed add/drop pair from daily lineup points and capacity', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 2 });
    workspace.roster = [
      { playerId: 'drop', fullName: 'Drop', team: 'TBL', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false },
      { playerId: 'anchor', fullName: 'Anchor', team: 'BOS', positions: ['C'], slot: 'BN', keeper: false, protected: true, undroppable: false },
    ];
    const results = rankAddDropPairs(workspace, [player('drop', ['C'], 'C'), player('anchor', ['C'], 'BN')], [player('add', ['C'])], {
      drop: projection(4, ['2026-10-10', '2026-10-11']),
      anchor: projection(6, ['2026-10-10']),
      add: projection(5, ['2026-10-10', '2026-10-12']),
    });

    expect(results[0]).toMatchObject({
      projectedPointsDelta: 1,
      startsDelta: 0,
      gamesDelta: 0,
      dropCost: 4,
      dropStarts: 1,
      candidateStarts: 1,
      candidateGames: 2,
      candidateCongestionGames: 1,
      candidateStartDates: ['2026-10-12'],
      candidateBlockedDates: ['2026-10-10'],
    });
  });

  it('uses flex eligibility instead of requiring the candidate to match the dropped saved slot', () => {
    const workspace = workspaceWithSlots({ C: 1, UTIL: 1, BN: 2 });
    workspace.roster = [
      { playerId: 'center', fullName: 'Center', team: 'TBL', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false },
      { playerId: 'defense', fullName: 'Defense', team: 'BOS', positions: ['D'], slot: 'UTIL', keeper: false, protected: false, undroppable: false },
    ];
    const results = rankAddDropPairs(workspace, [player('center', ['C'], 'C'), player('defense', ['D'], 'UTIL')], [player('wing', ['RW'])], {
      center: projection(4, ['2026-10-10']),
      defense: projection(2, ['2026-10-10']),
      wing: projection(5, ['2026-10-10']),
    });

    expect(results.some((result) => result.drop.id === 'defense' && result.projectedPointsDelta === 3)).toBe(true);
  });

  it('never recommends keepers, protected, undroppable, or inactive-slot players as drops', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 4, IR: 2 });
    workspace.roster = [
      { playerId: 'keeper', fullName: 'Keeper', team: 'TBL', positions: ['C'], slot: 'C', keeper: true, protected: false, undroppable: false },
      { playerId: 'protected', fullName: 'Protected', team: 'BOS', positions: ['C'], slot: 'BN', keeper: false, protected: true, undroppable: false },
      { playerId: 'undroppable', fullName: 'Undroppable', team: 'NYR', positions: ['C'], slot: 'BN', keeper: false, protected: false, undroppable: true },
      { playerId: 'injured', fullName: 'Injured', team: 'CAR', positions: ['C'], slot: 'IR', keeper: false, protected: false, undroppable: false },
      { playerId: 'drop', fullName: 'Drop', team: 'ANA', positions: ['C'], slot: 'BN', keeper: false, protected: false, undroppable: false },
    ];
    const roster = workspace.roster.map((entry) => player(entry.playerId, entry.positions, entry.slot));
    const projections = Object.fromEntries([...workspace.roster.map((entry) => entry.playerId), 'add'].map((id) => [id, projection(id === 'add' ? 5 : 2, ['2026-10-10'])]));
    const results = rankAddDropPairs(workspace, roster, [player('add', ['C'])], projections);

    expect(new Set(results.map((result) => result.drop.id))).toEqual(new Set(['drop']));
  });

  it('normalizes nhl-prefixed IDs when matching projections', () => {
    const workspace = workspaceWithSlots({ C: 1, BN: 1 });
    workspace.roster = [{ playerId: 'nhl:10', fullName: 'Drop', team: 'TBL', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }];
    const results = rankAddDropPairs(workspace, [player('nhl:10', ['C'], 'C')], [player('nhl:20', ['C'])], {
      10: projection(2, ['2026-10-10']),
      20: projection(4, ['2026-10-10']),
    });
    expect(results[0].projectedPointsDelta).toBe(2);
  });

  it('keeps the visual off-season test scenario deterministic', () => {
    const scenario = createAcquisitionDemo(createDefaultLeagueWorkspace({ now: '2026-07-22T00:00:00.000Z', timezone: 'UTC' }));
    const result = rankAddDropPairs(scenario.workspace, scenario.roster, scenario.candidates, scenario.projections)[0];

    expect(result).toMatchObject({
      candidateStarts: scenario.expected.candidateStarts,
      candidateGames: scenario.expected.candidateGames,
      candidateCongestionGames: scenario.expected.blockedGames,
      startsDelta: scenario.expected.startsDelta,
      projectedPointsDelta: scenario.expected.pointsDelta,
    });
  });
});
