import { useCallback, useEffect, useState } from 'react';
import { Link2, LoaderCircle, Unplug } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';

interface YahooStatus {
  configured: boolean;
  connected: boolean;
  connection: { status: string; updated_at: string; last_error_code: string | null } | null;
}

const endpoint = `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8080' : ''}/api/yahoo`;

export function YahooConnectionControl() {
  const { client, user } = useAuth();
  const [status, setStatus] = useState<YahooStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = import.meta.env.VITE_YAHOO_CONNECT_ENABLED === 'true';

  const accessToken = useCallback(async () => {
    const session = await client?.auth.getSession();
    return session?.data.session?.access_token ?? null;
  }, [client]);

  const load = useCallback(async () => {
    if (!user) return;
    const token = await accessToken();
    if (!token) return;
    try {
      const response = await fetch(`${endpoint}/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Yahoo status could not be loaded.');
      setStatus(await response.json() as YahooStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Yahoo status could not be loaded.');
    }
  }, [accessToken, user]);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  const connect = async () => {
    setBusy(true); setError(null);
    try {
      const token = await accessToken();
      const response = await fetch(`${endpoint}/connect`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/team` }),
      });
      const payload = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error ?? 'Yahoo authorization could not start.');
      window.location.assign(payload.authorizationUrl);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Yahoo authorization could not start.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true); setError(null);
    try {
      const token = await accessToken();
      const response = await fetch(`${endpoint}/connection`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Yahoo could not be disconnected.');
      await load();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Yahoo could not be disconnected.');
    } finally { setBusy(false); }
  };

  if (!enabled) return (
    <div className="rounded-lg border border-line bg-surface-0/40 p-4">
      <p className="font-semibold text-ink">Yahoo Fantasy Connect</p>
      <p className="mt-1 text-xs text-ink-dim">Read-only league sync is being prepared and will be enabled after Yahoo approves API access.</p>
    </div>
  );
  if (!user) return <p className="text-sm text-ink-dim">Sign in to Cracked Ice before connecting a private Yahoo league.</p>;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-0/40 p-4">
      <div>
        <p className="font-semibold text-ink">Yahoo Fantasy</p>
        <p className="text-xs text-ink-dim">
          {status?.connected ? `Connected · last changed ${new Date(status.connection!.updated_at).toLocaleString()}` : 'Read-only league and roster sync. Cracked Ice cannot change your Yahoo lineup.'}
        </p>
        {status && !status.configured && <p className="mt-1 text-xs text-warning">Developer app activation is still required.</p>}
        {error && <p className="mt-1 text-xs text-negative" role="alert">{error}</p>}
      </div>
      {status?.connected ? (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={disconnect}><Unplug className="size-4" aria-hidden="true" /> Disconnect</Button>
      ) : (
        <Button type="button" size="sm" disabled={busy || status === null || status.configured === false} onClick={connect}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />} Connect Yahoo
        </Button>
      )}
    </div>
  );
}
