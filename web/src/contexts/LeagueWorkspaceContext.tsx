import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LeagueProfile, RosterPlayer } from '../lib/coachSchemas';
import {
  activeLeagueFromStore,
  createDefaultLeagueStore,
  createDefaultLeagueWorkspace,
  LeagueWorkspaceStoreSchema,
  mergeLegacyLeagueProfile,
  type LeagueWorkspace,
  type LeagueWorkspaceStore,
} from '../lib/leagueWorkspace';
import { LocalLeagueWorkspaceRepository, type LeagueWorkspaceRepository } from '../lib/leagueWorkspaceRepository';

interface LeagueWorkspaceContextValue {
  store: LeagueWorkspaceStore;
  activeLeague: LeagueWorkspace;
  storageError: string | null;
  setActiveLeague: (leagueId: string) => void;
  updateLeague: (league: LeagueWorkspace) => void;
  createLeague: () => LeagueWorkspace;
  mergeLegacyProfile: (profile: LeagueProfile, roster?: RosterPlayer[]) => void;
  exportWorkspaces: () => string;
  importWorkspaces: (serialized: string) => void;
}

const LeagueWorkspaceContext = createContext<LeagueWorkspaceContextValue | null>(null);

function browserRepository(): LeagueWorkspaceRepository {
  return new LocalLeagueWorkspaceRepository(window.localStorage);
}

export function LeagueWorkspaceProvider({ children, repository }: { children: ReactNode; repository?: LeagueWorkspaceRepository }) {
  const repo = useMemo(() => repository ?? browserRepository(), [repository]);
  const initial = useMemo((): { store: LeagueWorkspaceStore; error: string | null } => {
    try {
      return { store: repo.load(), error: null };
    } catch (error) {
      return {
        store: createDefaultLeagueStore({ id: 'recovery-default' }),
        error: error instanceof Error ? error.message : 'League settings could not be loaded.',
      };
    }
  }, [repo]);
  const [storageError, setStorageError] = useState<string | null>(initial.error);
  const [store, setStore] = useState<LeagueWorkspaceStore>(initial.store);
  const storeRef = useRef(initial.store);

  const persist = useCallback((next: LeagueWorkspaceStore) => {
    let validated: LeagueWorkspaceStore;
    try {
      validated = LeagueWorkspaceStoreSchema.parse(next);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'League settings are invalid and were not saved.');
      return;
    }

    storeRef.current = validated;
    setStore(validated);
    try {
      repo.save(validated);
      setStorageError(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'League settings could not be saved.');
    }
  }, [repo]);

  const setActiveLeague = useCallback((leagueId: string) => {
    const current = storeRef.current;
    if (!current.leagues.some((league) => league.id === leagueId)) return;
    persist({ ...current, activeLeagueId: leagueId });
  }, [persist]);

  const updateLeague = useCallback((league: LeagueWorkspace) => {
    const current = storeRef.current;
    persist({
      ...current,
      leagues: current.leagues.map((existing) => existing.id === league.id ? league : existing),
    });
  }, [persist]);

  const createLeague = useCallback(() => {
    const current = storeRef.current;
    const league = createDefaultLeagueWorkspace({ name: `League ${current.leagues.length + 1}` });
    persist({ ...current, activeLeagueId: league.id, leagues: [...current.leagues, league] });
    return league;
  }, [persist]);

  const mergeLegacyProfile = useCallback((profile: LeagueProfile, roster: RosterPlayer[] = []) => {
    const currentStore = storeRef.current;
    const current = activeLeagueFromStore(currentStore);
    if (current.source.kind !== 'default' || current.roster.length > 0) return;
    const nextLeague = mergeLegacyLeagueProfile(current, profile, roster);
    persist({
      ...currentStore,
      leagues: currentStore.leagues.map((league) => league.id === current.id ? nextLeague : league),
    });
  }, [persist]);

  const exportWorkspaces = useCallback(() => repo.export(store), [repo, store]);
  const importWorkspaces = useCallback((serialized: string) => persist(repo.import(serialized)), [persist, repo]);
  const activeLeague = activeLeagueFromStore(store);

  return (
    <LeagueWorkspaceContext.Provider value={{
      store,
      activeLeague,
      storageError,
      setActiveLeague,
      updateLeague,
      createLeague,
      mergeLegacyProfile,
      exportWorkspaces,
      importWorkspaces,
    }}>
      {children}
    </LeagueWorkspaceContext.Provider>
  );
}

export function useLeagueWorkspace(): LeagueWorkspaceContextValue {
  const value = useContext(LeagueWorkspaceContext);
  if (!value) throw new Error('useLeagueWorkspace must be used within LeagueWorkspaceProvider');
  return value;
}
