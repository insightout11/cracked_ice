import { useState, useEffect, useCallback } from 'react';
import type { LeaguePool, AvailabilityMark, AvailabilityStatus } from '../types';

const STORAGE_PREFIX = 'ci.leaguePool';
const CURRENT_VERSION = 1;

/**
 * Hook for managing player availability and watchlist for a specific league
 * Persists data to localStorage with easy migration path to Supabase
 */
export function useLeaguePool(leagueId: string = 'default') {
  const [pool, setPool] = useState<LeaguePool>({
    leagueId,
    marks: {},
    watchlist: [],
    version: CURRENT_VERSION,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount or leagueId change
  useEffect(() => {
    const storageKey = `${STORAGE_PREFIX}.${leagueId}`;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as LeaguePool;

        // Handle version migration if needed
        if (parsed.version !== CURRENT_VERSION) {
          console.warn(`Migrating league pool from v${parsed.version} to v${CURRENT_VERSION}`);
          // Add migration logic here if needed
          parsed.version = CURRENT_VERSION;
        }

        setPool(parsed);
      }
    } catch (error) {
      console.error('Failed to load league pool from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [leagueId]);

  // Save to localStorage whenever pool changes
  const persistPool = useCallback((updatedPool: LeaguePool) => {
    const storageKey = `${STORAGE_PREFIX}.${leagueId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedPool));
    } catch (error) {
      console.error('Failed to save league pool to localStorage:', error);
    }
  }, [leagueId]);

  // Get availability status for a player
  const getAvailability = useCallback((playerId: string): AvailabilityStatus => {
    return pool.marks[playerId]?.status || 'UNKNOWN';
  }, [pool.marks]);

  // Set availability for a player
  const setAvailability = useCallback((
    playerId: string,
    status: AvailabilityStatus,
    source: AvailabilityMark['source'] = 'manual',
    confidence: number = 1.0
  ) => {
    setPool(prev => {
      const updated: LeaguePool = {
        ...prev,
        marks: {
          ...prev.marks,
          [playerId]: {
            playerId,
            status,
            source,
            confidence,
            updatedAt: new Date().toISOString(),
          },
        },
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Set availability for multiple players (bulk operation)
  const setAvailabilityBulk = useCallback((
    playerIds: string[],
    status: AvailabilityStatus,
    source: AvailabilityMark['source'] = 'bulk_paste',
    confidence: number = 0.9
  ) => {
    setPool(prev => {
      const newMarks = { ...prev.marks };
      const timestamp = new Date().toISOString();

      playerIds.forEach(playerId => {
        newMarks[playerId] = {
          playerId,
          status,
          source,
          confidence,
          updatedAt: timestamp,
        };
      });

      const updated: LeaguePool = {
        ...prev,
        marks: newMarks,
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Remove availability mark for a player
  const removeAvailability = useCallback((playerId: string) => {
    setPool(prev => {
      const newMarks = { ...prev.marks };
      delete newMarks[playerId];

      const updated: LeaguePool = {
        ...prev,
        marks: newMarks,
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Get all players with a specific availability status
  const getPlayersByStatus = useCallback((status: AvailabilityStatus): string[] => {
    return Object.values(pool.marks)
      .filter(mark => mark.status === status)
      .map(mark => mark.playerId);
  }, [pool.marks]);

  // Check if player is in watchlist
  const isWatched = useCallback((playerId: string): boolean => {
    return pool.watchlist.includes(playerId);
  }, [pool.watchlist]);

  // Toggle player in watchlist
  const toggleWatch = useCallback((playerId: string) => {
    setPool(prev => {
      const updated: LeaguePool = {
        ...prev,
        watchlist: prev.watchlist.includes(playerId)
          ? prev.watchlist.filter(id => id !== playerId)
          : [...prev.watchlist, playerId],
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Add player to watchlist
  const addToWatchlist = useCallback((playerId: string) => {
    setPool(prev => {
      if (prev.watchlist.includes(playerId)) return prev;

      const updated: LeaguePool = {
        ...prev,
        watchlist: [...prev.watchlist, playerId],
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Remove player from watchlist
  const removeFromWatchlist = useCallback((playerId: string) => {
    setPool(prev => {
      const updated: LeaguePool = {
        ...prev,
        watchlist: prev.watchlist.filter(id => id !== playerId),
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Clear watchlist
  const clearWatchlist = useCallback(() => {
    setPool(prev => {
      const updated: LeaguePool = {
        ...prev,
        watchlist: [],
      };
      persistPool(updated);
      return updated;
    });
  }, [persistPool]);

  // Get availability mark details (for tooltips/debugging)
  const getAvailabilityMark = useCallback((playerId: string): AvailabilityMark | null => {
    return pool.marks[playerId] || null;
  }, [pool.marks]);

  // Filter players by criteria
  const selectBy = useCallback((filter: {
    status?: AvailabilityStatus | AvailabilityStatus[];
    watched?: boolean;
    source?: AvailabilityMark['source'];
  }): string[] => {
    let playerIds: string[] = [];

    // Filter by status
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      playerIds = Object.values(pool.marks)
        .filter(mark => statuses.includes(mark.status))
        .map(mark => mark.playerId);
    } else {
      playerIds = Object.keys(pool.marks);
    }

    // Filter by watchlist
    if (filter.watched !== undefined) {
      if (filter.watched) {
        playerIds = playerIds.filter(id => pool.watchlist.includes(id));
      } else {
        playerIds = playerIds.filter(id => !pool.watchlist.includes(id));
      }
    }

    // Filter by source
    if (filter.source) {
      playerIds = playerIds.filter(id => pool.marks[id]?.source === filter.source);
    }

    return playerIds;
  }, [pool.marks, pool.watchlist]);

  return {
    // State
    pool,
    isLoaded,

    // Availability operations
    getAvailability,
    setAvailability,
    setAvailabilityBulk,
    removeAvailability,
    getPlayersByStatus,
    getAvailabilityMark,

    // Watchlist operations
    isWatched,
    toggleWatch,
    addToWatchlist,
    removeFromWatchlist,
    clearWatchlist,
    watchlist: pool.watchlist,

    // Query operations
    selectBy,

    // All marks
    marks: pool.marks,
  };
}
