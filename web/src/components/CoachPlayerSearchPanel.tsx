import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import type { PlayerSearchResult } from '../types';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

interface CoachPlayerSearchPanelProps {
  onPlayerSelect: (player: PlayerSearchResult) => void;
  mode: 'roster' | 'free_agents';
}

export function CoachPlayerSearchPanel({ onPlayerSelect, mode }: CoachPlayerSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    count: number;
    limit: number;
    generatedAt: string | null;
    directorySize: number;
  } | null>(null);

  // Generate NHL headshot URL
  const getHeadshotUrl = (playerId: string, team: string) => {
    const numericId = playerId.replace(/^nhl:/, '');
    return `https://assets.nhle.com/mugs/nhl/20242025/${team}/${numericId}.png`;
  };

  const controllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => {
    controllerRef.current?.abort();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setMeta(null);
      setError(null);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const response = await apiService.searchPlayers(term, 12);
      setResults(response.results);
      setMeta(response.meta);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      console.error('player search failed', err);
      setError('Could not load player matches. Please retry.');
      setResults([]);
      setMeta(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (!query.trim() || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setMeta(null);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
  }, [query, runSearch]);

  const handlePlayerAdd = (player: PlayerSearchResult) => {
    onPlayerSelect(player);
    setQuery('');
    setResults([]);
  };

  return (
    <section className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2">
        <label className="block text-xs font-semibold text-[var(--ci-white)] mb-1.5">
          {mode === 'roster' ? 'Add to Roster' : 'Add Free Agent'}
        </label>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players (name or team)..."
          className="w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-[var(--ci-white)] placeholder-[var(--ci-muted)] focus:border-[var(--laser-cyan)] focus:outline-none"
        />
      </div>

      {loading && (
        <div className="text-xs text-[var(--ci-muted)] px-1">Searching...</div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200">{error}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {results.map((player) => (
            <div
              key={player.id}
              className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Player headshot */}
                  <img
                    src={getHeadshotUrl(player.id, player.team)}
                    alt={player.name}
                    className="w-8 h-8 rounded-full bg-slate-900/80 object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--ci-white)] truncate">{player.name}</p>
                    <p className="text-[10px] text-[var(--ci-muted)]">
                      {player.team} · {player.pos.join('/')} · {player.blendedFppg?.toFixed(1) ?? '—'} FPPG
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handlePlayerAdd(player)}
                  className="rounded bg-[var(--laser-cyan)] px-2 py-1 text-[10px] font-semibold text-black hover:bg-[#6ef7ff] whitespace-nowrap"
                >
                  + Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && (
        <div className="text-xs text-[var(--ci-muted)] px-1">
          No players matched "{query}"
        </div>
      )}
    </section>
  );
}
