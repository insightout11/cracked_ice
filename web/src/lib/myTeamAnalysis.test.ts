import { describe, expect, it } from 'vitest';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { analyzeKeeperRosterPlan, analyzeMyTeam, assignImportedRosterSlots, enrichWorkspaceRosterPlayers, reconcileWorkspaceRoster, rosterPlayersFromWorkspace, shouldAdoptLegacyRoster } from './myTeamAnalysis';

const NOW = '2026-07-22T12:00:00.000Z';
const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };

function player(id: string, slot: string): RosterPlayer {
  return { id, full_name: `Player ${id}`, team: 'TBL', positions: ['C'], current_slot: slot, games_played: 82, stats };
}

function projection(starts: number, gamesAvailable: number): PlayerProjection {
  return {
    fppg: 3,
    starts,
    gamesAvailable,
    projectedPoints: starts * 3,
    offNightRate: 0.5,
    strengthOfSchedule: 50,
    gamesByDate: {
      '2026-10-10': { opponent: 'BOS', isHome: true, isOffNight: true, startTime: '' },
      '2026-10-11': { opponent: 'NYR', isHome: false, isOffNight: false, startTime: '' },
    },
  };
}

describe('My Team analysis', () => {
  it('assigns pasted players to eligible active slots before the bench and never uses IR as overflow', () => {
    const imported = [
      { ...player('c1', ''), positions: ['C'] },
      { ...player('lw1', ''), positions: ['LW', 'RW'] },
      { ...player('d1', ''), positions: ['D'] },
      { ...player('g1', ''), positions: ['G'] },
      { ...player('extra', ''), positions: ['C', 'LW', 'RW'] },
    ];

    const assigned = assignImportedRosterSlots([], imported, { C: 1, LW: 1, D: 1, G: 1, BN: 1, IR: 2 });

    expect(assigned.map((entry) => entry.current_slot)).toEqual(['C', 'LW', 'D', 'G', 'BN']);
  });

  it('preserves keeper flags when the server roster is reconciled', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.roster = [{ playerId: '1', fullName: 'Old name', team: 'TBL', positions: ['C'], slot: 'C', keeper: true, keeperCost: { type: 'draft-round', round: 4 }, protected: true, undroppable: false }];

    const reconciled = reconcileWorkspaceRoster(workspace.roster, [player('1', 'C'), player('2', 'BN')]);

    expect(reconciled[0]).toMatchObject({ fullName: 'Player 1', keeper: true, keeperCost: { type: 'draft-round', round: 4 }, protected: true });
    expect(reconciled[1]).toMatchObject({ keeper: false, protected: false });
  });

  it('keeps a saved workspace roster authoritative over an empty or stale legacy roster', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.roster = reconcileWorkspaceRoster([], [player('saved', 'C')]);

    expect(shouldAdoptLegacyRoster(workspace, [])).toBe(false);
    expect(shouldAdoptLegacyRoster(workspace, [player('legacy', 'BN')])).toBe(false);
    expect(rosterPlayersFromWorkspace(workspace)).toEqual([
      expect.objectContaining({ id: 'saved', full_name: 'Player saved', team: 'TBL', positions: ['C'], current_slot: 'C' }),
    ]);
  });

  it('adopts a legacy roster only for an otherwise empty migratable workspace', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    expect(shouldAdoptLegacyRoster(workspace, [player('legacy', 'BN')])).toBe(true);

    workspace.source = { kind: 'legacy-coach', label: 'Migration already reviewed' };
    expect(shouldAdoptLegacyRoster(workspace, [player('legacy', 'BN')])).toBe(false);

    workspace.source = { kind: 'manual', label: 'Edited manually' };
    expect(shouldAdoptLegacyRoster(workspace, [player('legacy', 'BN')])).toBe(false);
  });

  it('uses legacy player details only to enrich members already saved in the workspace', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.roster = reconcileWorkspaceRoster([], [player('saved', 'C')]);
    workspace.roster[0] = {
      ...workspace.roster[0],
      fullName: 'Saved Yahoo identity',
      team: 'WSH',
      positions: ['C', 'LW'],
    };
    const enrichedSaved = {
      ...player('saved', 'BN'),
      full_name: 'Stale directory identity',
      team: 'CBJ',
      positions: ['C'],
      seasonFppg: 4.2,
    };

    const enriched = enrichWorkspaceRosterPlayers(workspace, [enrichedSaved, player('server-only', 'BN')]);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toMatchObject({
      id: 'saved',
      full_name: 'Saved Yahoo identity',
      team: 'WSH',
      positions: ['C', 'LW'],
      current_slot: 'C',
      seasonFppg: 4.2,
    });
  });

  it('can refresh saved positions from a provider-specific player directory', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.roster = reconcileWorkspaceRoster([], [{ ...player('saved', 'BN'), positions: ['C', 'LW'] }]);
    const yahooPlayer = { ...player('saved', 'BN'), positions: ['C', 'LW', 'RW'] };

    const enriched = enrichWorkspaceRosterPlayers(workspace, [yahooPlayer], true);

    expect(enriched[0].positions).toEqual(['C', 'LW', 'RW']);
  });

  it('reports roster construction and schedule pressure with explicit units', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.rosterRules.slots = { C: 2, D: 1, BN: 2 };
    workspace.roster = reconcileWorkspaceRoster([], [player('1', 'C'), player('2', 'BN')]);
    workspace.roster[0].keeper = true;
    workspace.acquisitions = { limit: 4, period: 'week', movesUsed: 1, addTiming: 'same-day', waiverDelayDays: 0 };

    const result = analyzeMyTeam(
      workspace,
      { '1': projection(3, 4), '2': projection(2, 5) },
      { '2026-10-10': { C: 1 }, '2026-10-11': { D: 2 }, '2026-10-12': { BN: 4 } },
    );

    expect(result).toMatchObject({
      activeSlotCapacity: 3,
      emptyActiveSlots: 2,
      projectedBenchGames: 4,
      unusedLineupOpportunities: 3,
      gapNights: 2,
      offNightStarts: 3,
      backToBacks: 2,
      keeperCount: 1,
      movesRemaining: 3,
    });
    expect(result.positionNeeds).toEqual([{ position: 'C', count: 1 }, { position: 'D', count: 1 }]);
  });

  it('normalizes indexed bench and IR slots when counting empty active positions', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.rosterRules.slots = { C: 1, D: 1, BN: 1, IR: 1 };
    workspace.roster = reconcileWorkspaceRoster([], [player('bench', 'BN-0'), player('injured', 'IR-0')]);

    const result = analyzeMyTeam(workspace, {}, {});

    expect(result.emptyActiveSlots).toBe(2);
    expect(result.positionNeeds).toEqual([{ position: 'C', count: 1 }, { position: 'D', count: 1 }]);
  });

  it('turns keepers into occupied draft slots and remaining position needs', () => {
    const workspace = createDefaultLeagueWorkspace({ now: NOW, timezone: 'UTC' });
    workspace.rosterRules.slots = { C: 2, LW: 1, RW: 1, D: 2, G: 1, BN: 3 };
    workspace.keeperRules.maximumKeepers = 3;
    workspace.roster = [
      { playerId: '1', fullName: 'Center', team: 'TBL', positions: ['C'], slot: 'C-0', keeper: true, protected: false, undroppable: false },
      { playerId: '2', fullName: 'Wing', team: 'TBL', positions: ['LW', 'RW'], slot: 'BN-0', keeper: true, protected: false, undroppable: false },
    ];

    expect(analyzeKeeperRosterPlan(workspace)).toEqual({
      keeperCount: 2,
      maximumKeepers: 3,
      remainingKeeperSlots: 1,
      occupiedActiveSlots: 2,
      positionNeeds: [
        { position: 'C', count: 1 },
        { position: 'RW', count: 1 },
        { position: 'D', count: 2 },
        { position: 'G', count: 1 },
      ],
    });
  });
});
