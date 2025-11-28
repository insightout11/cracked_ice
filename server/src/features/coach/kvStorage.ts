import Redis from 'ioredis';
import { promises as fsp } from 'fs';
import { join } from 'path';

// Simple Redis storage adapter that falls back to filesystem
export class KVStorage {
  private redis: Redis | null = null;
  private useRedis: boolean;
  private fallbackDir: string;

  constructor() {
    // Redis is available when REDIS_URL is set (production)
    this.useRedis = !!process.env.REDIS_URL;
    this.fallbackDir = join('/tmp', 'data', 'coach', 'users');

    if (this.useRedis && process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          connectTimeout: 10000,
        });
        console.log('[kv-storage] Using Redis for user data');
      } catch (error) {
        console.error('[kv-storage] Failed to connect to Redis, falling back to filesystem:', error);
        this.useRedis = false;
        this.redis = null;
      }
    } else {
      console.log('[kv-storage] Using filesystem for user data (local dev)');
    }
  }

  private getKey(userId: string, component: 'settings' | 'roster' | 'free_agents'): string {
    return `users:${userId}:${component}`;
  }

  private getFilePath(userId: string, component: 'settings' | 'roster' | 'free_agents'): string {
    const fileNames = {
      settings: 'settings.json',
      roster: 'roster.json',
      free_agents: 'free_agents.json'
    };
    return join(this.fallbackDir, userId, fileNames[component]);
  }

  async read(userId: string, component: 'settings' | 'roster' | 'free_agents'): Promise<string | null> {
    if (this.useRedis && this.redis) {
      try {
        const key = this.getKey(userId, component);
        const data = await this.redis.get(key);
        return data;
      } catch (error) {
        console.error(`[kv-storage] Redis read error for ${userId}/${component}:`, error);
        return null;
      }
    } else {
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
  }

  async write(userId: string, component: 'settings' | 'roster' | 'free_agents', data: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const key = this.getKey(userId, component);
        await this.redis.set(key, data);
        console.log(`[kv-storage] Wrote ${component} for ${userId} to Redis`);
      } catch (error) {
        console.error(`[kv-storage] Redis write error for ${userId}/${component}:`, error);
        throw new Error(`Failed to write to Redis: ${error}`);
      }
    } else {
      // Filesystem fallback
      const path = this.getFilePath(userId, component);
      const dir = path.substring(0, path.lastIndexOf('/'));
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path, data, 'utf8');
      console.log(`[kv-storage] Wrote ${component} for ${userId} to filesystem`);
    }
  }

  async delete(userId: string, component: 'settings' | 'roster' | 'free_agents'): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const key = this.getKey(userId, component);
        await this.redis.del(key);
      } catch (error) {
        console.error(`[kv-storage] Redis delete error for ${userId}/${component}:`, error);
      }
    } else {
      // Filesystem fallback
      try {
        const path = this.getFilePath(userId, component);
        await fsp.unlink(path);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
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
