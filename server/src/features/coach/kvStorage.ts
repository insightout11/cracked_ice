import Redis from 'ioredis';
import { promises as fsp } from 'fs';
import { join } from 'path';

// Simple Redis storage adapter that falls back to filesystem
export class KVStorage {
  private redis: Redis | null = null;
  private redisUrl: string | null;
  private fallbackDir: string;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.redisUrl = process.env.REDIS_URL || null;
    this.fallbackDir = join('/tmp', 'data', 'coach', 'users');

    if (this.redisUrl) {
      console.log('[kv-storage] Redis URL detected, will connect on first use');
    } else {
      console.log('[kv-storage] No Redis URL, using filesystem for user data');
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.redisUrl) {
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
        this.redis = new Redis(this.redisUrl!, {
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
        this.redisUrl = null; // Disable Redis for this instance
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
    if (this.redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          const key = this.getKey(userId, component);
          const data = await this.redis.get(key);
          return data;
        }
      } catch (error) {
        console.error(`[kv-storage] Redis read error for ${userId}/${component}, falling back to filesystem:`, error);
      }
    }

    // Filesystem fallback
    try {
      const path = this.getFilePath(userId, component);
      return await fsp.readFile(path, 'utf8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async write(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides', data: string): Promise<void> {
    if (this.redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          const key = this.getKey(userId, component);
          await this.redis.set(key, data);
          console.log(`[kv-storage] Wrote ${component} for ${userId} to Redis`);
          return; // Success, don't fall back to filesystem
        }
      } catch (error) {
        console.error(`[kv-storage] Redis write error for ${userId}/${component}, falling back to filesystem:`, error);
      }
    }

    // Filesystem fallback
    const path = this.getFilePath(userId, component);
    const dir = path.substring(0, path.lastIndexOf('/'));
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path, data, 'utf8');
    console.log(`[kv-storage] Wrote ${component} for ${userId} to filesystem`);
  }

  async delete(userId: string, component: 'settings' | 'roster' | 'free_agents' | 'position_overrides'): Promise<void> {
    if (this.redisUrl) {
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
