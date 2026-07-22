import type { DraftPlayer } from './playerSearch';

const KEYS = {
  players: 'off-night-anchor-players',
  lockedTeams: 'off-night-locked-teams',
  seedTeam: 'off-night-seed-team',
  showAll: 'off-night-show-all-teams',
  dailySlots: 'off-night-daily-slots',
  customSlots: 'off-night-custom-slots',
} as const;

function parseArray<T>(storage: Storage, key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export interface DraftHelperStoredState {
  players: DraftPlayer[];
  lockedTeams: string[];
  seedTeamId: number | null;
  showAll: boolean;
  slots: number | null;
  customSlots: boolean;
}

export function loadDraftHelperState(storage: Storage): DraftHelperStoredState {
  const storedDailySlots = storage.getItem(KEYS.dailySlots);
  const parsedDailySlots = storedDailySlots === 'custom'
    ? Number(storage.getItem(KEYS.customSlots))
    : Number(storedDailySlots);
  const slots = Number.isFinite(parsedDailySlots) && parsedDailySlots >= 1 && parsedDailySlots <= 10
    ? parsedDailySlots
    : null;
  const parsedSeedTeamId = Number(storage.getItem(KEYS.seedTeam));

  return {
    players: parseArray<DraftPlayer>(storage, KEYS.players),
    lockedTeams: parseArray<unknown>(storage, KEYS.lockedTeams).map(String),
    seedTeamId: Number.isInteger(parsedSeedTeamId) && parsedSeedTeamId > 0 ? parsedSeedTeamId : null,
    showAll: storage.getItem(KEYS.showAll) === 'true',
    slots,
    customSlots: storedDailySlots === 'custom',
  };
}

export function persistDraftHelperState(
  storage: Storage,
  state: Pick<DraftHelperStoredState, 'players' | 'lockedTeams' | 'showAll'> & { slots: number; customSlots: boolean }
): void {
  storage.setItem(KEYS.players, JSON.stringify(state.players));
  storage.setItem(KEYS.lockedTeams, JSON.stringify(state.lockedTeams));
  storage.setItem(KEYS.showAll, String(state.showAll));
  storage.setItem(KEYS.dailySlots, state.customSlots ? 'custom' : String(state.slots));
  storage.setItem(KEYS.customSlots, String(state.slots));
}
