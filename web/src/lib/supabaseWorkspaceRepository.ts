import type { SupabaseClient } from '@supabase/supabase-js';
import { LeagueWorkspaceStoreSchema, migrateLeagueWorkspaceStore, type LeagueWorkspaceStore } from './leagueWorkspace';

export interface RemoteWorkspaceDocument {
  profileId: string;
  revision: number;
  store: LeagueWorkspaceStore;
  updatedAt: string;
}

export class RemoteWorkspaceConflictError extends Error {
  constructor(public readonly expectedRevision: number, public readonly actualRevision: number | null) {
    super(`Cloud workspace changed on another device (expected revision ${expectedRevision}, found ${actualRevision ?? 'unknown'}).`);
    this.name = 'RemoteWorkspaceConflictError';
  }
}

interface WorkspaceRow {
  profile_id: string;
  revision: number;
  payload: unknown;
  updated_at: string;
}

function toDocument(row: WorkspaceRow): RemoteWorkspaceDocument {
  return {
    profileId: row.profile_id,
    revision: row.revision,
    store: migrateLeagueWorkspaceStore(row.payload),
    updatedAt: row.updated_at,
  };
}

export class SupabaseWorkspaceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(profileId: string): Promise<RemoteWorkspaceDocument | null> {
    const { data, error } = await this.client
      .from('workspace_documents')
      .select('profile_id, revision, payload, updated_at')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) throw new Error(`Cloud workspace could not be loaded: ${error.message}`);
    return data ? toDocument(data as WorkspaceRow) : null;
  }

  async create(profileId: string, store: LeagueWorkspaceStore): Promise<RemoteWorkspaceDocument> {
    const payload = LeagueWorkspaceStoreSchema.parse(store);
    const { data, error } = await this.client
      .from('workspace_documents')
      .insert({ profile_id: profileId, revision: 1, payload })
      .select('profile_id, revision, payload, updated_at')
      .single();
    if (error) {
      if (error.code === '23505') throw new RemoteWorkspaceConflictError(0, 1);
      throw new Error(`Cloud workspace could not be created: ${error.message}`);
    }
    return toDocument(data as WorkspaceRow);
  }

  async save(profileId: string, expectedRevision: number, store: LeagueWorkspaceStore): Promise<RemoteWorkspaceDocument> {
    const payload = LeagueWorkspaceStoreSchema.parse(store);
    const { data, error } = await this.client
      .from('workspace_documents')
      .update({ payload, revision: expectedRevision + 1 })
      .eq('profile_id', profileId)
      .eq('revision', expectedRevision)
      .select('profile_id, revision, payload, updated_at')
      .maybeSingle();
    if (error) throw new Error(`Cloud workspace could not be saved: ${error.message}`);
    if (!data) {
      const latest = await this.load(profileId);
      throw new RemoteWorkspaceConflictError(expectedRevision, latest?.revision ?? null);
    }
    return toDocument(data as WorkspaceRow);
  }
}
