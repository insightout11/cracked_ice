import { describe, expect, it } from 'vitest';
import { resolveMyTeamAccess } from './myTeamAccess';

const base = { authConfigured: true, authLoading: false, userId: null, savedRosterCount: 0, sessionRejected: false };

describe('resolveMyTeamAccess', () => {
  it('waits for the session check', () => {
    expect(resolveMyTeamAccess({ ...base, authLoading: true })).toBe('checking');
  });

  it('keeps a signed-out device roster usable locally', () => {
    expect(resolveMyTeamAccess({ ...base, savedRosterCount: 12 })).toBe('local-only');
  });

  it('offers sign-in when signed out with nothing saved', () => {
    expect(resolveMyTeamAccess(base)).toBe('sign-in');
  });

  it('asks a rejected signed-in session to sign in again', () => {
    expect(resolveMyTeamAccess({ ...base, userId: 'user-1', sessionRejected: true })).toBe('session-expired');
    expect(resolveMyTeamAccess({ ...base, userId: 'user-1' })).toBe('account');
  });

  it('runs the workspace as before without account configuration', () => {
    expect(resolveMyTeamAccess({ ...base, authConfigured: false })).toBe('account');
  });
});
