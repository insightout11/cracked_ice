import { describe, expect, it } from 'vitest';
import { createDefaultLeagueStore, createDefaultLeagueWorkspace } from './leagueWorkspace';
import { applyGuestWorkspaceMigration, planGuestWorkspaceMigration } from './profileWorkspaceMigration';

const NOW = '2026-07-24T10:00:00.000Z';

describe('guest-to-profile workspace migration', () => {
  it('imports non-overlapping device leagues without changing the account active league', () => {
    const accountStore = createDefaultLeagueStore({ id: 'account-league', name: 'Account League', now: NOW, timezone: 'UTC' });
    const deviceStore = createDefaultLeagueStore({ id: 'device-league', name: 'Device League', now: NOW, timezone: 'UTC' });
    const plan = planGuestWorkspaceMigration(deviceStore, { profileId: 'profile-1', revision: 4, store: accountStore, updatedAt: NOW });
    const merged = applyGuestWorkspaceMigration(plan, {});

    expect(plan.conflicts).toHaveLength(0);
    expect(merged.leagues.map((league) => league.name)).toEqual(['Account League', 'Device League']);
    expect(merged.activeLeagueId).toBe('account-league');
  });

  it('requires a decision when the same league differs across account and device', () => {
    const accountStore = createDefaultLeagueStore({ id: 'shared', name: 'Account Version', now: NOW, timezone: 'UTC' });
    const deviceStore = createDefaultLeagueStore({ id: 'shared', name: 'Device Version', now: NOW, timezone: 'UTC' });
    const plan = planGuestWorkspaceMigration(deviceStore, { profileId: 'profile-1', revision: 2, store: accountStore, updatedAt: NOW });

    expect(plan.conflicts).toMatchObject([{ key: 'id:shared', reason: 'same-id-different-content' }]);
    expect(() => applyGuestWorkspaceMigration(plan, {})).toThrow('Resolve 1 workspace conflict');
  });

  it('can keep both versions without retaining a duplicate provider attachment', () => {
    const accountLeague = { ...createDefaultLeagueWorkspace({ id: 'account', name: 'Yahoo League', now: NOW, timezone: 'UTC' }), platform: 'yahoo' as const, providerLeagueId: 'yahoo-123' };
    const deviceLeague = { ...createDefaultLeagueWorkspace({ id: 'device', name: 'Yahoo League Local', now: NOW, timezone: 'UTC' }), platform: 'yahoo' as const, providerLeagueId: 'yahoo-123' };
    const accountStore = { version: 1 as const, activeLeagueId: 'account', leagues: [accountLeague] };
    const deviceStore = { version: 1 as const, activeLeagueId: 'device', leagues: [deviceLeague] };
    const plan = planGuestWorkspaceMigration(deviceStore, { profileId: 'profile-1', revision: 1, store: accountStore, updatedAt: NOW });
    const merged = applyGuestWorkspaceMigration(plan, { 'provider:yahoo:yahoo-123': 'keep-both' }, { createId: () => 'device-copy', now: NOW });

    expect(merged.leagues).toHaveLength(2);
    expect(merged.leagues[1]).toMatchObject({ id: 'device-copy', platform: 'manual', source: { kind: 'import' } });
    expect(merged.leagues[1].providerLeagueId).toBeUndefined();
  });

  it('returns the device workspace unchanged for a new account', () => {
    const deviceStore = createDefaultLeagueStore({ id: 'device', name: 'Only League', now: NOW, timezone: 'UTC' });
    const plan = planGuestWorkspaceMigration(deviceStore, null);

    expect(applyGuestWorkspaceMigration(plan, {})).toEqual(deviceStore);
  });

  it('does not copy an untouched placeholder league into an existing account', () => {
    const accountStore = createDefaultLeagueStore({ id: 'account', name: 'Real League', now: NOW, timezone: 'UTC' });
    accountStore.leagues[0].source = { kind: 'manual', label: 'Configured' };
    const pristineDevice = createDefaultLeagueStore({ id: 'device-default', name: 'My League', now: NOW, timezone: 'UTC' });
    const plan = planGuestWorkspaceMigration(pristineDevice, { profileId: 'profile-1', revision: 1, store: accountStore, updatedAt: NOW });
    const merged = applyGuestWorkspaceMigration(plan, {});

    expect(plan.ignoredPristineLeagueIds).toEqual(['device-default']);
    expect(merged.leagues).toHaveLength(1);
    expect(merged.leagues[0].id).toBe('account');
  });
});
