import Redis from 'ioredis';
import { promises as fsp } from 'fs';
import { join } from 'path';

// Simple Redis storage adapter that falls back to filesystem
export class KVStorage {
  private redis: Redis | null = null;
  private fallbackDir: string;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.fallbackDir = join('/tmp', 'data', 'coach', 'users');
    // NOTE: Don't read REDIS_URL in constructor - read at runtime when methods are called
    // This ensures we get the env var after Vercel has set it up
    console.log('[kv-storage] KVStorage initialized (will check for REDIS_URL at runtime)');
  }

  private getRedisUrl(): string | null {
    // Read from environment at runtime, not at construction time
    const url = process.env.REDIS_URL || null;
    if (!url) {
      console.log('[kv-storage] WARNING: REDIS_URL not found in process.env at runtime');
      console.log('[kv-storage] Available env vars:', Object.keys(process.env).filter(k => k.includes('REDIS')));
    }
    return url;
  }

  private async ensureConnected(): Promise<void> {
    const redisUrl = this.getRedisUrl();
    if (!redisUrl) {
      return; // No Redis URL, will use filesystem
    }

    if (this.redis && this.redis.status === 'ready') {
      return; // Already connected
    }

    // If connection is in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Start new connection
    this.connectionPromise = (async () => {
      try {
        console.log('[kv-storage] Connecting to Redis...');
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          connectTimeout: 5000,
          lazyConnect: true, // Don't connect immediately
        });

        await this.redis.connect();
        console.log('[kv-storage] Successfully connected to Redis');
      } catch (error) {
        console.error('[kv-storage] Failed to connect to Redis:', error);
        this.redis = null;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  private getKey(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides'): string {
    return `users:${userId}:${component}`;
  }

  private getFilePath(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides'): string {
    const fileNames = {
      settings: 'settings.json',
      roster: 'roster.json',
      free_agents: 'free_agents.json',
      position_overrides: 'position_overrides.json'
    };
    return join(this.fallbackDir, userId, fileNames[component]);
  }

  async read(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides'): Promise<string | null> {
    const redisUrl = this.getRedisUrl();
    if (redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          const key = this.getKey(userId, component);
          const data = await this.redis.get(key);
          console.log(`[kv-storage] Redis read ${component} for ${userId}: ${data ? `${data.length} chars` : 'null'}`);
          return data;
        } else {
          console.warn(`[kv-storage] Redis not ready (status: ${this.redis?.status}), falling back to filesystem`);
        }
      } catch (error) {
        console.error(`[kv-storage] Redis read error for ${userId}/${component}, falling back to filesystem:`, error);
      }
    }

    // Filesystem fallback
    console.log(`[kv-storage] Using filesystem fallback for ${userId}/${component}`);
    try {
      const path = this.getFilePath(userId, component);
      const data = await fsp.readFile(path, 'utf8');
      console.log(`[kv-storage] Filesystem read ${component}: ${data.length} chars`);
      return data;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`[kv-storage] File not found for ${userId}/${component}, returning null`);
        return null;
      }
      throw error;
    }
  }

  async write(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides', data: string): Promise<void> {
    // Redis is mandatory for production, but local development must remain usable
    // without production credentials. Reads already use this same filesystem path.
    const redisUrl = this.getRedisUrl();
    if (!redisUrl) {
      const isProduction = process.env.VERCEL_ENV === 'production' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV);
      if (isProduction) {
        const error = new Error('CRITICAL: REDIS_URL not configured. Cannot persist user data safely.');
        console.error('[kv-storage]', error.message);
        throw error;
      }

      const path = this.getFilePath(userId, component);
      await fsp.mkdir(join(this.fallbackDir, userId), { recursive: true });
      await fsp.writeFile(path, data, 'utf8');
      console.log(`[kv-storage] Filesystem write ${component} for ${userId}: ${data.length} chars`);
      return;
    }

    try {
      await this.ensureConnected();

      if (!this.redis || this.redis.status !== 'ready') {
        throw new Error(`Redis connection not ready (status: ${this.redis?.status || 'null'})`);
      }

      const key = this.getKey(userId, component);
      await this.redis.set(key, data);
      console.log(`[kv-storage] ✓ Wrote ${component} for ${userId} to Redis (${data.length} bytes)`);

      // Verify write succeeded by reading it back
      const verification = await this.redis.get(key);
      if (!verification) {
        throw new Error('Write verification failed: data not found after write');
      }
      if (verification !== data) {
        throw new Error('Write verification failed: data mismatch after write');
      }

    } catch (error) {
      console.error(`[kv-storage] ✗ CRITICAL: Redis write FAILED for ${userId}/${component}:`, error);
      console.error('[kv-storage] User data will NOT be persisted. This is a production-critical error.');
      throw error; // Fail loudly - DO NOT fall back to ephemeral storage
    }
  }

  async delete(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides'): Promise<void> {
    const redisUrl = this.getRedisUrl();
    if (redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          const key = this.getKey(userId, component);
          await this.redis.del(key);
        }
      } catch (error) {
        console.error(`[kv-storage] Redis delete error for ${userId}/${component}:`, error);
      }
    }

    // Also try to delete from filesystem
    try {
      const path = this.getFilePath(userId, component);
      await fsp.unlink(path);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`[kv-storage] Filesystem delete error: ${error.message}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.warn('[kv-storage] Error disconnecting from Redis:', error);
      }
    }
  }
}

// Singleton instance
let kvStorage: KVStorage | null = null;

export function getKVStorage(): KVStorage {
  if (!kvStorage) {
    kvStorage = new KVStorage();
  }
  return kvStorage;
}
