import {
  LeagueWorkspaceStoreSchema,
  createLeagueId,
  type LeagueWorkspace,
  type LeagueWorkspaceStore,
} from './leagueWorkspace';

export interface DurableWorkspaceSnapshot {
  profileId: string;
  revision: number;
  store: LeagueWorkspaceStore;
  updatedAt: string;
}

export type MigrationResolution = 'keep-account' | 'use-device' | 'keep-both';

export interface WorkspaceMigrationConflict {
  key: string;
  reason: 'same-id-different-content' | 'same-provider-league';
  accountLeague: LeagueWorkspace;
  deviceLeague: LeagueWorkspace;
}

export interface WorkspaceMigrationPlan {
  account: DurableWorkspaceSnapshot | null;
  device: LeagueWorkspaceStore;
  imports: LeagueWorkspace[];
  unchangedLeagueIds: string[];
  ignoredPristineLeagueIds: string[];
  conflicts: WorkspaceMigrationConflict[];
}

function providerLeagueKey(league: LeagueWorkspace): string | null {
  return league.providerLeagueId ? `${league.platform}:${league.providerLeagueId}` : null;
}

function sameLeagueContent(left: LeagueWorkspace, right: LeagueWorkspace): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isPristineDeviceLeague(league: LeagueWorkspace): boolean {
  return league.source.kind === 'default'
    && league.platform === 'manual'
    && league.name === 'My League'
    && league.roster.length === 0
    && league.candidates.length === 0
    && league.draftSession.picks.length === 0
    && league.draftSession.targets.length === 0;
}

export function planGuestWorkspaceMigration(
  deviceStore: LeagueWorkspaceStore,
  account: DurableWorkspaceSnapshot | null,
): WorkspaceMigrationPlan {
  const validatedDevice = LeagueWorkspaceStoreSchema.parse(deviceStore);
  if (!account) {
    return { account: null, device: validatedDevice, imports: [...validatedDevice.leagues], unchangedLeagueIds: [], ignoredPristineLeagueIds: [], conflicts: [] };
  }

  const validatedAccount = { ...account, store: LeagueWorkspaceStoreSchema.parse(account.store) };
  const accountById = new Map(validatedAccount.store.leagues.map((league) => [league.id, league]));
  const accountByProvider = new Map(
    validatedAccount.store.leagues
      .map((league) => [providerLeagueKey(league), league] as const)
      .filter((entry): entry is [string, LeagueWorkspace] => Boolean(entry[0])),
  );
  const imports: LeagueWorkspace[] = [];
  const unchangedLeagueIds: string[] = [];
  const ignoredPristineLeagueIds: string[] = [];
  const conflicts: WorkspaceMigrationConflict[] = [];

  for (const deviceLeague of validatedDevice.leagues) {
    if (isPristineDeviceLeague(deviceLeague)) {
      ignoredPristineLeagueIds.push(deviceLeague.id);
      continue;
    }
    const sameId = accountById.get(deviceLeague.id);
    if (sameId) {
      if (sameLeagueContent(sameId, deviceLeague)) unchangedLeagueIds.push(deviceLeague.id);
      else conflicts.push({
        key: `id:${deviceLeague.id}`,
        reason: 'same-id-different-content',
        accountLeague: sameId,
        deviceLeague,
      });
      continue;
    }

    const providerKey = providerLeagueKey(deviceLeague);
    const sameProvider = providerKey ? accountByProvider.get(providerKey) : undefined;
    if (sameProvider) {
      conflicts.push({
        key: `provider:${providerKey}`,
        reason: 'same-provider-league',
        accountLeague: sameProvider,
        deviceLeague,
      });
      continue;
    }
    imports.push(deviceLeague);
  }

  return { account: validatedAccount, device: validatedDevice, imports, unchangedLeagueIds, ignoredPristineLeagueIds, conflicts };
}

export function applyGuestWorkspaceMigration(
  plan: WorkspaceMigrationPlan,
  resolutions: Record<string, MigrationResolution>,
  options: { createId?: () => string; now?: string } = {},
): LeagueWorkspaceStore {
  const unresolved = plan.conflicts.filter((conflict) => !resolutions[conflict.key]);
  if (unresolved.length) throw new Error(`Resolve ${unresolved.length} workspace conflict${unresolved.length === 1 ? '' : 's'} before importing.`);

  if (!plan.account) return LeagueWorkspaceStoreSchema.parse(plan.device);

  const createId = options.createId ?? createLeagueId;
  const now = options.now ?? new Date().toISOString();
  let leagues = [...plan.account.store.leagues, ...plan.imports];

  for (const conflict of plan.conflicts) {
    const resolution = resolutions[conflict.key];
    if (resolution === 'keep-account') continue;
    if (resolution === 'use-device') {
      leagues = leagues.filter((league) => league.id !== conflict.accountLeague.id && league.id !== conflict.deviceLeague.id);
      leagues.push({ ...conflict.deviceLeague, updatedAt: now });
      continue;
    }

    const copiedDeviceLeague: LeagueWorkspace = {
      ...conflict.deviceLeague,
      id: createId(),
      name: `${conflict.deviceLeague.name} (device copy)`,
      platform: 'manual',
      providerLeagueId: undefined,
      source: { kind: 'import', label: 'Copied from this device during account migration' },
      createdAt: now,
      updatedAt: now,
    };
    leagues.push(copiedDeviceLeague);
  }

  return LeagueWorkspaceStoreSchema.parse({
    ...plan.account.store,
    leagues,
  });
}
