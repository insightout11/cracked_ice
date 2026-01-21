import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { MobilePlayerRow, MobilePlayerRowSkeleton } from '../components/MobilePlayerRow';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';

interface MobilePlayersViewProps {
  // Data
  roster: RosterPlayer[];
  projections: Record<string, PlayerProjection>;
  watchlist?: Set<string>;
  freeAgents?: RosterPlayer[];
  isLoadingFreeAgents?: boolean;

  // Pre-set filters (from cross-tab navigation)
  initialPositionFilter?: string | null;
  initialTeamFilter?: string | null;

  // Callbacks
  onPlayerTap: (player: RosterPlayer) => void;
  onAddPlayer: (player: RosterPlayer) => void;
  onToggleWatch: (playerId: string) => void;
  onOpenFilters?: () => void;
  onClearFilters?: () => void;
}

type PlayerTab = 'all' | 'roster' | 'watchlist';

const POSITIONS = ['All', 'C', 'LW', 'RW', 'D', 'G'];

/**
 * MobilePlayersView - Player search and management tab
 *
 * Features:
 * - Sticky search bar
 * - Position filter chips
 * - Segmented tabs (All Players, My Team, Watchlist)
 * - Virtualized player list
 * - Pull to refresh
 */
export function MobilePlayersView({
  roster,
  projections,
  watchlist = new Set(),
  freeAgents = [],
  isLoadingFreeAgents = false,
  initialPositionFilter,
  initialTeamFilter,
  onPlayerTap,
  onAddPlayer,
  onToggleWatch,
  onOpenFilters,
  onClearFilters,
}: MobilePlayersViewProps) {
  // State
  const [activeTab, setActiveTab] = useState<PlayerTab>('roster'); // Default to roster tab
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  // Apply initial filters from navigation (only when they change)
  useEffect(() => {
    if (initialPositionFilter !== undefined) {
      setPositionFilter(initialPositionFilter);
    }
  }, [initialPositionFilter]);

  useEffect(() => {
    if (initialTeamFilter !== undefined) {
      setTeamFilter(initialTeamFilter);
    }
  }, [initialTeamFilter]);

  // Roster player IDs for quick lookup
  const rosterIds = useMemo(() => new Set(roster.map(p => p.id)), [roster]);

  // Get players for current tab
  const tabPlayers = useMemo(() => {
    switch (activeTab) {
      case 'roster':
        return roster;
      case 'watchlist':
        return [...roster, ...freeAgents].filter(p => watchlist.has(p.id));
      case 'all':
      default:
        // Combine roster + free agents, dedupe
        const allPlayers = new Map<string, RosterPlayer>();
        roster.forEach(p => allPlayers.set(p.id, p));
        freeAgents.forEach(p => {
          if (!allPlayers.has(p.id)) allPlayers.set(p.id, p);
        });
        return Array.from(allPlayers.values());
    }
  }, [activeTab, roster, freeAgents, watchlist]);

  // Filter players
  const filteredPlayers = useMemo(() => {
    let players = tabPlayers;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      players = players.filter(p => {
        const name = p.full_name || (p as any).name || '';
        const team = p.team || '';
        return name.toLowerCase().includes(query) || team.toLowerCase().includes(query);
      });
    }

    // Position filter
    if (positionFilter && positionFilter !== 'All') {
      players = players.filter(p => {
        const positions = p.positions || [(p as any).position].filter(Boolean);
        return positions.includes(positionFilter);
      });
    }

    // Team filter
    if (teamFilter) {
      players = players.filter(p => p.team === teamFilter);
    }

    // Sort by ICE score descending
    players.sort((a, b) => {
      const aIce = projections[a.id]?.iceScore ?? 0;
      const bIce = projections[b.id]?.iceScore ?? 0;
      return bIce - aIce;
    });

    return players;
  }, [tabPlayers, searchQuery, positionFilter, teamFilter, projections]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Check if filters are active (position "All" is not a filter)
  const hasActiveFilters = (positionFilter !== null && positionFilter !== 'All') || teamFilter !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md border-b border-slate-700">
        {/* Search Bar */}
        <div className="px-4 pt-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded-full"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Position Filter Chips */}
        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {POSITIONS.map((pos) => {
            const isActive = positionFilter === pos || (pos === 'All' && !positionFilter);
            return (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos === 'All' ? null : pos)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${isActive
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }
                `}
              >
                {pos}
              </button>
            );
          })}

          {/* More Filters Button */}
          <button
            onClick={onOpenFilters}
            className={`
              flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${hasActiveFilters
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }
            `}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </button>
        </div>

        {/* Team Filter Indicator */}
        {teamFilter && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-xs text-slate-400">Team:</span>
            <span className="px-2 py-1 bg-cyan-600/20 text-cyan-400 text-xs rounded-full font-medium">
              {teamFilter}
            </span>
            <button
              onClick={() => setTeamFilter(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="px-4 pb-3 flex gap-1">
          {[
            { id: 'all' as PlayerTab, label: 'All Players' },
            { id: 'roster' as PlayerTab, label: `My Team (${roster.length})` },
            { id: 'watchlist' as PlayerTab, label: `Watchlist (${watchlist.size})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingFreeAgents && activeTab === 'all' ? (
          // Loading skeletons
          <>
            {[...Array(8)].map((_, i) => (
              <MobilePlayerRowSkeleton key={i} />
            ))}
          </>
        ) : filteredPlayers.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchQuery
                ? 'No players match your search'
                : activeTab === 'watchlist'
                ? 'No players in your watchlist'
                : 'No players found'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setPositionFilter(null);
                  setTeamFilter(null);
                  onClearFilters?.();
                }}
                className="mt-4 text-cyan-400 text-sm"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          // Player list
          <>
            <p className="text-xs text-slate-500 mb-3">
              {filteredPlayers.length} players
            </p>
            {filteredPlayers.map((player) => {
              const isOnRoster = rosterIds.has(player.id);
              const isWatched = watchlist.has(player.id);

              return (
                <MobilePlayerRow
                  key={player.id}
                  player={player}
                  projection={projections[player.id]}
                  isOnRoster={isOnRoster}
                  isWatched={isWatched}
                  availability={isOnRoster ? 'owned' : 'fa'}
                  onTap={() => onPlayerTap(player)}
                  onAdd={isOnRoster ? undefined : () => onAddPlayer(player)}
                  onToggleWatch={() => onToggleWatch(player.id)}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
