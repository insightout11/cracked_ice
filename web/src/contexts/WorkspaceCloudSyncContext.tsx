import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useLeagueWorkspace } from './LeagueWorkspaceContext';
import { SupabaseWorkspaceRepository } from '../lib/supabaseWorkspaceRepository';
import {
  applyGuestWorkspaceMigration,
  planGuestWorkspaceMigration,
  type MigrationResolution,
  type WorkspaceMigrationPlan,
} from '../lib/profileWorkspaceMigration';
import type { LeagueWorkspaceStore } from '../lib/leagueWorkspace';
import { track } from '../lib/analytics';

export type WorkspaceSyncStatus = 'device-only' | 'loading' | 'saving' | 'synced' | 'needs-review' | 'error';

interface WorkspaceCloudSyncContextValue {
  status: WorkspaceSyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  migrationPlan: WorkspaceMigrationPlan | null;
  resolveMigration: (resolutions: Record<string, MigrationResolution>) => Promise<boolean>;
  retry: () => void;
}

const WorkspaceCloudSyncContext = createContext<WorkspaceCloudSyncContextValue | null>(null);
const PROFILE_CACHE_OWNER_KEY = 'cracked-ice-workspace-profile-owner';

export function WorkspaceCloudSyncProvider({ children }: { children: ReactNode }) {
  const { user, configured, client } = useAuth();
  const { store, importWorkspaces } = useLeagueWorkspace();
  const repository = useMemo(() => client ? new SupabaseWorkspaceRepository(client) : null, [client]);
  const [status, setStatus] = useState<WorkspaceSyncStatus>(configured ? 'loading' : 'device-only');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [migrationPlan, setMigrationPlan] = useState<WorkspaceMigrationPlan | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const activeProfileRef = useRef<string | null>(null);
  const revisionRef = useRef<number | null>(null);
  const lastSyncedJsonRef = useRef<string | null>(null);
  const pendingStoreRef = useRef<LeagueWorkspaceStore>(store);
  const savingRef = useRef(false);

  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  useEffect(() => {
    pendingStoreRef.current = store;
  }, [store]);

  useEffect(() => {
    if (!configured || !repository || !user) {
      activeProfileRef.current = null;
      revisionRef.current = null;
      lastSyncedJsonRef.current = null;
      setMigrationPlan(null);
      setError(null);
      setLastSyncedAt(null);
      setStatus('device-only');
      return undefined;
    }

    let cancelled = false;
    activeProfileRef.current = null;
    setStatus('loading');
    setError(null);
    setMigrationPlan(null);

    void (async () => {
      try {
        const cachedProfileOwner = window.localStorage.getItem(PROFILE_CACHE_OWNER_KEY);
        if (cachedProfileOwner && cachedProfileOwner !== user.id) {
          throw new Error('This device currently contains workspace data cached for another account. Automatic upload is blocked to protect both accounts.');
        }
        const remote = await repository.load(user.id);
        if (cancelled) return;
        if (!remote) {
          const created = await repository.create(user.id, pendingStoreRef.current);
          if (cancelled) return;
          revisionRef.current = created.revision;
          lastSyncedJsonRef.current = JSON.stringify(created.store);
          activeProfileRef.current = user.id;
          window.localStorage.setItem(PROFILE_CACHE_OWNER_KEY, user.id);
          setLastSyncedAt(created.updatedAt);
          setStatus('synced');
          track('workspace_sync_completed', { source: 'first_upload' });
          return;
        }

        const plan = planGuestWorkspaceMigration(pendingStoreRef.current, {
          profileId: remote.profileId,
          revision: remote.revision,
          store: remote.store,
          updatedAt: remote.updatedAt,
        });
        revisionRef.current = remote.revision;
        if (plan.conflicts.length) {
          setMigrationPlan(plan);
          setStatus('needs-review');
          return;
        }

        const merged = applyGuestWorkspaceMigration(plan, {});
        let document = remote;
        if (JSON.stringify(merged) !== JSON.stringify(remote.store)) {
          document = await repository.save(user.id, remote.revision, merged);
          if (cancelled) return;
        }
        revisionRef.current = document.revision;
        lastSyncedJsonRef.current = JSON.stringify(merged);
        activeProfileRef.current = user.id;
        window.localStorage.setItem(PROFILE_CACHE_OWNER_KEY, user.id);
        setLastSyncedAt(document.updatedAt);
        importWorkspaces(JSON.stringify(merged));
        setStatus('synced');
        track('workspace_sync_completed', { source: 'automatic_merge' });
      } catch (syncError) {
        if (cancelled) return;
        setError(syncError instanceof Error ? syncError.message : 'Cloud workspace could not be loaded.');
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [configured, importWorkspaces, repository, retryToken, user]);

  const flushPending = useCallback(async () => {
    if (!repository || !user || activeProfileRef.current !== user.id || savingRef.current) return;
    savingRef.current = true;
    try {
      while (activeProfileRef.current === user.id) {
        const nextStore = pendingStoreRef.current;
        const nextJson = JSON.stringify(nextStore);
        if (nextJson === lastSyncedJsonRef.current) break;
        const revision = revisionRef.current;
        if (revision === null) break;
        setStatus('saving');
        const saved = await repository.save(user.id, revision, nextStore);
        revisionRef.current = saved.revision;
        lastSyncedJsonRef.current = nextJson;
        setLastSyncedAt(saved.updatedAt);
      }
      if (activeProfileRef.current === user.id) setStatus('synced');
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Cloud workspace could not be saved.');
      setStatus('error');
      activeProfileRef.current = null;
    } finally {
      savingRef.current = false;
    }
  }, [repository, user]);

  useEffect(() => {
    if (status !== 'synced' || !user || activeProfileRef.current !== user.id) return undefined;
    const timeout = window.setTimeout(() => { void flushPending(); }, 700);
    return () => window.clearTimeout(timeout);
  }, [flushPending, status, store, user]);

  const resolveMigration = useCallback(async (resolutions: Record<string, MigrationResolution>) => {
    if (!repository || !user || !migrationPlan || revisionRef.current === null) return false;
    setStatus('saving');
    setError(null);
    try {
      const merged = applyGuestWorkspaceMigration(migrationPlan, resolutions);
      const saved = await repository.save(user.id, revisionRef.current, merged);
      revisionRef.current = saved.revision;
      lastSyncedJsonRef.current = JSON.stringify(merged);
      activeProfileRef.current = user.id;
      window.localStorage.setItem(PROFILE_CACHE_OWNER_KEY, user.id);
      setMigrationPlan(null);
      setLastSyncedAt(saved.updatedAt);
      importWorkspaces(JSON.stringify(merged));
      setStatus('synced');
      track('workspace_sync_completed', { source: 'reviewed_merge' });
      return true;
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Workspace migration could not be saved.');
      setStatus('error');
      return false;
    }
  }, [importWorkspaces, migrationPlan, repository, user]);

  return <WorkspaceCloudSyncContext.Provider value={{ status, error, lastSyncedAt, migrationPlan, resolveMigration, retry }}>
    {children}
  </WorkspaceCloudSyncContext.Provider>;
}

export function useWorkspaceCloudSync(): WorkspaceCloudSyncContextValue {
  const value = useContext(WorkspaceCloudSyncContext);
  if (!value) throw new Error('useWorkspaceCloudSync must be used within WorkspaceCloudSyncProvider');
  return value;
}
