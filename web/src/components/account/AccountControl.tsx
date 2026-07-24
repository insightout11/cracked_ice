import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Cloud, CloudAlert, CloudCheck, LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspaceCloudSync } from '../../contexts/WorkspaceCloudSyncContext';
import type { MigrationResolution } from '../../lib/profileWorkspaceMigration';
import { Button } from '../ui/button';
import { Modal, ModalContent, ModalDescription, ModalTitle, ModalTrigger } from '../ui/dialog';

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
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, MigrationResolution>>({});

  useEffect(() => {
    if (sync.migrationPlan) setResolutions({});
  }, [sync.migrationPlan]);

  const allConflictsResolved = useMemo(() =>
    sync.migrationPlan?.conflicts.every((conflict) => Boolean(resolutions[conflict.key])) ?? false,
  [resolutions, sync.migrationPlan]);

  if (!auth.configured) return null;

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    await auth.sendMagicLink(email);
    setSending(false);
  };

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
        <form className="mt-5 space-y-3" onSubmit={submitEmail}>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-dim" htmlFor="account-email">Email address</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-line bg-surface-0 px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="you@example.com"
          />
          <Button type="submit" className="w-full" disabled={sending || auth.loading}>
            {sending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <LogIn aria-hidden className="size-4" />}
            Email me a sign-in link
          </Button>
        </form>
        {auth.message && <p className="mt-3 rounded-md border border-positive/30 bg-positive-muted p-3 text-sm text-positive" role="status">{auth.message}</p>}
        {auth.error && <p className="mt-3 rounded-md border border-negative/30 bg-negative-muted p-3 text-sm text-negative" role="alert">{auth.error}</p>}
      </> : sync.migrationPlan ? <>
        <ModalTitle>Review device and account leagues</ModalTitle>
        <ModalDescription>Nothing will be discarded until you choose what to do with every conflict.</ModalDescription>
        <div className="mt-5 space-y-4">
          {sync.migrationPlan.conflicts.map((conflict) => <div key={conflict.key} className="rounded-md border border-line bg-surface-0 p-4">
            <p className="text-sm font-semibold text-ink">{conflict.accountLeague.name}</p>
            <p className="mt-1 text-xs text-ink-mute">Account updated {new Date(conflict.accountLeague.updatedAt).toLocaleString()} · Device updated {new Date(conflict.deviceLeague.updatedAt).toLocaleString()}</p>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-ink-dim" htmlFor={`migration-${conflict.key}`}>Choose version</label>
            <select
              id={`migration-${conflict.key}`}
              value={resolutions[conflict.key] ?? ''}
              onChange={(event) => setResolutions((current) => ({ ...current, [conflict.key]: event.target.value as MigrationResolution }))}
              className="mt-1 w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>Select an action</option>
              <option value="keep-account">Keep account version</option>
              <option value="use-device">Use this device version</option>
              <option value="keep-both">Keep both as separate leagues</option>
            </select>
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
