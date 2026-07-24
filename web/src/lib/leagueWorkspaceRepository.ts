import {
  LEAGUE_WORKSPACE_VERSION,
  LeagueWorkspaceStoreSchema,
  createDefaultLeagueStore,
  migrateLeagueWorkspaceStore,
  type LeagueWorkspaceStore,
} from './leagueWorkspace';

export const LEAGUE_WORKSPACE_STORAGE_KEY = 'cracked-ice-league-workspaces';

export interface LeagueWorkspaceRepository {
  load(): LeagueWorkspaceStore;
  save(store: LeagueWorkspaceStore): void;
  export(store: LeagueWorkspaceStore): string;
  import(serialized: string): LeagueWorkspaceStore;
}

function readNumber(storage: Storage, key: string): number | null {
  const value = Number(storage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function migrateLegacyLocalSettings(storage: Storage, now = new Date().toISOString()): LeagueWorkspaceStore {
  const store = createDefaultLeagueStore({ id: 'local-default', now });
  const league = store.leagues[0];
  const storedMode = storage.getItem('off-night-time-window-mode');
  const storedSlots = storage.getItem('off-night-daily-slots') === 'custom'
    ? readNumber(storage, 'off-night-custom-slots')
    : readNumber(storage, 'off-night-daily-slots');
  let matchupWeekStart = league.schedule.matchupWeekStart;
  try {
    const legacyWeeks = JSON.parse(storage.getItem('off-night-league-weeks') ?? 'null') as { weekStartDay?: unknown } | null;
    if (legacyWeeks?.weekStartDay === 'monday' || legacyWeeks?.weekStartDay === 'saturday' || legacyWeeks?.weekStartDay === 'sunday') {
      matchupWeekStart = legacyWeeks.weekStartDay;
    }
  } catch {
    // Invalid legacy preferences are recoverable because the defaults remain visible and editable.
  }

  const migrated = {
    ...league,
    source: storedMode || storedSlots ? { kind: 'legacy-coach' as const, label: 'Migrated from existing device settings' } : league.source,
    schedule: {
      ...league.schedule,
      matchupWeekStart,
      defaultWindow: {
        preset: storedMode === 'playoff' ? 'custom' as const : league.schedule.defaultWindow.preset,
        ...(storedMode === 'playoff' ? league.schedule.playoffs : {}),
      },
    },
    analysis: { defaultDailySlots: Math.min(20, storedSlots ?? league.analysis.defaultDailySlots) },
    updatedAt: now,
  };

  return LeagueWorkspaceStoreSchema.parse({ ...store, version: LEAGUE_WORKSPACE_VERSION, leagues: [migrated] });
}

export class LocalLeagueWorkspaceRepository implements LeagueWorkspaceRepository {
  constructor(private readonly storage: Storage) {}

  load(): LeagueWorkspaceStore {
    const raw = this.storage.getItem(LEAGUE_WORKSPACE_STORAGE_KEY);
    if (!raw) {
      const migrated = migrateLegacyLocalSettings(this.storage);
      this.save(migrated);
      return migrated;
    }
    const migrated = migrateLeagueWorkspaceStore(JSON.parse(raw));
    this.save(migrated);
    return migrated;
  }

  save(store: LeagueWorkspaceStore): void {
    const validated = LeagueWorkspaceStoreSchema.parse(store);
    this.storage.setItem(LEAGUE_WORKSPACE_STORAGE_KEY, JSON.stringify(validated));
  }

  export(store: LeagueWorkspaceStore): string {
    return JSON.stringify(LeagueWorkspaceStoreSchema.parse(store), null, 2);
  }

  import(serialized: string): LeagueWorkspaceStore {
    return migrateLeagueWorkspaceStore(JSON.parse(serialized));
  }
}

