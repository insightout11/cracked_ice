import { kv } from '@vercel/kv';
import { promises as fsp } from 'fs';
import { join } from 'path';

// Simple KV storage adapter that falls back to filesystem
export class KVStorage {
  private useKV: boolean;
  private fallbackDir: string;

  constructor() {
    // KV is available when KV_REST_API_URL is set (production)
    this.useKV = !!process.env.KV_REST_API_URL;
    this.fallbackDir = join('/tmp', 'data', 'coach', 'users');

    if (this.useKV) {
      console.log('[kv-storage] Using Vercel KV for user data');
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
    if (this.useKV) {
      try {
        const key = this.getKey(userId, component);
        const data = await kv.get<string>(key);
        return data;
      } catch (error) {
        console.error(`[kv-storage] KV read error for ${userId}/${component}:`, error);
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
    if (this.useKV) {
      try {
        const key = this.getKey(userId, component);
        await kv.set(key, data);
        console.log(`[kv-storage] Wrote ${component} for ${userId} to KV`);
      } catch (error) {
        console.error(`[kv-storage] KV write error for ${userId}/${component}:`, error);
        throw new Error(`Failed to write to KV: ${error}`);
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
    if (this.useKV) {
      try {
        const key = this.getKey(userId, component);
        await kv.del(key);
      } catch (error) {
        console.error(`[kv-storage] KV delete error for ${userId}/${component}:`, error);
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
}

// Singleton instance
let kvStorage: KVStorage | null = null;

export function getKVStorage(): KVStorage {
  if (!kvStorage) {
    kvStorage = new KVStorage();
  }
  return kvStorage;
}
