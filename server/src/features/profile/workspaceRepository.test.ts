import { describe, expect, it } from 'vitest';
import {
  InMemoryDurableWorkspaceRepository,
  WorkspaceAlreadyExistsError,
  WorkspaceVersionConflictError,
} from './workspaceRepository';

describe('durable workspace repository contract', () => {
  it('creates and advances a workspace with optimistic revisions', async () => {
    const repository = new InMemoryDurableWorkspaceRepository();
    const created = await repository.create('profile-1', { leagues: ['a'] }, '2026-07-24T10:00:00.000Z');
    const saved = await repository.save('profile-1', created.revision, { leagues: ['a', 'b'] }, '2026-07-24T10:01:00.000Z');

    expect(created.revision).toBe(1);
    expect(saved).toMatchObject({ profileId: 'profile-1', revision: 2, payload: { leagues: ['a', 'b'] } });
    expect(await repository.load('profile-1')).toEqual(saved);
  });

  it('rejects stale writes rather than overwriting a newer device', async () => {
    const repository = new InMemoryDurableWorkspaceRepository();
    await repository.create('profile-1', { value: 'original' });
    await repository.save('profile-1', 1, { value: 'newer' });

    await expect(repository.save('profile-1', 1, { value: 'stale' }))
      .rejects.toMatchObject<Partial<WorkspaceVersionConflictError>>({ expectedRevision: 1, actualRevision: 2 });
    expect((await repository.load('profile-1'))?.payload).toEqual({ value: 'newer' });
  });

  it('does not allow create to replace an existing profile workspace', async () => {
    const repository = new InMemoryDurableWorkspaceRepository();
    await repository.create('profile-1', { value: 'first' });

    await expect(repository.create('profile-1', { value: 'second' })).rejects.toBeInstanceOf(WorkspaceAlreadyExistsError);
  });
});
