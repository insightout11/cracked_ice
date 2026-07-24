import { assignDraftSlot } from './draftRoom';
import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace } from './leagueWorkspace';

export interface ProviderDraftPick {
  providerPlayerId: string;
  providerTeamId: string;
  overallPick: number;
  canonicalPlayerId?: string;
  madeAt?: string;
}

export interface ProviderDraftSnapshot {
  provider: 'yahoo';
  fetchedAt: string;
  leagueId: string;
  myTeamId: string;
  draftStatus: 'pre-draft' | 'in-progress' | 'complete';
  cursor?: string;
  picks: ProviderDraftPick[];
}

export interface UnresolvedProviderPick {
  providerPlayerId: string;
  overallPick: number;
  reason: 'missing-player-map' | 'unknown-player' | 'duplicate-pick';
}

export interface DraftSyncResult {
  workspace: LeagueWorkspace;
  outcome: 'applied' | 'stale';
  added: number;
  updated: number;
  unresolved: UnresolvedProviderPick[];
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function isOlderThanLastSync(workspace: LeagueWorkspace, fetchedAt: string): boolean {
  const previous = workspace.draftSession.sync.lastSyncedAt;
  return Boolean(previous && new Date(fetchedAt).getTime() < new Date(previous).getTime());
}

/**
 * Reconciles an already-normalized provider snapshot into the platform-neutral draft session.
 * Provider adapters own external payload parsing and player-id mapping; unresolved ids are never
 * guessed from names. The operation is intentionally idempotent so a draft may be refreshed often.
 */
export function reconcileProviderDraftSnapshot(
  workspace: LeagueWorkspace,
  snapshot: ProviderDraftSnapshot,
  players: DraftPlayer[],
): DraftSyncResult {
  if (isOlderThanLastSync(workspace, snapshot.fetchedAt)) {
    return { workspace, outcome: 'stale', added: 0, updated: 0, unresolved: [] };
  }

  const playerById = new Map(players.map((player) => [normalizeId(player.id), player]));
  const seenProviderIds = new Set<string>();
  const seenCanonicalIds = new Set<string>();
  const unresolved: UnresolvedProviderPick[] = [];
  let picks = [...workspace.draftSession.picks];
  let added = 0;
  let updated = 0;

  for (const providerPick of [...snapshot.picks].sort((a, b) => a.overallPick - b.overallPick)) {
    const canonicalId = providerPick.canonicalPlayerId ? normalizeId(providerPick.canonicalPlayerId) : undefined;
    if (seenProviderIds.has(providerPick.providerPlayerId) || (canonicalId && seenCanonicalIds.has(canonicalId))) {
      unresolved.push({ providerPlayerId: providerPick.providerPlayerId, overallPick: providerPick.overallPick, reason: 'duplicate-pick' });
      continue;
    }
    seenProviderIds.add(providerPick.providerPlayerId);
    if (canonicalId) seenCanonicalIds.add(canonicalId);

    const existingIndex = picks.findIndex((pick) =>
      pick.providerPlayerId === providerPick.providerPlayerId
      || (canonicalId && normalizeId(pick.playerId) === canonicalId));
    const existing = existingIndex >= 0 ? picks[existingIndex] : undefined;
    const resolvedId = canonicalId ?? (existing ? normalizeId(existing.playerId) : undefined);
    if (!resolvedId) {
      unresolved.push({ providerPlayerId: providerPick.providerPlayerId, overallPick: providerPick.overallPick, reason: 'missing-player-map' });
      continue;
    }
    const player = playerById.get(resolvedId);
    if (!player && !existing) {
      unresolved.push({ providerPlayerId: providerPick.providerPlayerId, overallPick: providerPick.overallPick, reason: 'unknown-player' });
      continue;
    }

    const status = providerPick.providerTeamId === snapshot.myTeamId ? 'mine' as const : 'taken' as const;
    const base = existing ?? {
      playerId: resolvedId,
      fullName: player!.name,
      team: player!.team,
      positions: player!.pos,
      status,
      madeAt: providerPick.madeAt ?? snapshot.fetchedAt,
      source: 'provider' as const,
    };
    const draftWorkspace = { ...workspace, draftSession: { ...workspace.draftSession, picks } };
    const next = {
      ...base,
      providerPlayerId: providerPick.providerPlayerId,
      providerTeamId: providerPick.providerTeamId,
      overallPick: providerPick.overallPick,
      status,
      slot: status === 'mine' ? (base.slot ?? (player ? assignDraftSlot(draftWorkspace, player) : undefined)) : undefined,
      source: 'provider' as const,
      madeAt: providerPick.madeAt ?? base.madeAt,
    };
    if (existingIndex >= 0) {
      if (JSON.stringify(existing) !== JSON.stringify(next)) updated += 1;
      picks[existingIndex] = next;
    } else {
      picks.push(next);
      added += 1;
    }
  }

  picks = picks.sort((a, b) => {
    if (a.overallPick && b.overallPick) return a.overallPick - b.overallPick;
    if (a.overallPick) return -1;
    if (b.overallPick) return 1;
    return a.madeAt.localeCompare(b.madeAt);
  });
  const hasUnresolved = unresolved.length > 0;
  const nextWorkspace: LeagueWorkspace = {
    ...workspace,
    draftSession: {
      ...workspace.draftSession,
      status: snapshot.draftStatus === 'complete' ? 'complete' : snapshot.draftStatus === 'in-progress' ? 'live' : workspace.draftSession.status,
      picks,
      sync: {
        mode: 'provider',
        provider: snapshot.provider,
        status: hasUnresolved ? 'error' : 'synced',
        lastAttemptAt: snapshot.fetchedAt,
        lastSyncedAt: hasUnresolved ? workspace.draftSession.sync.lastSyncedAt : snapshot.fetchedAt,
        lastError: hasUnresolved ? `${unresolved.length} provider pick${unresolved.length === 1 ? '' : 's'} could not be mapped.` : undefined,
        cursor: snapshot.cursor,
      },
    },
    updatedAt: snapshot.fetchedAt,
  };
  return { workspace: nextWorkspace, outcome: 'applied', added, updated, unresolved };
}

export function draftSyncAge(lastSyncedAt: string | undefined, now = Date.now()): 'never' | 'fresh' | 'aging' | 'stale' {
  if (!lastSyncedAt) return 'never';
  const ageMs = Math.max(0, now - new Date(lastSyncedAt).getTime());
  if (ageMs <= 30_000) return 'fresh';
  if (ageMs <= 120_000) return 'aging';
  return 'stale';
}
