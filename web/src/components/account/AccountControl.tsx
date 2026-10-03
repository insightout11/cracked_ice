import { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudAlert, CloudCheck, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { SignInForm } from './SignInForm';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspaceCloudSync } from '../../contexts/WorkspaceCloudSyncContext';
import type { MigrationResolution } from '../../lib/profileWorkspaceMigration';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { Button } from '../ui/button';
import { Modal, ModalContent, ModalDescription, ModalTitle, ModalTrigger } from '../ui/dialog';

/** What a version holds, in the terms a manager checks: their team and the league rosters. */
function leagueSummary(league: LeagueWorkspace): string {
  const teams = league.leagueRosters?.teams.length ?? 0;
  const updated = new Date(league.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${league.roster.length} player${league.roster.length === 1 ? '' : 's'} on your team${teams ? `, rosters for ${teams} teams` : ', no league rosters'} · changed ${updated}`;
}

function SyncIcon({ status }: { status: ReturnType<typeof useWorkspaceCloudSync>['status'] }) {
  if (status === 'error' || status === 'needs-review') return <CloudAlert aria-hidden className="size-4" />;
  if (status === 'loading' || status === 'saving') return <LoaderCircle aria-hidden className="size-4 animate-spin" />;
  if (status === 'synced') return <CloudCheck aria-hidden className="size-4" />;
  return <Cloud aria-hidden className="size-4" />;
}

export function AccountControl({ mobile = false }: { mobile?: boolean }) {
  const auth = useAuth();
  const sync = useWorkspaceCloudSync();
  const [open, setOpen] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, MigrationResolution>>({});

  useEffect(() => {
    if (sync.migrationPlan) setResolutions({});
  }, [sync.migrationPlan]);

  const allConflictsResolved = useMemo(() =>
    sync.migrationPlan?.conflicts.every((conflict) => Boolean(resolutions[conflict.key])) ?? false,
  [resolutions, sync.migrationPlan]);

  if (!auth.configured) return null;

  const submitMigration = async () => {
    if (!allConflictsResolved) return;
    if (await sync.resolveMigration(resolutions)) setOpen(false);
  };

  const signedOutLabel = auth.loading ? 'Checking account' : 'Sign in';
  const signedInLabel = sync.status === 'needs-review'
    ? 'Review sync'
    : sync.status === 'error'
      ? 'Sync issue'
      : sync.status === 'saving'
        ? 'Saving'
        : 'Synced';

  return <Modal open={open} onOpenChange={(next) => { setOpen(next); if (next) auth.clearFeedback(); }}>
    <ModalTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={mobile ? 'w-full justify-start border border-line bg-surface-glass px-4 py-3 text-base' : ''}
        aria-label={auth.user ? `Account: ${signedInLabel}` : signedOutLabel}
      >
        {auth.user ? <SyncIcon status={sync.status} /> : <LogIn aria-hidden className="size-4" />}
        {auth.user ? signedInLabel : signedOutLabel}
      </Button>
    </ModalTrigger>
    <ModalContent>
      {!auth.user ? <>
        <ModalTitle>Save your leagues across devices</ModalTitle>
        <ModalDescription>Your current device workspace stays available. After sign-in, you review any account/device conflicts before anything is replaced.</ModalDescription>
        <SignInForm />
      </> : sync.migrationPlan ? <>
        <ModalTitle>This device and your account disagree</ModalTitle>
        <ModalDescription>This league was changed here and on another device. Pick the version to keep everywhere. The one with your full roster is usually right.</ModalDescription>
        <div className="mt-5 space-y-4">
          {sync.migrationPlan.conflicts.map((conflict) => <div key={conflict.key} className="rounded-md border border-line bg-surface-0 p-4">
            <p className="text-sm font-semibold text-ink">{conflict.accountLeague.name}</p>
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label={`Version of ${conflict.accountLeague.name} to keep`}>
              {([
                ['keep-account', 'Your account (other devices)', leagueSummary(conflict.accountLeague)],
                ['use-device', 'This device', leagueSummary(conflict.deviceLeague)],
                ['keep-both', 'Keep both', "Saves this device's version as a separate league"],
              ] as const).map(([value, label, detail]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={resolutions[conflict.key] === value}
                  onClick={() => setResolutions((current) => ({ ...current, [conflict.key]: value }))}
                  className={`rounded-md border px-3 py-2 text-left ${resolutions[conflict.key] === value ? 'border-accent bg-accent-muted' : 'border-line hover:border-accent'}`}
                >
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="block text-xs text-ink-dim">{detail}</span>
                </button>
              ))}
            </div>
          </div>)}
        </div>
        <Button type="button" className="mt-5 w-full" disabled={!allConflictsResolved || sync.status === 'saving'} onClick={submitMigration}>
          {sync.status === 'saving' && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          Save reviewed leagues
        </Button>
        {sync.error && <p className="mt-3 text-sm text-negative" role="alert">{sync.error}</p>}
      </> : <>
        <ModalTitle>Cracked Ice account</ModalTitle>
        <ModalDescription>{auth.user.email ?? 'Signed in'} · Your League Workspace remains available on this device and syncs through your account.</ModalDescription>
        <div className="mt-5 rounded-md border border-line bg-surface-0 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink"><SyncIcon status={sync.status} />{signedInLabel}</div>
          {sync.lastSyncedAt && <p className="mt-1 text-xs text-ink-mute">Last saved {new Date(sync.lastSyncedAt).toLocaleString()}</p>}
          {sync.error && <p className="mt-2 text-sm text-negative" role="alert">{sync.error}</p>}
          {sync.status === 'error' && <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={sync.retry}>Retry sync</Button>}
        </div>
        <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => void auth.signOut()}><LogOut aria-hidden className="size-4" />Sign out</Button>
      </>}
    </ModalContent>
  </Modal>;
}
