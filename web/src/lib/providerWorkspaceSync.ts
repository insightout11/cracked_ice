import {
  LeagueWorkspaceSchema,
  upsertLeagueCandidates,
  type LeagueCandidate,
  type LeagueWorkspace,
  type LeagueWorkspaceRosterEntry,
} from './leagueWorkspace';

export interface ProviderRosterMember {
  providerPlayerId: string;
  canonicalPlayerId?: string;
  fullName: string;
  team: string;
  positions: string[];
  slot?: string;
}

export interface ProviderCandidateMember {
  providerPlayerId: string;
  canonicalPlayerId?: string;
  fullName: string;
  expiresAt: string;
}

export interface ProviderLeagueSnapshot {
  provider: 'yahoo';
  providerLeagueId: string;
  observedAt: string;
  settings?: {
    name?: string;
    numberOfTeams?: number;
    season?: LeagueWorkspace['season'];
    scoring?: LeagueWorkspace['scoring'];
    rosterRules?: LeagueWorkspace['rosterRules'];
    schedule?: LeagueWorkspace['schedule'];
    acquisitions?: LeagueWorkspace['acquisitions'];
  };
  roster: ProviderRosterMember[];
  candidates: ProviderCandidateMember[];
}

export interface UnmappedProviderPlayer {
  kind: 'roster' | 'candidate';
  providerPlayerId: string;
  fullName: string;
  reason: 'missing-canonical-id' | 'duplicate-canonical-id';
}

export type ProviderWorkspaceSyncResult =
  | { status: 'applied'; workspace: LeagueWorkspace; unmapped: UnmappedProviderPlayer[] }
  | { status: 'stale'; workspace: LeagueWorkspace; observedAt: string; lastSyncedAt: string }
  | { status: 'mismatch'; workspace: LeagueWorkspace; message: string };

function normalizePlayerId(playerId: string): string {
  return playerId.replace(/^nhl:/, '');
}

function findExistingRosterEntry(
  entries: LeagueWorkspaceRosterEntry[],
  member: ProviderRosterMember,
): LeagueWorkspaceRosterEntry | undefined {
  return entries.find((entry) =>
    entry.providerPlayerId === member.providerPlayerId
    || (member.canonicalPlayerId && normalizePlayerId(entry.playerId) === normalizePlayerId(member.canonicalPlayerId)),
  );
}

export function reconcileProviderLeagueSnapshot(
  workspace: LeagueWorkspace,
  snapshot: ProviderLeagueSnapshot,
): ProviderWorkspaceSyncResult {
  if (workspace.platform !== 'manual' && workspace.platform !== snapshot.provider) {
    return { status: 'mismatch', workspace, message: `This workspace is attached to ${workspace.platform}, not ${snapshot.provider}.` };
  }
  if (workspace.providerLeagueId && workspace.providerLeagueId !== snapshot.providerLeagueId) {
    return { status: 'mismatch', workspace, message: 'The provider league does not match this League Workspace.' };
  }

  const lastSyncedAt = workspace.freshness.syncedAt;
  if (lastSyncedAt && snapshot.observedAt <= lastSyncedAt) {
    return { status: 'stale', workspace, observedAt: snapshot.observedAt, lastSyncedAt };
  }

  const unmapped: UnmappedProviderPlayer[] = [];
  const rosterPlayerIds = new Set<string>();
  const roster = snapshot.roster.flatMap((member): LeagueWorkspaceRosterEntry[] => {
    if (!member.canonicalPlayerId) {
      unmapped.push({ kind: 'roster', providerPlayerId: member.providerPlayerId, fullName: member.fullName, reason: 'missing-canonical-id' });
      return [];
    }
    const canonicalPlayerId = normalizePlayerId(member.canonicalPlayerId);
    if (rosterPlayerIds.has(canonicalPlayerId)) {
      unmapped.push({ kind: 'roster', providerPlayerId: member.providerPlayerId, fullName: member.fullName, reason: 'duplicate-canonical-id' });
      return [];
    }
    rosterPlayerIds.add(canonicalPlayerId);
    const existing = findExistingRosterEntry(workspace.roster, member);
    return [{
      playerId: canonicalPlayerId,
      providerPlayerId: member.providerPlayerId,
      fullName: member.fullName,
      team: member.team,
      positions: member.positions,
      slot: member.slot,
      keeper: existing?.keeper ?? false,
      keeperCost: existing?.keeperCost,
      protected: existing?.protected ?? false,
      undroppable: existing?.undroppable ?? false,
    }];
  });

  const candidatePlayerIds = new Set<string>();
  const providerCandidates = snapshot.candidates.flatMap((member): LeagueCandidate[] => {
    if (!member.canonicalPlayerId) {
      unmapped.push({ kind: 'candidate', providerPlayerId: member.providerPlayerId, fullName: member.fullName, reason: 'missing-canonical-id' });
      return [];
    }
    const canonicalPlayerId = normalizePlayerId(member.canonicalPlayerId);
    if (candidatePlayerIds.has(canonicalPlayerId)) {
      unmapped.push({ kind: 'candidate', providerPlayerId: member.providerPlayerId, fullName: member.fullName, reason: 'duplicate-canonical-id' });
      return [];
    }
    candidatePlayerIds.add(canonicalPlayerId);
    return [{
      playerId: canonicalPlayerId,
      availability: 'live-provider',
      confidence: 1,
      observedAt: snapshot.observedAt,
      expiresAt: member.expiresAt,
    }];
  });
  const manualCandidates = workspace.candidates.filter((candidate) => candidate.availability !== 'live-provider');

  const next = LeagueWorkspaceSchema.parse({
    ...workspace,
    ...snapshot.settings,
    platform: snapshot.provider,
    providerLeagueId: snapshot.providerLeagueId,
    source: { kind: 'provider', label: 'Synced from Yahoo' },
    scoring: snapshot.settings?.scoring
      ? { ...snapshot.settings.scoring, updatedAt: snapshot.observedAt }
      : workspace.scoring,
    roster,
    candidates: upsertLeagueCandidates(manualCandidates, providerCandidates),
    freshness: {
      ...workspace.freshness,
      sourceSeason: snapshot.settings?.season?.id ?? workspace.freshness.sourceSeason,
      syncedAt: snapshot.observedAt,
      lastError: undefined,
    },
    updatedAt: snapshot.observedAt,
  });

  return { status: 'applied', workspace: next, unmapped };
}
