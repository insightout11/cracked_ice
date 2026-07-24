import { Router } from 'express';
import { createOAuthProof, decryptSecret, encryptSecret, hashOAuthState } from '../features/providers/providerCrypto';
import { authenticateProfile, consumeAttempt, createAttempt, deleteYahooConnection, getYahooStatus, saveYahooConnection } from '../features/providers/supabaseProviderStore';

export const yahooRoutes = Router();
const AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

function callbackUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  return process.env.YAHOO_REDIRECT_URI ?? `${req.protocol}://${req.get('host')}/api/yahoo/callback`;
}

function safeReturnUrl(value: unknown, req: { protocol: string; get(name: string): string | undefined }): string {
  const fallback = `${req.protocol}://${req.get('host')}/team?yahoo=connected`;
  if (typeof value !== 'string') return fallback;
  try {
    const candidate = new URL(value);
    const allowed = new Set((process.env.YAHOO_RETURN_ORIGINS ?? 'http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5175').split(','));
    return allowed.has(candidate.origin) ? candidate.toString() : fallback;
  } catch { return fallback; }
}

yahooRoutes.get('/status', async (req, res) => {
  try {
    const profileId = await authenticateProfile(req.get('authorization'));
    const status = await getYahooStatus(profileId);
    res.json({ configured: Boolean(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET && process.env.YAHOO_TOKEN_ENCRYPTION_KEY), connected: Boolean(status), connection: status });
  } catch (error) {
    res.status((error as Error).message === 'AUTH_REQUIRED' ? 401 : 503).json({ error: (error as Error).message === 'AUTH_REQUIRED' ? 'Sign in required.' : 'Yahoo connection status is unavailable.' });
  }
});

yahooRoutes.post('/connect', async (req, res) => {
  try {
    const clientId = process.env.YAHOO_CLIENT_ID;
    if (!clientId || !process.env.YAHOO_CLIENT_SECRET || !process.env.YAHOO_TOKEN_ENCRYPTION_KEY) return res.status(503).json({ error: 'Yahoo Connect is not configured yet.' });
    const profileId = await authenticateProfile(req.get('authorization'));
    const proof = createOAuthProof();
    await createAttempt(proof.stateHash, { profileId, verifier: encryptSecret(proof.verifier), returnUrl: safeReturnUrl(req.body?.returnUrl, req), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: callbackUrl(req), response_type: 'code', state: proof.state, code_challenge: proof.challenge, code_challenge_method: 'S256' }).toString();
    res.json({ authorizationUrl: url.toString() });
  } catch (error) {
    res.status((error as Error).message === 'AUTH_REQUIRED' ? 401 : 500).json({ error: (error as Error).message === 'AUTH_REQUIRED' ? 'Sign in required.' : 'Yahoo authorization could not start.' });
  }
});

yahooRoutes.get('/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  try {
    if (!state || !code) throw new Error('Missing OAuth response.');
    const attempt = await consumeAttempt(hashOAuthState(state));
    if (!attempt) throw new Error('OAuth attempt expired or was already used.');
    const clientId = process.env.YAHOO_CLIENT_ID!;
    const clientSecret = process.env.YAHOO_CLIENT_SECRET!;
    const response = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: callbackUrl(req), code, code_verifier: decryptSecret(attempt.verifier) }) });
    if (!response.ok) throw new Error(`Yahoo token exchange failed (${response.status}).`);
    const tokens = await response.json() as { access_token: string; refresh_token?: string; expires_in: number; xoauth_yahoo_guid?: string };
    if (!tokens.access_token || !tokens.refresh_token || !tokens.xoauth_yahoo_guid) throw new Error('Yahoo returned an incomplete token response.');
    await saveYahooConnection({ profileId: attempt.profileId, providerUserId: tokens.xoauth_yahoo_guid, tokens: encryptSecret(JSON.stringify({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token })), expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), permissions: ['fantasy-sports:read'] });
    const destination = new URL(attempt.returnUrl); destination.searchParams.set('yahoo', 'connected');
    res.redirect(303, destination.toString());
  } catch {
    res.status(400).send('Yahoo connection could not be completed. Return to Cracked Ice and try again.');
  }
});

yahooRoutes.delete('/connection', async (req, res) => {
  try {
    const profileId = await authenticateProfile(req.get('authorization'));
    await deleteYahooConnection(profileId);
    res.status(204).end();
  } catch (error) {
    res.status((error as Error).message === 'AUTH_REQUIRED' ? 401 : 500).json({ error: (error as Error).message === 'AUTH_REQUIRED' ? 'Sign in required.' : 'Yahoo could not be disconnected.' });
  }
});
