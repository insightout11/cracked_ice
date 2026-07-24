import { afterEach, describe, expect, it } from 'vitest';
import { KVStorage } from './kvStorage';

const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalRedisUrl = process.env.REDIS_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

describe('KVStorage writes', () => {
  it('uses the existing filesystem fallback outside production', async () => {
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
    const storage = new KVStorage();
    const userId = `kv-test-${Date.now()}`;

    await storage.write(userId, 'roster', '{"roster":[]}');
    await expect(storage.read(userId, 'roster')).resolves.toBe('{"roster":[]}');
    await storage.delete(userId, 'roster');
  });

  it('still refuses ephemeral writes in production', async () => {
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const storage = new KVStorage();

    await expect(storage.write('production-test', 'roster', '{"roster":[]}'))
      .rejects.toThrow('REDIS_URL not configured');
  });
});
