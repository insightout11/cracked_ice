import { describe, expect, it } from 'vitest';
import { createOAuthProof, decryptSecret, encryptSecret, hashOAuthState } from './providerCrypto';

describe('provider credential protection', () => {
  const key = Buffer.alloc(32, 7);

  it('round-trips without retaining plaintext', () => {
    const envelope = encryptSecret('refresh-token', key);
    expect(JSON.stringify(envelope)).not.toContain('refresh-token');
    expect(decryptSecret(envelope, key)).toBe('refresh-token');
  });

  it('creates state and an S256 PKCE challenge', () => {
    const proof = createOAuthProof();
    expect(proof.state).not.toBe(proof.verifier);
    expect(proof.stateHash).toBe(hashOAuthState(proof.state));
    expect(proof.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
