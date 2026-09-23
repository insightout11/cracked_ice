export type MyTeamAccess = 'checking' | 'sign-in' | 'session-expired' | 'local-only' | 'account';

/**
 * How /team should render for the current session. Projections, pickups and the
 * stored roster use account-scoped coach endpoints, so:
 * - signed out with a roster saved on this device: work from that roster locally;
 * - signed out with nothing saved: show sign-in and the tools that need no account;
 * - signed in but the server rejected the session: ask to sign in again.
 * Without Supabase configured (local development) the workspace runs as before.
 */
export function resolveMyTeamAccess({
  authConfigured,
  authLoading,
  userId,
  savedRosterCount,
  sessionRejected,
}: {
  authConfigured: boolean;
  authLoading: boolean;
  userId: string | null;
  savedRosterCount: number;
  sessionRejected: boolean;
}): MyTeamAccess {
  if (!authConfigured) return 'account';
  if (authLoading) return 'checking';
  if (!userId) return savedRosterCount > 0 ? 'local-only' : 'sign-in';
  return sessionRejected ? 'session-expired' : 'account';
}
