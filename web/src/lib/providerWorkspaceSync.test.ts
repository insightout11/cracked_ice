import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { reconcileProviderLeagueSnapshot, type ProviderLeagueSnapshot } from './providerWorkspaceSync';

const FIRST_SYNC = '2026-07-24T10:00:00.000Z';
const SECOND_SYNC = '2026-07-24T10:05:00.000Z';

function snapshot(observedAt = FIRST_SYNC): ProviderLeagueSnapshot {
  return {
    provider: 'yahoo',
    providerLeagueId: 'yahoo.l.123',
    observedAt,
    settings: { name: 'Yahoo Test League', numberOfTeams: 12 },
    roster: [{ providerPlayerId: 'y.p.1', canonicalPlayerId: 'nhl:8478402', fullName: 'Connor McDavid', team: 'EDM', positions: ['C'], slot: 'C-1' }],
    candidates: [{ providerPlayerId: 'y.p.2', canonicalPlayerId: '8474564', fullName: 'Nikita Kucherov', expiresAt: '2026-07-24T11:00:00.000Z' }],
  };
}

describe('provider League Workspace reconciliation', () => {
  it('applies a mapped snapshot and preserves manual roster annotations', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'league', now: '2026-07-24T09:00:00.000Z', timezone: 'UTC' });
    workspace.roster = [{
      playerId: '8478402', providerPlayerId: 'y.p.1', fullName: 'Connor McDavid', team: 'EDM', positions: ['C'],
      keeper: true, protected: true, undroppable: false,
    }];
    const result = reconcileProviderLeagueSnapshot(workspace, snapshot());

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.workspace).toMatchObject({ platform: 'yahoo', providerLeagueId: 'yahoo.l.123', name: 'Yahoo Test League' });
    expect(result.workspace.roster[0]).toMatchObject({ playerId: '8478402', slot: 'C-1', keeper: true, protected: true });
    expect(result.workspace.candidates[0]).toMatchObject({ playerId: '8474564', availability: 'live-provider' });
  });

  it('is idempotent and rejects an equal or older provider observation', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'league', now: '2026-07-24T09:00:00.000Z', timezone: 'UTC' });
    const first = reconcileProviderLeagueSnapshot(workspace, snapshot());
    expect(first.status).toBe('applied');
    if (first.status !== 'applied') return;

    const repeated = reconcileProviderLeagueSnapshot(first.workspace, snapshot());
    expect(repeated).toMatchObject({ status: 'stale', observedAt: FIRST_SYNC, lastSyncedAt: FIRST_SYNC });
    expect(repeated.workspace).toEqual(first.workspace);
  });

  it('surfaces unmapped players instead of guessing by name', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'league', now: '2026-07-24T09:00:00.000Z', timezone: 'UTC' });
    const providerSnapshot = snapshot();
    providerSnapshot.roster.push({ providerPlayerId: 'y.p.unknown', fullName: 'Alex Example', team: 'UTA', positions: ['D'] });
    providerSnapshot.candidates.push({ providerPlayerId: 'y.p.unknown-2', fullName: 'Sam Example', expiresAt: SECOND_SYNC });
    const result = reconcileProviderLeagueSnapshot(workspace, providerSnapshot);

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.unmapped).toEqual([
      { kind: 'roster', providerPlayerId: 'y.p.unknown', fullName: 'Alex Example', reason: 'missing-canonical-id' },
      { kind: 'candidate', providerPlayerId: 'y.p.unknown-2', fullName: 'Sam Example', reason: 'missing-canonical-id' },
    ]);
    expect(result.workspace.roster).toHaveLength(1);
  });

  it('does not attach a snapshot to the wrong provider league', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'league', now: '2026-07-24T09:00:00.000Z', timezone: 'UTC' });
    workspace.platform = 'yahoo';
    workspace.providerLeagueId = 'yahoo.l.other';

    expect(reconcileProviderLeagueSnapshot(workspace, snapshot())).toMatchObject({ status: 'mismatch' });
  });
});
