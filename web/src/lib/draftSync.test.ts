import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { draftSyncAge, reconcileProviderDraftSnapshot, type ProviderDraftSnapshot } from './draftSync';
import type { DraftPlayer } from './playerSearch';

const players: DraftPlayer[] = [
  { id: 'nhl:1', name: 'First Player', team: 'TBL', pos: ['RW'], aliases: [], blendedFppg: 4, productionValue: 4, productionLabel: 'FPPG', scoringBreakdown: null },
  { id: 'nhl:2', name: 'Second Player', team: 'COL', pos: ['C'], aliases: [], blendedFppg: 5, productionValue: 5, productionLabel: 'FPPG', scoringBreakdown: null },
];

function snapshot(picks: ProviderDraftSnapshot['picks'], fetchedAt = '2026-07-24T01:00:00.000Z'): ProviderDraftSnapshot {
  return { provider: 'yahoo', fetchedAt, leagueId: 'league-1', myTeamId: 'team-me', draftStatus: 'in-progress', picks };
}

describe('provider draft reconciliation', () => {
  it('adds mapped picks, recognizes the user team, and assigns a roster slot', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    const result = reconcileProviderDraftSnapshot(workspace, snapshot([
      { providerPlayerId: 'y:1', canonicalPlayerId: '1', providerTeamId: 'team-other', overallPick: 1 },
      { providerPlayerId: 'y:2', canonicalPlayerId: '2', providerTeamId: 'team-me', overallPick: 2 },
    ]), players);
    expect(result).toMatchObject({ outcome: 'applied', added: 2, updated: 0, unresolved: [] });
    expect(result.workspace.draftSession.picks).toMatchObject([
      { playerId: '1', status: 'taken', source: 'provider', overallPick: 1 },
      { playerId: '2', status: 'mine', source: 'provider', overallPick: 2, slot: 'C' },
    ]);
    expect(result.workspace.draftSession.sync).toMatchObject({ mode: 'provider', provider: 'yahoo', status: 'synced' });
  });

  it('is idempotent and lets provider ownership correct a manual classification', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.draftSession.picks = [{ playerId: '1', fullName: 'First Player', team: 'TBL', positions: ['RW'], status: 'taken', madeAt: '2026-07-24T00:30:00.000Z', source: 'manual' }];
    const first = reconcileProviderDraftSnapshot(workspace, snapshot([
      { providerPlayerId: 'y:1', canonicalPlayerId: '1', providerTeamId: 'team-me', overallPick: 3 },
    ]), players);
    const second = reconcileProviderDraftSnapshot(first.workspace, snapshot([
      { providerPlayerId: 'y:1', canonicalPlayerId: '1', providerTeamId: 'team-me', overallPick: 3 },
    ]), players);
    expect(first).toMatchObject({ added: 0, updated: 1 });
    expect(first.workspace.draftSession.picks[0]).toMatchObject({ status: 'mine', source: 'provider', providerPlayerId: 'y:1' });
    expect(second).toMatchObject({ added: 0, updated: 0 });
    expect(second.workspace.draftSession.picks).toHaveLength(1);
  });

  it('does not guess unmapped players and exposes partial mapping as an error', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    const result = reconcileProviderDraftSnapshot(workspace, snapshot([
      { providerPlayerId: 'y:missing', providerTeamId: 'team-other', overallPick: 1 },
    ]), players);
    expect(result.unresolved).toEqual([{ providerPlayerId: 'y:missing', overallPick: 1, reason: 'missing-player-map' }]);
    expect(result.workspace.draftSession.picks).toHaveLength(0);
    expect(result.workspace.draftSession.sync.status).toBe('error');
    expect(result.workspace.draftSession.sync.lastSyncedAt).toBeUndefined();
  });

  it('ignores a snapshot older than the last successful provider state', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-07-24T00:00:00.000Z', timezone: 'UTC' });
    workspace.draftSession.sync = { mode: 'provider', provider: 'yahoo', status: 'synced', lastSyncedAt: '2026-07-24T02:00:00.000Z' };
    const result = reconcileProviderDraftSnapshot(workspace, snapshot([], '2026-07-24T01:00:00.000Z'), players);
    expect(result).toMatchObject({ outcome: 'stale', added: 0, updated: 0 });
    expect(result.workspace).toBe(workspace);
  });

  it('classifies sync freshness without claiming an unmeasured live SLA', () => {
    const now = Date.parse('2026-07-24T01:03:00.000Z');
    expect(draftSyncAge(undefined, now)).toBe('never');
    expect(draftSyncAge('2026-07-24T01:02:45.000Z', now)).toBe('fresh');
    expect(draftSyncAge('2026-07-24T01:01:30.000Z', now)).toBe('aging');
    expect(draftSyncAge('2026-07-24T01:00:00.000Z', now)).toBe('stale');
  });
});
