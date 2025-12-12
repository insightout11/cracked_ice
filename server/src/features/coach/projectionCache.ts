import type { PlayerProjection } from '../../lib/coachSchemas';

interface CachedProjection {
  projection: PlayerProjection;
  timestamp: number;
}

const cache = new Map<string, CachedProjection>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
export function getCachedProjection(key: string): PlayerProjection | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  // Check if cache entry has expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.projection;
}

/**
 * Store a projection in the cache
 */
export function setCachedProjection(key: string, projection: PlayerProjection): void {
  cache.set(key, {
    projection,
    timestamp: Date.now()
  });
}

/**
 * Clear all cached projections
 */
export function clearCache(): void {
  cache.clear();
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
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}
