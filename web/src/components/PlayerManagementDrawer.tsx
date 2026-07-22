// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { PlayerSearchResult, AvailabilityStatus } from '../types';
import { apiService } from '../services/api';
import { useLeaguePool } from '../hooks/useLeaguePool';
import { PlayerRow } from './players/PlayerRow';
import { BulkImportPanel } from './players/BulkImportPanel';
import { PlayerDetailModal } from './PlayerDetailModal';
import { PlayerComparisonDrawer } from './comparison/PlayerComparisonDrawer';
import { X, CheckCircle2 } from 'lucide-react';

interface PlayerManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterPlayer[];
  projections?: Record<string, PlayerProjection>;
  leagueProfile: LeagueProfile | null;
  timeWindowConfig?: { startUtc: string; endUtc: string } | null;
  timeWindow?: any;
  onAddPlayer: (player: PlayerSearchResult) => void;
  onRosterChanged?: () => void | Promise<void>;
  initialPositionFilter?: string;  // e.g., 'C', 'D', 'ALL'
  initialTeamFilter?: string;      // e.g., 'TBL', 'TOR', 'ALL'
}

type TabType = 'all-players' | 'my-free-agents' | 'watchlist' | 'coach';
type SortOption = 'default' | 'ice-desc' | 'season-fppg-desc' | 'last30-fppg-desc' | 'last7-fppg-desc' | 'role-increased' | 'role-decreased';

// NHL Teams for filter
const NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WPG', 'WSH', 'UTA'
];

export const PlayerManagementDrawer: React.FC<PlayerManagementDrawerProps> = ({
  isOpen,
  onClose,
  roster,
  projections,
  leagueProfile,
  timeWindow,
  onAddPlayer,
  onRosterChanged,
  initialPositionFilter,
  initialTeamFilter,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all-players');
  const [allPlayers, setAllPlayers] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>(initialPositionFilter ?? 'ALL');
  const [teamFilter, setTeamFilter] = useState<string>(initialTeamFilter ?? 'ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('ice-desc');

  // Toast state for feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Selected player for detail modal
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);

  // Comparison drawer state
  const [comparisonDrawer, setComparisonDrawer] = useState<{
    isOpen: boolean;
    freeAgent: PlayerSearchResult | null;
  }>({ isOpen: false, freeAgent: null });

  // League pool hook
  const leagueId = leagueProfile?.league_name || 'default';
  const leaguePool = useLeaguePool(leagueId);

  // Debounce search (250ms)
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset filters when drawer opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setPositionFilter(initialPositionFilter ?? 'ALL');
      setTeamFilter(initialTeamFilter ?? 'ALL');
    }
  }, [isOpen, initialPositionFilter, initialTeamFilter]);

  // Load all players when drawer opens
  useEffect(() => {
    if (isOpen) {
      loadAllPlayers();
    }
  }, [isOpen]);

  const loadAllPlayers = async () => {
    setLoading(true);
    try {
      const response = await apiService.getAllPlayers();
      // API returns { players: [...] } not { results: [...] }
      const players = (response as any).players || response.results || [];
      setAllPlayers(players);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get roster player IDs for exclusion
  const rosterPlayerIds = useMemo(() => {
    return new Set(roster.map(p => p.id));
  }, [roster]);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = allPlayers.filter(p => !rosterPlayerIds.has(p.id));

    // Search filter (using debounced query)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const name = (p.name || '').toLowerCase();
        const team = p.team.toLowerCase();
        const positions = Array.isArray(p.pos) ? p.pos.join(' ').toLowerCase() : '';
        return name.includes(query) || team.includes(query) || positions.includes(query);
      });
    }

    // Position filter
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(p => {
        const positions = Array.isArray(p.pos) ? p.pos : [];
        if (positionFilter === 'SKATERS') {
          // Include all forwards and defensemen, exclude goalies
          return positions.some(pos => ['C', 'LW', 'RW', 'D'].includes(pos));
        }
        return positions.includes(positionFilter);
      });
    }

    // Team filter
    if (teamFilter !== 'ALL') {
      filtered = filtered.filter(p => p.team === teamFilter);
    }

    // Availability filter
    if (availabilityFilter !== 'ALL') {
      filtered = filtered.filter(p => {
        const status = leaguePool.getAvailability(p.id);
        return status === availabilityFilter;
      });
    }

    // Tab-specific filters
    if (activeTab === 'my-free-agents') {
      filtered = filtered.filter(p => {
        const status = leaguePool.getAvailability(p.id);
        return status === 'FA' || status === 'WAIVER';
      });
    } else if (activeTab === 'watchlist') {
      filtered = filtered.filter(p => leaguePool.isWatched(p.id));
    }

    // Sorting
    if (sortOption === 'ice-desc') {
      filtered.sort((a, b) => {
        const calculateIceScore = (player: PlayerSearchResult) => {
          // Return undefined if FPPG values are undefined (league not configured)
          if (player.seasonFppg === undefined) return undefined;
          const seasonFppg = player.seasonFppg ?? 0;
          const last30Fppg = player.last30Fppg ?? 0;
          const last7Fppg = player.last7Fppg ?? 0;
          return (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);
        };
        const iceA = calculateIceScore(a);
        const iceB = calculateIceScore(b);
        // Sort undefined values to end
        if (iceA === undefined && iceB === undefined) return 0;
        if (iceA === undefined) return 1;
        if (iceB === undefined) return -1;
        return iceB - iceA;
      });
    } else if (sortOption === 'season-fppg-desc') {
      filtered.sort((a, b) => {
        const fppgA = a.seasonFppg;
        const fppgB = b.seasonFppg;
        // Sort undefined values to end
        if (fppgA === undefined && fppgB === undefined) return 0;
        if (fppgA === undefined) return 1;
        if (fppgB === undefined) return -1;
        return fppgB - fppgA;
      });
    } else if (sortOption === 'last30-fppg-desc') {
      filtered.sort((a, b) => {
        const fppgA = a.last30Fppg;
        const fppgB = b.last30Fppg;
        // Sort undefined values to end
        if (fppgA === undefined && fppgB === undefined) return 0;
        if (fppgA === undefined) return 1;
        if (fppgB === undefined) return -1;
        return fppgB - fppgA;
      });
    } else if (sortOption === 'last7-fppg-desc') {
      filtered.sort((a, b) => {
        const fppgA = a.last7Fppg;
        const fppgB = b.last7Fppg;
        // Sort undefined values to end
        if (fppgA === undefined && fppgB === undefined) return 0;
        if (fppgA === undefined) return 1;
        if (fppgB === undefined) return -1;
        return fppgB - fppgA;
      });
    } else if (sortOption === 'role-increased') {
      filtered.sort((a, b) => {
        const changeA = a.roleTrend?.toiChange ?? 0;
        const changeB = b.roleTrend?.toiChange ?? 0;
        return changeB - changeA; // Descending (highest increase first)
      });
    } else if (sortOption === 'role-decreased') {
      filtered.sort((a, b) => {
        const changeA = a.roleTrend?.toiChange ?? 0;
        const changeB = b.roleTrend?.toiChange ?? 0;
        return changeA - changeB; // Ascending (highest decrease first)
      });
    }

    return filtered;
  }, [
    allPlayers,
    rosterPlayerIds,
    debouncedSearchQuery,
    positionFilter,
    teamFilter,
    availabilityFilter,
    activeTab,
    sortOption,
    projections,
    leaguePool,
  ]);

  // Show toast
  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Handle player add
  const handleAddPlayer = useCallback((player: PlayerSearchResult) => {
    const status = leaguePool.getAvailability(player.id);

    onAddPlayer(player);

    // Show toast if availability is UNKNOWN
    if (status === 'UNKNOWN') {
      showToast(
        `Added ${player.name}. Availability is Unknown - mark as FA if accurate.`,
        'info'
      );
    }
  }, [onAddPlayer, leaguePool, showToast]);

  // Handle availability change
  const handleAvailabilityChange = useCallback((playerId: string, status: AvailabilityStatus) => {
    leaguePool.setAvailability(playerId, status, 'manual', 1.0);
  }, [leaguePool]);

  // Handle watchlist toggle
  const handleToggleWatch = useCallback((playerId: string) => {
    leaguePool.toggleWatch(playerId);
  }, [leaguePool]);

  // Handle player click to show detail modal
  const handlePlayerClick = useCallback((player: PlayerSearchResult) => {
    setSelectedPlayer(player);
  }, []);

  // Handle opening comparison drawer for a free agent
  const handleOpenComparison = useCallback((freeAgent: PlayerSearchResult) => {
    setComparisonDrawer({
      isOpen: true,
      freeAgent,
    });
  }, []);

  // Handle bulk import (mark as FA in pool)
  const handleBulkImportFA = useCallback((playerIds: string[]) => {
    leaguePool.setAvailabilityBulk(playerIds, 'FA', 'bulk_paste', 0.9);
    showToast(`Imported ${playerIds.length} players as Free Agents`, 'success');
  }, [leaguePool, showToast]);

  // Handle bulk add to roster (fills eligible active slots before bench overflow)
  const handleBulkAddToRoster = useCallback(async (playerIds: string[]) => {
    try {
      const result = await apiService.addPlayersToRosterBulk(playerIds, 'AUTO');

      if (result.added > 0) {
        showToast(`Added ${result.added} player${result.added !== 1 ? 's' : ''} to roster`, 'success');
      }
      if (result.skipped > 0) {
        showToast(`Skipped ${result.skipped} duplicate player${result.skipped !== 1 ? 's' : ''}`, 'info');
      }
      if (result.notFound > 0) {
        showToast(`${result.notFound} player${result.notFound !== 1 ? 's' : ''} not found`, 'info');
      }

      if (result.added > 0) {
        await onRosterChanged?.();
      }
    } catch (error) {
      console.error('Bulk add failed:', error);
      showToast('Failed to add players to roster', 'info');
    }
  }, [onRosterChanged, showToast]);

  // Bulk actions for My Free Agents tab
  const handleBulkMarkOwned = useCallback(() => {
    const faPlayers = leaguePool.selectBy({ status: ['FA', 'WAIVER'] });
    faPlayers.forEach(id => leaguePool.setAvailability(id, 'OWNED_OTHER', 'manual', 1.0));
    showToast(`Marked ${faPlayers.length} players as Owned by Other`, 'success');
  }, [leaguePool, showToast]);

  // Bulk actions for Watchlist tab
  const handleBulkMoveToFA = useCallback(() => {
    const watchedPlayers = leaguePool.watchlist;
    watchedPlayers.forEach(id => leaguePool.setAvailability(id, 'FA', 'manual', 1.0));
    showToast(`Marked ${watchedPlayers.length} watchlist players as Free Agents`, 'success');
  }, [leaguePool, showToast]);

  const handleClearWatchlist = useCallback(() => {
    const count = leaguePool.watchlist.length;
    leaguePool.clearWatchlist();
    showToast(`Cleared ${count} players from watchlist`, 'success');
  }, [leaguePool, showToast]);

  // Handle OCR upload (for free agents list)
  const handleOcrUploadFreeAgents = useCallback(async (file: File): Promise<string[]> => {
    try {
      const result = await apiService.uploadFreeAgentsImage(file);
      return result.playerNames;
    } catch (error) {
      console.error('OCR upload failed:', error);
      throw new Error('Failed to process screenshot. Please check if OCR is configured.');
    }
  }, []);

  // Handle OCR upload for roster
  const handleOcrUploadRoster = useCallback(async (file: File): Promise<string[]> => {
    try {
      const result = await apiService.uploadRosterImage(file);
      // Extract player names from roster
      const playerNames = result.roster.map((p: any) => p.full_name || p.name);
      // Also add any unmatched players
      if (result.unmatchedPlayers) {
        result.unmatchedPlayers.forEach((p: any) => playerNames.push(p.name));
      }
      return playerNames;
    } catch (error) {
      console.error('Roster OCR upload failed:', error);
      throw new Error('Failed to process roster screenshot. Please check if OCR is configured.');
    }
  }, []);

  if (!isOpen) return null;

  const faCount = leaguePool.selectBy({ status: ['FA', 'WAIVER'] }).length;
  const watchCount = leaguePool.watchlist.length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-glass backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-0)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-xl font-bold text-[var(--ink)]">Player Management</h2>
          <button
            onClick={onClose}
            className="text-ink-dim hover:text-ink transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line bg-surface-1/5">
          <button
            onClick={() => setActiveTab('all-players')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'all-players'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-dim hover:text-ink'
            }`}
          >
            All Players
          </button>
          <button
            onClick={() => setActiveTab('my-free-agents')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'my-free-agents'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-dim hover:text-ink'
            }`}
          >
            My Free Agents {faCount > 0 && `(${faCount})`}
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'watchlist'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-dim hover:text-ink'
            }`}
          >
 Watchlist {watchCount > 0 && `(${watchCount})`}
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'coach'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-dim hover:text-ink'
            }`}
          >
 Coach
          </button>
        </div>

        {/* Filters (Shared) - Hide on Coach tab */}
        {activeTab !== 'coach' && (
        <div className="p-4 space-y-3 border-b border-line bg-surface-1/5">
          {/* Search */}
          <input
            type="text"
            placeholder="Search players by name, team, or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-surface-1/10 border border-line rounded-lg text-ink placeholder-ink-dim focus:outline-none focus:border-accent"
            aria-label="Search players"
          />

          {/* Filter Row */}
          <div className="grid grid-cols-4 gap-2">
            {/* Position Filter */}
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-3 py-2 bg-surface-1/10 border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
              aria-label="Filter by position"
            >
              <option value="ALL">All Positions</option>
              <option value="SKATERS">Skaters (F/D)</option>
              <option value="C">C</option>
              <option value="LW">LW</option>
              <option value="RW">RW</option>
              <option value="D">D</option>
              <option value="G">G</option>
            </select>

            {/* Team Filter */}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 bg-surface-1/10 border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
              aria-label="Filter by team"
            >
              <option value="ALL">All Teams</option>
              {NHL_TEAMS.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>

            {/* Availability Filter (only on All Players tab) */}
            {activeTab === 'all-players' && (
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="px-3 py-2 bg-surface-1/10 border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
                aria-label="Filter by availability"
              >
                <option value="ALL">All Availability</option>
                <option value="FA">Free Agent</option>
                <option value="WAIVER">Waiver</option>
                <option value="OWNED_OTHER">Owned by Other</option>
                <option value="UNKNOWN">Unknown</option>
                <option value="OWNED_ME">Owned by Me</option>
              </select>
            )}

            {/* Sort Options */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="px-3 py-2 bg-surface-1/10 border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
              aria-label="Sort players"
            >
              <option value="default">Default</option>
              <option value="ice-desc">ICE Score ↓</option>
              <option value="season-fppg-desc">Season FPPG ↓</option>
              <option value="last30-fppg-desc">Last 30 Days ↓</option>
              <option value="last7-fppg-desc">Last 7 Days ↓</option>
              <option value="role-increased">Role Increased ↑</option>
              <option value="role-decreased">Role Decreased ↓</option>
            </select>
          </div>

          {/* Bulk Import Panel (All Players and My Free Agents tabs) */}
          {(activeTab === 'all-players' || activeTab === 'my-free-agents') && (
            <BulkImportPanel
              allPlayers={allPlayers}
              onImport={activeTab === 'all-players' ? handleBulkAddToRoster : handleBulkImportFA}
              onOcrUpload={activeTab === 'all-players' ? handleOcrUploadRoster : handleOcrUploadFreeAgents}
              mode={activeTab === 'all-players' ? 'roster' : 'free-agents'}
              existingPlayerIds={activeTab === 'all-players' ? roster.map((player) => player.id) : []}
            />
          )}

          {/* Bulk Actions (My Free Agents tab) */}
          {activeTab === 'my-free-agents' && faCount > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleBulkMarkOwned}
                className="px-3 py-1.5 text-xs font-medium bg-negative-muted text-negative rounded hover:bg-negative-muted transition-colors"
              >
                Mark All as Owned
              </button>
            </div>
          )}

          {/* Bulk Actions (Watchlist tab) */}
          {activeTab === 'watchlist' && watchCount > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleBulkMoveToFA}
                className="px-3 py-1.5 text-xs font-medium bg-positive-muted text-positive rounded hover:bg-positive-muted transition-colors"
              >
                Mark All as FA
              </button>
              <button
                onClick={handleClearWatchlist}
                className="px-3 py-1.5 text-xs font-medium bg-negative-muted text-negative rounded hover:bg-negative-muted transition-colors"
              >
                Clear Watchlist
              </button>
            </div>
          )}
        </div>
        )}

        {/* Player List - Hide on Coach tab */}
        {activeTab !== 'coach' && (
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-ink-dim">Loading players...</div>
          ) : filteredAndSortedPlayers.length === 0 ? (
            <div className="text-center py-8 text-ink-dim">
              {activeTab === 'my-free-agents' && faCount === 0
                ? 'No Free Agents marked yet. Use the Bulk Import or mark players as FA from All Players tab.'
                : activeTab === 'watchlist' && watchCount === 0
 ? 'No players in watchlist yet. Use the button to add players.'
                : 'No players found matching your filters.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredAndSortedPlayers.map(player => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  projection={projections?.[player.id]}
                  availabilityStatus={leaguePool.getAvailability(player.id)}
                  availabilityMark={leaguePool.getAvailabilityMark(player.id)}
                  isWatched={leaguePool.isWatched(player.id)}
                  onAddToPlanner={handleAddPlayer}
                  onAvailabilityChange={(status) => handleAvailabilityChange(player.id, status)}
                  onToggleWatch={() => handleToggleWatch(player.id)}
                  onPlayerClick={handlePlayerClick}
                  onCompareWithRoster={handleOpenComparison}
                  roster={roster}
                  showAddButton={true}
                />
              ))}
            </div>
          )}
        </div>
        )}

        {/* Coach Tab Content */}
        {activeTab === 'coach' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="coach-placeholder flex items-center justify-center min-h-[400px]">
              <div className="empty-state-card max-w-[500px] text-center bg-gradient-to-b from-accent to-transparent border border-accent rounded-2xl p-12">
                <div
                  className='icon-large text-6xl mb-4 [filter:drop-shadow(0_0_20px_var(--accent-muted))]'>

                </div>
                <h3 className="text-xl font-semibold text-ink mb-3">
                  Coach Features Coming Soon
                </h3>
                <p className="text-ink-dim mb-6">
                  Your personal fantasy hockey coach will analyze your roster and suggest optimal swaps
                </p>

                {/* Preview of future features */}
                <div className="feature-preview-list flex flex-col gap-3 mt-8 text-left">
                  <div className="feature-item flex items-center gap-3 p-3 bg-surface-2 border border-accent rounded-lg text-ink-dim text-sm">
 <CheckCircle2 className="feature-icon text-accent flex-shrink-0" size={18} />
                    <span>Recommended add/drop suggestions</span>
                  </div>
                  <div className="feature-item flex items-center gap-3 p-3 bg-surface-2 border border-accent rounded-lg text-ink-dim text-sm">
 <CheckCircle2 className="feature-icon text-accent flex-shrink-0" size={18} />
                    <span>Roster strength analysis</span>
                  </div>
                  <div className="feature-item flex items-center gap-3 p-3 bg-surface-2 border border-accent rounded-lg text-ink-dim text-sm">
 <CheckCircle2 className="feature-icon text-accent flex-shrink-0" size={18} />
                    <span>Position-specific recommendations</span>
                  </div>
                  <div className="feature-item flex items-center gap-3 p-3 bg-surface-2 border border-accent rounded-lg text-ink-dim text-sm">
 <CheckCircle2 className="feature-icon text-accent flex-shrink-0" size={18} />
                    <span>Coach personality modes (Analytical, Motivational, Torts)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg border ${
              toast.type === 'success'
                ? 'bg-positive-muted border-positive text-positive'
                : 'bg-accent-muted border-accent text-accent'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Player Detail Modal */}
        {selectedPlayer && leagueProfile && timeWindow && (
          <PlayerDetailModal
            isOpen={true}
            player={{
              id: selectedPlayer.id,
              full_name: selectedPlayer.name,
              team: selectedPlayer.team,
              positions: Array.isArray(selectedPlayer.pos) ? selectedPlayer.pos : [],
              games_played: selectedPlayer.games_played ?? 0,
              stats: selectedPlayer.stats ?? {
                goals: 0,
                assists: 0,
                shots_on_goal: 0,
                power_play_points: 0,
                blocks: 0,
              },
              seasonFppg: selectedPlayer.seasonFppg,
              last30Fppg: selectedPlayer.last30Fppg,
              last7Fppg: selectedPlayer.last7Fppg,
              blendedFppg: selectedPlayer.blendedFppg ?? undefined,
              careerHistory: selectedPlayer.careerHistory,
              careerSummary: selectedPlayer.careerSummary,
              bio: selectedPlayer.bio,
              gameLog: selectedPlayer.gameLog,
              advancedStats: selectedPlayer.advancedStats,
              last7AdvancedStats: selectedPlayer.last7AdvancedStats,
              roleTrend: selectedPlayer.roleTrend,
            }}
            projection={projections?.[selectedPlayer.id]}
            timeWindow={timeWindow}
            leagueProfile={leagueProfile}
            onClose={() => setSelectedPlayer(null)}
          />
        )}

        {/* Player Comparison Drawer */}
        {(() => {
          const shouldRender = leagueProfile && timeWindow?.config;
          return shouldRender;
        })() && (
          <PlayerComparisonDrawer
            isOpen={comparisonDrawer.isOpen}
            onClose={() => setComparisonDrawer({ isOpen: false, freeAgent: null })}
            freeAgent={comparisonDrawer.freeAgent}
            allFreeAgents={allPlayers}
            roster={roster}
            projections={projections || {}}
            timeWindow={timeWindow}
            leagueProfile={leagueProfile}
            onSwapPlayers={async (candidateId, replaceId) => {
              // Add the free agent
              const candidate = allPlayers.find(p => p.id === candidateId);
              if (candidate) {
                await handleAddPlayer(candidate);
              }
              // Note: Removing the replaced player would need to be handled by parent
              showToast('Swap completed!', 'success');
            }}
          />
        )}
      </div>
    </div>
  );
};
