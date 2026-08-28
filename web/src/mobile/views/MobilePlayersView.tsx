import { useState, useMemo, useCallback, useDeferredValue, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { MobilePlayerRow, MobilePlayerRowSkeleton } from '../components/MobilePlayerRow';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import type { PlayerFilters } from '../sheets/MobileFilterSheet';
import { getPlayerProjection } from '../../lib/playerProjection';

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

  // Filters from filter sheet
  sheetFilters?: PlayerFilters;

  // Callbacks
  onPlayerTap: (player: RosterPlayer) => void;
  onAddPlayer: (player: RosterPlayer) => void;
  onToggleWatch: (playerId: string) => void;
  confirmedCandidateIds?: Set<string>;
  onConfirmAvailable?: (playerId: string) => void;
  onOpenFilters?: () => void;
  onClearFilters?: () => void;
  targetSlotLabel?: string;
  onCancelTargetSlot?: () => void;
}

type PlayerTab = 'all' | 'roster' | 'watchlist';

const POSITIONS = ['All', 'Skaters', 'C', 'LW', 'RW', 'D', 'G'];

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
  sheetFilters,
  onPlayerTap,
  onAddPlayer,
  onToggleWatch,
  confirmedCandidateIds = new Set(),
  onConfirmAvailable,
  onOpenFilters,
  onClearFilters,
  targetSlotLabel,
  onCancelTargetSlot,
}: MobilePlayersViewProps) {
  // State
  const [activeTab, setActiveTab] = useState<PlayerTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const deferredSearchQuery = useDeferredValue(searchQuery);

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
    let players = [...tabPlayers];

    // Search filter
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      players = players.filter(p => {
        const name = p.full_name || (p as any).name || '';
        const team = p.team || '';
        return name.toLowerCase().includes(query) || team.toLowerCase().includes(query);
      });
    }

    // Position filter - combine local chips + sheet filters
    const activePositions = sheetFilters?.positions?.length
      ? sheetFilters.positions
      : positionFilter && positionFilter !== 'All'
        ? [positionFilter]
        : [];

    if (activePositions.length > 0) {
      players = players.filter(p => {
        const positions = p.positions || [(p as any).position].filter(Boolean);
        return activePositions.some((pos) => pos === 'Skaters' ? !positions.includes('G') : positions.includes(pos));
      });
    }

    // Team filter - combine local + sheet filters
    const activeTeams = sheetFilters?.teams?.length
      ? sheetFilters.teams
      : teamFilter
        ? [teamFilter]
        : [];

    if (activeTeams.length > 0) {
      players = players.filter(p => activeTeams.includes(p.team));
    }

    // Availability filter from sheet
    if (sheetFilters?.availability?.length) {
      players = players.filter(p => {
        const isOwned = rosterIds.has(p.id);
        const isFa = confirmedCandidateIds.has(p.id.replace(/^nhl:/, ''));
        // Note: waivers would need additional data
        return (
          (sheetFilters.availability.includes('owned') && isOwned) ||
          (sheetFilters.availability.includes('fa') && isFa)
        );
      });
    }

    // Sort - use sheet filter sort or default to ICE
    // Matches desktop PlayerManagementDrawer.tsx sorting logic exactly
    const sortBy = sheetFilters?.sortBy || 'ice';
    const sortOrder = sheetFilters?.sortOrder || 'desc';

    players.sort((a, b) => {
      let aVal: number | string | undefined = 0;
      let bVal: number | string | undefined = 0;

      switch (sortBy) {
        case 'ice':
          aVal = getPlayerProjection(projections, a.id)?.iceScore;
          bVal = getPlayerProjection(projections, b.id)?.iceScore;
          // Sort undefined values to end (matches desktop)
          if (aVal === undefined && bVal === undefined) return 0;
          if (aVal === undefined) return 1;
          if (bVal === undefined) return -1;
          break;
        case 'fppg':
          aVal = a.seasonFppg;
          bVal = b.seasonFppg;
          // Sort undefined values to end (matches desktop)
          if (aVal === undefined && bVal === undefined) return 0;
          if (aVal === undefined) return 1;
          if (bVal === undefined) return -1;
          break;
        case 'goals':
          aVal = a.stats?.goals ?? 0;
          bVal = b.stats?.goals ?? 0;
          break;
        case 'assists':
          aVal = a.stats?.assists ?? 0;
          bVal = b.stats?.assists ?? 0;
          break;
        case 'points':
          aVal = (a.stats?.goals ?? 0) + (a.stats?.assists ?? 0);
          bVal = (b.stats?.goals ?? 0) + (b.stats?.assists ?? 0);
          break;
        case 'name':
          aVal = a.full_name || (a as any).name || '';
          bVal = b.full_name || (b as any).name || '';
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return players;
  }, [tabPlayers, deferredSearchQuery, positionFilter, teamFilter, sheetFilters, projections, rosterIds, confirmedCandidateIds]);

  useEffect(() => {
    setVisibleCount(50);
  }, [activeTab, deferredSearchQuery, positionFilter, teamFilter, sheetFilters]);

  const visiblePlayers = useMemo(
    () => filteredPlayers.slice(0, visibleCount),
    [filteredPlayers, visibleCount],
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Check if filters are active (position "All" is not a filter)
  const hasActiveFilters =
    (positionFilter !== null && positionFilter !== 'All') ||
    teamFilter !== null ||
    (sheetFilters?.positions?.length ?? 0) > 0 ||
    (sheetFilters?.teams?.length ?? 0) > 0 ||
    (sheetFilters?.availability?.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-line bg-surface-1/95 backdrop-blur-md">
        {targetSlotLabel && (
          <div className="flex items-center justify-between border-b border-line bg-accent-muted px-4 py-2">
            <p className="text-sm font-medium text-accent">Choose a player for {targetSlotLabel}</p>
            <button type="button" onClick={onCancelTargetSlot} className="text-xs font-medium text-ink-dim">
              Cancel
            </button>
          </div>
        )}
        {/* Search Bar */}
        <div className="px-4 pt-4 pb-3">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Player pool</p>
            <h2 className="mt-0.5 text-lg font-bold text-ink">Find the right roster fit</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or team"
              className="w-full pl-10 pr-10 py-3 bg-surface-0 border border-line rounded-xl text-ink placeholder-ink-dim focus:outline-none focus:border-accent transition-colors"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-2 rounded-full"
              >
                <X className="w-4 h-4 text-ink-dim" />
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
                    ? 'bg-accent text-ink'
                    : 'bg-surface-2 text-ink-dim hover:bg-surface-2'
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
                ? 'bg-accent-muted text-accent border border-accent'
                : 'bg-surface-2 text-ink-dim hover:bg-surface-2'
              }
            `}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-accent" />
            )}
          </button>
        </div>

        {/* Team Filter Indicator */}
        {teamFilter && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-xs text-ink-dim">Team:</span>
            <span className="px-2 py-1 bg-accent-muted text-accent text-xs rounded-full font-medium">
              {teamFilter}
            </span>
            <button
              onClick={() => setTeamFilter(null)}
              className="text-ink-dim hover:text-ink"
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
                  ? 'bg-surface-2 text-ink'
                  : 'text-ink-dim hover:text-ink'
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
            <Search className="w-12 h-12 text-ink-dim mx-auto mb-4" />
            <p className="text-ink-dim">
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
                className="mt-4 text-accent text-sm"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          // Player list
          <>
            <p className="text-xs text-ink-dim mb-3">
              {filteredPlayers.length} players
            </p>
            {visiblePlayers.map((player) => {
              const isOnRoster = rosterIds.has(player.id);
              const isWatched = watchlist.has(player.id);
              const isConfirmedAvailable = confirmedCandidateIds.has(player.id.replace(/^nhl:/, ''));

              return (
                <MobilePlayerRow
                  key={player.id}
                  player={player}
                  projection={getPlayerProjection(projections, player.id)}
                  isOnRoster={isOnRoster}
                  isWatched={isWatched}
                  availability={isOnRoster ? 'owned' : isConfirmedAvailable ? 'fa' : 'unknown'}
                  onTap={() => onPlayerTap(player)}
                  onAdd={isOnRoster ? undefined : () => onAddPlayer(player)}
                  onToggleWatch={() => onToggleWatch(player.id)}
                  onConfirmAvailable={isOnRoster || isConfirmedAvailable ? undefined : () => onConfirmAvailable?.(player.id)}
                />
              );
            })}
            {visibleCount < filteredPlayers.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 50)}
                className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface-2 text-sm font-semibold text-accent"
              >
                Show 50 more · {filteredPlayers.length - visibleCount} remaining
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
