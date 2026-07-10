import { useState, useEffect, useCallback } from 'react';

export interface UserLists {
  faList: string[];
  watchlist: string[];
}

export function useUserLists(userId: string = 'default') {
  const [faList, setFAListState] = useState<string[]>([]);
  const [watchlist, setWatchlistState] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedFAList = localStorage.getItem(`faList:${userId}`);
      const storedWatchlist = localStorage.getItem(`watchlist:${userId}`);

      if (storedFAList) {
        setFAListState(JSON.parse(storedFAList));
      }
      if (storedWatchlist) {
        setWatchlistState(JSON.parse(storedWatchlist));
      }
    } catch (error) {
      console.error('Failed to load user lists from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [userId]);

  // Save FA List to localStorage
  const setFAList = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setFAListState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(`faList:${userId}`, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save FA List to localStorage:', error);
      }
      return next;
    });
  }, [userId]);

  // Save Watchlist to localStorage
  const setWatchlist = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setWatchlistState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(`watchlist:${userId}`, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save Watchlist to localStorage:', error);
      }
      return next;
    });
  }, [userId]);

  // Optional: Sync to backend (stub for now)
  const sync = useCallback(async () => {
    try {
      // Try to sync with backend if endpoint exists
      // For now, this is a no-op that logs
      // await apiService.updateUserPreferences(userId, { faList, watchlist });
    } catch (error) {
      // Silently fail if endpoint doesn't exist
      console.warn('Failed to sync user lists to backend:', error);
    }
  }, []);

  return {
    faList,
    setFAList,
    watchlist,
    setWatchlist,
    sync,
    isLoaded,
  };
}
