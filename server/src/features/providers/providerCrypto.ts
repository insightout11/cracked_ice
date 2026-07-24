import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedEnvelope {
  version: 1;
  iv: string;
  ciphertext: string;
  tag: string;
}

export function loadEncryptionKey(encoded = process.env.YAHOO_TOKEN_ENCRYPTION_KEY): Buffer {
  if (!encoded) throw new Error('YAHOO_TOKEN_ENCRYPTION_KEY is not configured.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('YAHOO_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptSecret(value: string, key = loadEncryptionKey()): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptSecret(envelope: EncryptedEnvelope, key = loadEncryptionKey()): string {
  if (envelope.version !== 1) throw new Error('Unsupported encrypted secret version.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

export function createOAuthProof(): { state: string; stateHash: string; verifier: string; challenge: string } {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  return {
    state,
    stateHash: createHash('sha256').update(state).digest('hex'),
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

export function hashOAuthState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}
