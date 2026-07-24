import { describe, expect, it } from 'vitest';
import { createDefaultLeagueStore } from './leagueWorkspace';
import { RemoteWorkspaceConflictError, SupabaseWorkspaceRepository } from './supabaseWorkspaceRepository';

function fakeClient(rows: Array<Record<string, unknown>> = []) {
  const state = { rows };
  const builder = (operation: 'select' | 'insert' | 'update', value?: Record<string, unknown>) => {
    const filters: Array<[string, unknown]> = [];
    const chain: any = {
      select: () => chain,
      eq: (key: string, expected: unknown) => { filters.push([key, expected]); return chain; },
      maybeSingle: async () => {
        const row = state.rows.find((candidate) => filters.every(([key, expected]) => candidate[key] === expected));
        if (operation === 'update' && row && value) Object.assign(row, value, { updated_at: '2026-07-24T10:05:00.000Z' });
        return { data: row ?? null, error: null };
      },
      single: async () => {
        if (operation === 'insert' && value) {
          const row = { ...value, updated_at: '2026-07-24T10:00:00.000Z' };
          state.rows.push(row);
          return { data: row, error: null };
        }
        return { data: null, error: null };
      },
    };
    return chain;
  };
  return {
    from: () => ({
      select: () => builder('select'),
      insert: (value: Record<string, unknown>) => builder('insert', value),
      update: (value: Record<string, unknown>) => builder('update', value),
    }),
    state,
  };
}

describe('Supabase workspace repository', () => {
  it('creates and loads a validated document', async () => {
    const client = fakeClient();
    const repository = new SupabaseWorkspaceRepository(client as any);
    const store = createDefaultLeagueStore({ id: 'league', now: '2026-07-24T10:00:00.000Z', timezone: 'UTC' });

    const created = await repository.create('profile-1', store);
    expect(created).toMatchObject({ profileId: 'profile-1', revision: 1, store });
    expect(await repository.load('profile-1')).toEqual(created);
  });

  it('advances only the expected revision', async () => {
    const store = createDefaultLeagueStore({ id: 'league', now: '2026-07-24T10:00:00.000Z', timezone: 'UTC' });
    const client = fakeClient([{ profile_id: 'profile-1', revision: 2, payload: store, updated_at: '2026-07-24T10:00:00.000Z' }]);
    const repository = new SupabaseWorkspaceRepository(client as any);

    const saved = await repository.save('profile-1', 2, store);
    expect(saved.revision).toBe(3);
    await expect(repository.save('profile-1', 2, store)).rejects.toBeInstanceOf(RemoteWorkspaceConflictError);
  });
});
