import { describe, expect, it } from 'vitest';
import { loadDraftHelperState, persistDraftHelperState } from './draftHelperStorage';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('draft helper storage migration', () => {
  it('seeds team anchors and custom slots from the legacy keys', () => {
    const storage = memoryStorage({
      'off-night-locked-teams': '["NYI","CAR"]',
      'off-night-seed-team': '22',
      'off-night-show-all-teams': 'true',
      'off-night-daily-slots': 'custom',
      'off-night-custom-slots': '3',
    });

    expect(loadDraftHelperState(storage)).toMatchObject({
      lockedTeams: ['NYI', 'CAR'],
      seedTeamId: 22,
      showAll: true,
      slots: 3,
      customSlots: true,
    });
  });

  it('round-trips the new player anchors while preserving off-night keys', () => {
    const storage = memoryStorage();
    const players = [{ id: '8478402', name: 'Connor McDavid', team: 'EDM', pos: ['C'], aliases: [], blendedFppg: null, productionValue: 1.68, productionLabel: 'PPG' as const }];

    persistDraftHelperState(storage, { players, lockedTeams: ['NYR'], showAll: false, slots: 2, customSlots: false });

    expect(loadDraftHelperState(storage)).toMatchObject({ players, lockedTeams: ['NYR'], slots: 2, customSlots: false });
  });
});
