import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { toLeagueProfile, type LeagueWorkspace } from '../lib/leagueWorkspace';
import type { PlayerSearchResult } from '../types';

const requests = new Map<string, Promise<PlayerSearchResult[]>>();

/**
 * The public player directory scored with this league's settings: no account needed, so
 * a visitor who has only pasted their league can see pickups before signing in.
 */
export function usePublicDirectory(workspace: LeagueWorkspace, enabled = true): PlayerSearchResult[] | undefined {
  const profile = useMemo(() => toLeagueProfile(workspace), [workspace]);
  const key = JSON.stringify(profile);
  const [loaded, setLoaded] = useState<{ key: string; players: PlayerSearchResult[] } | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let request = requests.get(key);
    if (!request) {
      request = apiService.getDraftPlayers(profile).then((response) => response.players as unknown as PlayerSearchResult[]);
      request.catch(() => requests.delete(key));
      requests.set(key, request);
    }
    request.then((players) => { if (!cancelled) setLoaded({ key, players }); }).catch(() => { /* Pickups wait until the list loads. */ });
    return () => { cancelled = true; };
  }, [enabled, key, profile]);
  return loaded?.key === key ? loaded.players : undefined;
}
