import Redis from 'ioredis';
import type { PlayerProjection } from '../../lib/coachSchemas';

// Projection cache that uses Redis in production, falls back to in-memory for local dev
class ProjectionCache {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, { projection: PlayerProjection; timestamp: number }>();
  private redisUrl: string | null;
  private connectionPromise: Promise<void> | null = null;
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'proj:';

  constructor() {
    this.redisUrl = process.env.REDIS_URL || null;

    if (this.redisUrl) {
      console.log('[projection-cache] Redis URL detected, will use Redis for caching');
    } else {
      console.log('[projection-cache] No Redis URL, using in-memory cache');
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.redisUrl) {
      return; // No Redis URL, will use memory
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
        console.log('[projection-cache] Connecting to Redis...');
        this.redis = new Redis(this.redisUrl!, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          connectTimeout: 5000,
          lazyConnect: true,
        });

        await this.redis.connect();
        console.log('[projection-cache] Successfully connected to Redis');
      } catch (error) {
        console.error('[projection-cache] Failed to connect to Redis:', error);
        this.redis = null;
        this.redisUrl = null; // Disable Redis for this instance
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Get cached projection if it exists and hasn't expired
   */
  async get(key: string): Promise<PlayerProjection | null> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;

    // Try Redis first
    if (this.redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          const data = await this.redis.get(fullKey);
          if (data) {
            return JSON.parse(data) as PlayerProjection;
          }
        }
      } catch (error) {
        console.error('[projection-cache] Redis get error, falling back to memory:', error);
      }
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(fullKey);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL_SECONDS * 1000) {
      this.memoryCache.delete(fullKey);
      return null;
    }

    return cached.projection;
  }

  /**
   * Store a projection in the cache
   */
  async set(key: string, projection: PlayerProjection): Promise<void> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;

    // Try Redis first
    if (this.redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          await this.redis.setex(
            fullKey,
            this.CACHE_TTL_SECONDS,
            JSON.stringify(projection)
          );
          console.log(`[projection-cache] Cached projection in Redis: ${key}`);
          return; // Success, don't fall back to memory
        }
      } catch (error) {
        console.error('[projection-cache] Redis set error, falling back to memory:', error);
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(fullKey, {
      projection,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached projections
   */
  async clear(): Promise<void> {
    // Clear Redis
    if (this.redisUrl) {
      try {
        await this.ensureConnected();

        if (this.redis && this.redis.status === 'ready') {
          const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      } catch (error) {
        console.error('[projection-cache] Redis clear error:', error);
      }
    }

    // Clear memory cache
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  async getStats(): Promise<{ size: number; backend: string; keys: string[] }> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
        return {
          size: keys.length,
          backend: 'redis',
          keys: keys.map(k => k.replace(this.CACHE_PREFIX, ''))
        };
      } catch (error) {
        console.error('[projection-cache] Redis stats error:', error);
      }
    }

    return {
      size: this.memoryCache.size,
      backend: 'memory',
      keys: Array.from(this.memoryCache.keys()).map(k => k.replace(this.CACHE_PREFIX, ''))
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.warn('[projection-cache] Error disconnecting from Redis:', error);
      }
    }
  }
}

// Singleton instance
const projectionCache = new ProjectionCache();

/**
 * Generate cache key for a player projection
 * Key format: playerId:windowStart:windowEnd:rosterHash
 */
export function getCacheKey(
  playerId: string,
  windowStart: string,
  windowEnd: string,
  rosterHash: string
): string {
  return `${playerId}:${windowStart}:${windowEnd}:${rosterHash}`;
}

/**
 * Get cached projection if it exists and hasn't expired
 */
export async function getCachedProjection(key: string): Promise<PlayerProjection | null> {
  return projectionCache.get(key);
}

/**
 * Store a projection in the cache
 */
export async function setCachedProjection(key: string, projection: PlayerProjection): Promise<void> {
  return projectionCache.set(key, projection);
}

/**
 * Clear all cached projections
 */
export async function clearCache(): Promise<void> {
  return projectionCache.clear();
}

/**
 * Generate a simple hash from roster player IDs for cache key
 */
export function getRosterHash(roster: Array<{ id: string }>): string {
  const ids = roster.map(p => p.id).sort().join(',');
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < ids.length; i++) {
    const char = ids.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cache statistics for debugging
 */
export async function getCacheStats(): Promise<{ size: number; backend: string; keys: string[] }> {
  return projectionCache.getStats();
}
