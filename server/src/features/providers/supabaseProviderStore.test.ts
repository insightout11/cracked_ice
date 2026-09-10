import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateProfile } from './supabaseProviderStore';

describe('Supabase provider authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the public Vite Supabase variables in the serverless runtime', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'profile-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(authenticateProfile('Bearer access-token')).resolves.toBe('profile-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/user',
      { headers: { apikey: 'public-anon-key', Authorization: 'Bearer access-token' } },
    );
  });

  it('still fails closed when no public authentication configuration exists', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(authenticateProfile('Bearer access-token')).rejects.toThrow(
      'Supabase authentication configuration is incomplete.',
    );
  });
});
