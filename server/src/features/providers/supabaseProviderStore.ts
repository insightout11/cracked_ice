import type { EncryptedEnvelope } from './providerCrypto';

interface OAuthAttempt {
  profileId: string;
  verifier: EncryptedEnvelope;
  returnUrl: string;
  expiresAt: string;
}

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !publicKey) throw new Error('Supabase server configuration is incomplete.');
  return { url, serviceKey, publicKey };
}

async function request(path: string, init: RequestInit = {}) {
  const { url, serviceKey } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw new Error(`Provider store request failed (${response.status}).`);
  return response;
}

export async function authenticateProfile(authorization?: string): Promise<string> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error('AUTH_REQUIRED');
  const { url, publicKey } = config();
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('AUTH_REQUIRED');
  const user = await response.json() as { id?: string };
  if (!user.id) throw new Error('AUTH_REQUIRED');
  return user.id;
}

export async function createAttempt(stateHash: string, attempt: OAuthAttempt): Promise<void> {
  await request('provider_oauth_attempts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    state_hash: stateHash, profile_id: attempt.profileId, provider: 'yahoo', encrypted_verifier: attempt.verifier,
    return_url: attempt.returnUrl, expires_at: attempt.expiresAt,
  }) });
}

export async function consumeAttempt(stateHash: string): Promise<OAuthAttempt | null> {
  const response = await request(`provider_oauth_attempts?state_hash=eq.${encodeURIComponent(stateHash)}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });
  const rows = await response.json() as Array<{ profile_id: string; encrypted_verifier: EncryptedEnvelope; return_url: string; expires_at: string }>;
  return rows[0] ? { profileId: rows[0].profile_id, verifier: rows[0].encrypted_verifier, returnUrl: rows[0].return_url, expiresAt: rows[0].expires_at } : null;
}

export async function saveYahooConnection(input: { profileId: string; providerUserId: string; tokens: EncryptedEnvelope; expiresAt: string; permissions: string[] }): Promise<void> {
  await request('provider_connections?on_conflict=profile_id,provider', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({
    profile_id: input.profileId, provider: 'yahoo', provider_user_id: input.providerUserId, encrypted_tokens: input.tokens,
    access_expires_at: input.expiresAt, permissions: input.permissions, status: 'connected', last_error_code: null,
  }) });
}

export async function getYahooStatus(profileId: string) {
  const response = await request(`provider_connections?profile_id=eq.${encodeURIComponent(profileId)}&provider=eq.yahoo&select=status,access_expires_at,updated_at,last_error_code`);
  const rows = await response.json() as Array<{ status: string; access_expires_at: string; updated_at: string; last_error_code: string | null }>;
  return rows[0] ?? null;
}

export async function deleteYahooConnection(profileId: string): Promise<void> {
  await request(`provider_connections?profile_id=eq.${encodeURIComponent(profileId)}&provider=eq.yahoo`, { method: 'DELETE' });
}
