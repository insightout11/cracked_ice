import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import type { TimeWindowState } from '../../types/timeWindow';
import { apiService } from '../../services/api';
import { PlayerDetailModal } from '../PlayerDetailModal';

interface PlayerComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;

  // Pre-selected players (at least one should be set)
  freeAgent?: PlayerSearchResult | null;
  rosterPlayer?: RosterPlayer | null;

  // Context data
  allFreeAgents: PlayerSearchResult[];
  trackedFreeAgentIds?: Set<string>;
  roster: RosterPlayer[];
  projections: Record<string, PlayerProjection>;
  timeWindow: TimeWindowState;
  leagueProfile: LeagueProfile;

  // Callbacks
  onSwapPlayers?: (candidateId: string, replaceId: string) => Promise<void>;
}

interface ComparisonResult {
  candidate: {
    player: any;
    teamImpact: {
      iceChange: number;
      startsChange: number;
      gamesChange: number;
    };
  };
  replaced: {
    player: any;
    currentContribution: {
      ice: number;
      starts: number;
      games: number;
    };
  };
  currentTeamMetrics: {
    totalICE: number;
    totalStarts: number;
  };
  newTeamMetrics: {
    totalICE: number;
    totalStarts: number;
  };
}

export const PlayerComparisonDrawer: React.FC<PlayerComparisonDrawerProps> = ({
  isOpen,
  onClose,
  freeAgent: initialFreeAgent,
  rosterPlayer: initialRosterPlayer,
  allFreeAgents,
  trackedFreeAgentIds = new Set(),
  roster,
  projections,
  timeWindow,
  leagueProfile,
  onSwapPlayers,
}) => {
  const [selectedFreeAgent, setSelectedFreeAgent] = useState<PlayerSearchResult | null>(initialFreeAgent || null);
  const [selectedRosterPlayer, setSelectedRosterPlayer] = useState<RosterPlayer | null>(initialRosterPlayer || null);
  const [comparisonData, setComparisonData] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllPlayers, setShowAllPlayers] = useState(true);
  const [freeAgentSearch, setFreeAgentSearch] = useState('');
  const [showFreeAgentDropdown, setShowFreeAgentDropdown] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'roster' | 'freeagent'>('roster');
  const [secondFreeAgentSearch, setSecondFreeAgentSearch] = useState('');
  const [showSecondFreeAgentDropdown, setShowSecondFreeAgentDropdown] = useState(false);
  const [selectedSecondFreeAgent, setSelectedSecondFreeAgent] = useState<PlayerSearchResult | null>(null);
  const [playerDetailModalPlayer, setPlayerDetailModalPlayer] = useState<RosterPlayer | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const secondDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFreeAgentDropdown(false);
      }
      if (secondDropdownRef.current && !secondDropdownRef.current.contains(event.target as Node)) {
        setShowSecondFreeAgentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Detect when players are loading
  useEffect(() => {
    if (isOpen && allFreeAgents.length === 0) {
      setIsLoadingPlayers(true);
    } else {
      setIsLoadingPlayers(false);
    }
  }, [isOpen, allFreeAgents.length]);

  // Sort and filter players based on estimated value and search query
  const sortedAndFilteredPlayers = React.useMemo(() => {
    let players = allFreeAgents;

    // Filter by tracked free agents if toggle is off
    if (!showAllPlayers && trackedFreeAgentIds.size > 0) {
      players = allFreeAgents.filter(p => trackedFreeAgentIds.has(p.id));
    }

    // Filter by search query (min 3 characters)
    if (freeAgentSearch.trim().length >= 3) {
      const searchLower = freeAgentSearch.toLowerCase().trim();
      players = players.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.team.toLowerCase().includes(searchLower) ||
        p.pos?.some(pos => pos.toLowerCase().includes(searchLower))
      );
    }

    // Sort by player quality (best players first)
    // Note: True team impact sorting would require calculating projections for all players,
    // which is too slow. This shows highest-quality available players first as a heuristic.
    return [...players].sort((a, b) => {
      const aScore = a.blendedFppg || a.seasonFppg || 0;
      const bScore = b.blendedFppg || b.seasonFppg || 0;
      return bScore - aScore; // Descending order (best first)
    });
  }, [allFreeAgents, showAllPlayers, trackedFreeAgentIds, freeAgentSearch]);

  // Sort and filter players for second free agent search
  const sortedAndFilteredSecondPlayers = React.useMemo(() => {
    let players = allFreeAgents;

    // Filter by tracked free agents if toggle is off
    if (!showAllPlayers && trackedFreeAgentIds.size > 0) {
      players = allFreeAgents.filter(p => trackedFreeAgentIds.has(p.id));
    }

    // Filter by search query (min 3 characters)
    if (secondFreeAgentSearch.trim().length >= 3) {
      const searchLower = secondFreeAgentSearch.toLowerCase().trim();
      players = players.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.team.toLowerCase().includes(searchLower) ||
        p.pos?.some(pos => pos.toLowerCase().includes(searchLower))
      );
    }

    // Sort by player quality (best players first)
    return [...players].sort((a, b) => {
      const aScore = a.blendedFppg || a.seasonFppg || 0;
      const bScore = b.blendedFppg || b.seasonFppg || 0;
      return bScore - aScore; // Descending order (best first)
    });
  }, [allFreeAgents, showAllPlayers, trackedFreeAgentIds, secondFreeAgentSearch]);

  // Reset selection when drawer opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setSelectedFreeAgent(initialFreeAgent || null);
      setSelectedRosterPlayer(initialRosterPlayer || null);
      setSelectedSecondFreeAgent(null);
      setComparisonData(null);
      setError(null);
      setFreeAgentSearch('');
      setSecondFreeAgentSearch('');
      setShowFreeAgentDropdown(false);
      setShowSecondFreeAgentDropdown(false);
      // Set mode based on what was initially provided
      setComparisonMode(initialRosterPlayer ? 'roster' : 'freeagent');
    }
  }, [isOpen, initialFreeAgent, initialRosterPlayer]);

  // Update search input when free agent is selected
  useEffect(() => {
    if (selectedFreeAgent) {
      setFreeAgentSearch(`${selectedFreeAgent.name} (${selectedFreeAgent.team}) - ${selectedFreeAgent.pos?.join('/')}`);
      setShowFreeAgentDropdown(false);
    }
  }, [selectedFreeAgent]);

  // Update search input when second free agent is selected
  useEffect(() => {
    if (selectedSecondFreeAgent) {
      setSecondFreeAgentSearch(`${selectedSecondFreeAgent.name} (${selectedSecondFreeAgent.team}) - ${selectedSecondFreeAgent.pos?.join('/')}`);
      setShowSecondFreeAgentDropdown(false);
    }
  }, [selectedSecondFreeAgent]);

  // Load comparison when both players are selected
  useEffect(() => {
    if (comparisonMode === 'roster' && selectedFreeAgent && selectedRosterPlayer && timeWindow?.config) {
      loadComparison();
    } else if (comparisonMode === 'freeagent' && selectedFreeAgent && selectedSecondFreeAgent) {
      // For free agent vs free agent, we don't need API call, just show stats
      setComparisonData(null);
    } else {
      setComparisonData(null);
    }
  }, [selectedFreeAgent, selectedRosterPlayer, selectedSecondFreeAgent, timeWindow, comparisonMode]);

  const loadComparison = async () => {
    if (!selectedFreeAgent || !selectedRosterPlayer || !timeWindow?.config) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.compareSwap(
        selectedFreeAgent.id,
        selectedRosterPlayer.id,
        {
          start: timeWindow.config.startUtc,
          end: timeWindow.config.endUtc,
        }
      );

      setComparisonData(result);
    } catch (err: any) {
      console.error('[PlayerComparisonDrawer] Failed to load comparison:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load comparison data. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedFreeAgent || !selectedRosterPlayer || !onSwapPlayers) return;

    try {
      await onSwapPlayers(selectedFreeAgent.id, selectedRosterPlayer.id);
      onClose();
    } catch (err) {
      console.error('Failed to swap players:', err);
      setError('Failed to make the swap. Please try again.');
    }
  };

  if (!isOpen) return null;

  const iceImpact = comparisonData?.candidate.teamImpact.iceChange ?? 0;
  const isPositiveImpact = iceImpact > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-glass backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-gradient-to-br from-surface-2 via-surface-2 to-surface-2 shadow-2xl overflow-y-auto">
        <div className="relative min-h-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-ink">Player Comparison</h2>
              <p className="text-sm text-ink-dim mt-1">
                {comparisonMode === 'roster'
                  ? 'Compare free agents with your roster to optimize team ICE'
                  : 'Compare two free agents side-by-side'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-1/10 transition-colors"
            >
              <X className="w-6 h-6 text-ink-dim" />
            </button>
          </div>

          {/* Comparison Mode Toggle */}
          <div className="mb-6 flex items-center justify-center gap-2 p-1 bg-surface-2 rounded-lg border border-line w-fit mx-auto">
            <button
              onClick={() => {
                setComparisonMode('roster');
                setSelectedSecondFreeAgent(null);
                setSecondFreeAgentSearch('');
                setComparisonData(null);
              }}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                comparisonMode === 'roster'
                  ? 'bg-accent text-ink'
                  : 'text-ink-dim hover:text-ink'
              }`}
            >
              Compare vs Roster
            </button>
            <button
              onClick={() => {
                setComparisonMode('freeagent');
                setSelectedRosterPlayer(null);
                setComparisonData(null);
              }}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                comparisonMode === 'freeagent'
                  ? 'bg-positive text-ink'
                  : 'text-ink-dim hover:text-ink'
              }`}
            >
              Compare Two Free Agents
            </button>
          </div>

          {/* Player Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Free Agent Selector */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ink-dim">
                  Free Agent (Sorted by player quality)
                </label>
                <label className="flex items-center text-xs text-ink-dim cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllPlayers}
                    onChange={(e) => setShowAllPlayers(e.target.checked)}
                    className="mr-1.5"
                  />
                  Show all players
                </label>
              </div>

              {isLoadingPlayers ? (
                <div className="w-full px-4 py-3 bg-surface-2 border border-line rounded-lg text-ink-dim flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
                  <span>Loading players...</span>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Type at least 3 letters to search..."
                    value={freeAgentSearch}
                    onChange={(e) => {
                      setFreeAgentSearch(e.target.value);
                      setShowFreeAgentDropdown(e.target.value.length >= 3);
                      if (e.target.value.length < 3) {
                        setSelectedFreeAgent(null);
                      }
                    }}
                    onFocus={() => {
                      if (freeAgentSearch.length >= 3) {
                        setShowFreeAgentDropdown(true);
                      }
                    }}
                    className="w-full px-4 py-3 bg-surface-2 border border-line rounded-lg text-ink placeholder-ink-dim focus:outline-none focus:border-accent"
                  />

                  {/* Dropdown list */}
                  {showFreeAgentDropdown && sortedAndFilteredPlayers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto bg-surface-2 border border-line rounded-lg shadow-xl">
                      {sortedAndFilteredPlayers.slice(0, 50).map(player => (
                        <button
                          key={player.id}
                          onClick={() => {
                            setSelectedFreeAgent(player);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-surface-2 transition-colors text-ink text-sm border-b border-line last:border-b-0"
                        >
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-ink-dim">
                            {player.team} • {player.pos?.join('/')} • {(player.blendedFppg || player.seasonFppg || 0).toFixed(2)} FPPG
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <p className="mt-1 text-xs text-ink-dim">
                {freeAgentSearch.length < 3 && !isLoadingPlayers
                  ? 'Type at least 3 letters to search'
                  : showFreeAgentDropdown && sortedAndFilteredPlayers.length === 0
                  ? 'No players found'
                  : `Showing top ${Math.min(50, sortedAndFilteredPlayers.length)} players sorted by estimated value`}
              </p>
            </div>

            {/* Roster Player or Second Free Agent Selector */}
            {comparisonMode === 'roster' ? (
              <div>
                <label className="block text-sm font-medium text-ink-dim mb-2">
                  Your Roster
                </label>
                <select
                  value={selectedRosterPlayer?.id || ''}
                  onChange={(e) => {
                    const player = roster.find(p => p.id === e.target.value);
                    setSelectedRosterPlayer(player || null);
                  }}
                  className="w-full px-4 py-3 bg-surface-2 border border-line rounded-lg text-ink focus:outline-none focus:border-accent"
                >
                  <option value="">Select a roster player...</option>
                  {roster.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.full_name} ({player.team}) - {player.positions?.join('/')}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="relative" ref={secondDropdownRef}>
                <label className="block text-sm font-medium text-ink-dim mb-2">
                  Second Free Agent
                </label>

                {isLoadingPlayers ? (
                  <div className="w-full px-4 py-3 bg-surface-2 border border-line rounded-lg text-ink-dim flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
                    <span>Loading players...</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Type at least 3 letters to search..."
                      value={secondFreeAgentSearch}
                      onChange={(e) => {
                        setSecondFreeAgentSearch(e.target.value);
                        setShowSecondFreeAgentDropdown(e.target.value.length >= 3);
                        if (e.target.value.length < 3) {
                          setSelectedSecondFreeAgent(null);
                        }
                      }}
                      onFocus={() => {
                        if (secondFreeAgentSearch.length >= 3) {
                          setShowSecondFreeAgentDropdown(true);
                        }
                      }}
                      className="w-full px-4 py-3 bg-surface-2 border border-line rounded-lg text-ink placeholder-ink-dim focus:outline-none focus:border-accent"
                    />

                    {/* Dropdown list */}
                    {showSecondFreeAgentDropdown && sortedAndFilteredSecondPlayers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto bg-surface-2 border border-line rounded-lg shadow-xl">
                        {sortedAndFilteredSecondPlayers
                          .filter(p => p.id !== selectedFreeAgent?.id) // Exclude first selected player
                          .slice(0, 50).map(player => (
                          <button
                            key={player.id}
                            onClick={() => {
                              setSelectedSecondFreeAgent(player);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-surface-2 transition-colors text-ink text-sm border-b border-line last:border-b-0"
                          >
                            <div className="font-medium">{player.name}</div>
                            <div className="text-xs text-ink-dim">
                              {player.team} • {player.pos?.join('/')} • {(player.blendedFppg || player.seasonFppg || 0).toFixed(2)} FPPG
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <p className="mt-1 text-xs text-ink-dim">
                  {secondFreeAgentSearch.length < 3 && !isLoadingPlayers
                    ? 'Type at least 3 letters to search'
                    : showSecondFreeAgentDropdown && sortedAndFilteredSecondPlayers.filter(p => p.id !== selectedFreeAgent?.id).length === 0
                    ? 'No players found'
                    : `Showing top ${Math.min(50, sortedAndFilteredSecondPlayers.filter(p => p.id !== selectedFreeAgent?.id).length)} players`}
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-negative-muted border border-negative rounded-lg text-negative">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full"></div>
              <span className="ml-3 text-ink-dim">Calculating projections...</span>
            </div>
          )}

          {/* Comparison Results */}
          {comparisonData && !isLoading && (
            <div className="space-y-6">
              {/* Team Impact Summary */}
              <div className={`p-6 rounded-lg border-2 ${
                isPositiveImpact
                  ? 'bg-positive-muted border-positive'
                  : 'bg-negative-muted border-negative'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isPositiveImpact ? (
                      <TrendingUp className="w-8 h-8 text-positive" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-negative" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-ink">
                        Team ICE Impact
                      </h3>
                      <p className="text-sm text-ink-dim">
                        {isPositiveImpact ? 'Positive' : 'Negative'} impact on total team performance
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      isPositiveImpact ? 'text-positive' : 'text-negative'
                    }`}>
                      {iceImpact > 0 ? '+' : ''}{iceImpact.toFixed(1)}
                    </div>
                    <div className="text-sm text-ink-dim">ICE Points</div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-line">
                  <div className="text-center">
                    <div className="text-sm text-ink-dim">Starts Change</div>
                    <div className="text-lg font-semibold text-ink mt-1">
                      {comparisonData.candidate.teamImpact.startsChange > 0 ? '+' : ''}
                      {comparisonData.candidate.teamImpact.startsChange}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-ink-dim">Games Change</div>
                    <div className="text-lg font-semibold text-ink mt-1">
                      {comparisonData.candidate.teamImpact.gamesChange > 0 ? '+' : ''}
                      {comparisonData.candidate.teamImpact.gamesChange}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-ink-dim">Total Team ICE</div>
                    <div className="text-lg font-semibold text-ink mt-1">
                      {comparisonData.newTeamMetrics.totalICE.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Stats Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free Agent Stats */}
                <div className="p-4 bg-surface-2 rounded-lg border border-line">
                  <h4 className="font-semibold text-ink mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-positive" />
                    {selectedFreeAgent?.name}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">ICE rating:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.candidate.player.iceScore?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Projected Starts:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.candidate.player.starts}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Games Available:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.candidate.player.gamesAvailable}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">FPPG:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.candidate.player.fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Roster Player Stats */}
                <div className="p-4 bg-surface-2 rounded-lg border border-line">
                  <h4 className="font-semibold text-ink mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-ink-dim" />
                    {selectedRosterPlayer?.full_name}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">ICE rating:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.replaced.player.iceScore?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Projected Starts:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.replaced.currentContribution.starts}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Games Available:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.replaced.currentContribution.games}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">FPPG:</span>
                      <span className="text-ink font-medium">
                        {comparisonData.replaced.player.fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Stats Toggle */}
              <button
                onClick={() => setShowDetailedView(!showDetailedView)}
                className="w-full py-3 px-4 bg-surface-2 hover:bg-surface-2 border border-line rounded-lg text-ink font-medium transition-colors flex items-center justify-center gap-2"
              >
                {showDetailedView ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                {showDetailedView ? 'Hide' : 'Show'} Detailed Stats Comparison
              </button>

              {/* Detailed Stats Comparison */}
              {showDetailedView && selectedFreeAgent && (comparisonMode === 'roster' ? selectedRosterPlayer : selectedSecondFreeAgent) && (
                <div className="bg-surface-2 border border-line rounded-lg p-6 space-y-6">
                  {/* Player Headers with Headshots */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Free Agent Header */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={`https://assets.nhle.com/mugs/nhl/20242025/${selectedFreeAgent.team}/${selectedFreeAgent.id.replace(/^nhl:/, '')}.png`}
                          alt={selectedFreeAgent.name}
                          className="w-16 h-16 rounded-full bg-surface-2 object-cover border-2 border-positive"
                          onError={(e) => {
                            e.currentTarget.src = '/player-placeholder.png';
                          }}
                        />
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${selectedFreeAgent.team}_light.svg`}
                          alt={selectedFreeAgent.team}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-1/10 border border-line p-0.5"
                        />
                      </div>
                      <div>
                        <h4
                          className="font-bold text-ink text-lg cursor-pointer hover:text-positive transition-colors"
                          onClick={() => {
                            if (selectedFreeAgent) {
                              setPlayerDetailModalPlayer({
                                id: selectedFreeAgent.id,
                                full_name: selectedFreeAgent.name,
                                team: selectedFreeAgent.team,
                                positions: selectedFreeAgent.pos || [],
                                games_played: selectedFreeAgent.games_played || 0,
                                stats: selectedFreeAgent.stats || {
                                  goals: 0,
                                  assists: 0,
                                  shots_on_goal: 0,
                                  power_play_points: 0,
                                  blocks: 0,
                                },
                                seasonFppg: selectedFreeAgent.seasonFppg,
                                last30Fppg: selectedFreeAgent.last30Fppg,
                                last7Fppg: selectedFreeAgent.last7Fppg,
                                blendedFppg: selectedFreeAgent.blendedFppg,
                              } as RosterPlayer);
                            }
                          }}
                        >
                          {selectedFreeAgent.name}
                        </h4>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-positive font-semibold">{selectedFreeAgent.team}</span>
                          <span className="text-ink-dim">•</span>
                          <span className="text-ink-dim">{selectedFreeAgent.pos?.join('/')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Second Player Header (Roster or Free Agent) */}
                    <div className="flex items-center gap-4">
                      {(() => {
                        const secondPlayer = comparisonMode === 'roster' ? selectedRosterPlayer : selectedSecondFreeAgent;
                        if (!secondPlayer) return null;

                        const playerName = comparisonMode === 'roster'
                          ? (secondPlayer as RosterPlayer).full_name
                          : (secondPlayer as PlayerSearchResult).name;
                        const playerTeam = secondPlayer.team;
                        const playerPos = comparisonMode === 'roster'
                          ? (secondPlayer as RosterPlayer).positions?.join('/')
                          : (secondPlayer as PlayerSearchResult).pos?.join('/');
                        const playerId = secondPlayer.id.replace(/^nhl:/, '');

                        return (
                          <>
                            <div className="relative">
                              <img
                                src={`https://assets.nhle.com/mugs/nhl/20242025/${playerTeam}/${playerId}.png`}
                                alt={playerName}
                                className={`w-16 h-16 rounded-full bg-surface-2 object-cover border-2 ${
                                  comparisonMode === 'roster' ? 'border-line' : 'border-positive'
                                }`}
                                onError={(e) => {
                                  e.currentTarget.src = '/player-placeholder.png';
                                }}
                              />
                              <img
                                src={`https://assets.nhle.com/logos/nhl/svg/${playerTeam}_light.svg`}
                                alt={playerTeam}
                                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-1/10 border border-line p-0.5"
                              />
                            </div>
                            <div>
                              <h4
                                className={`font-bold text-ink text-lg cursor-pointer transition-colors ${
                                  comparisonMode === 'roster' ? 'hover:text-accent' : 'hover:text-positive'
                                }`}
                                onClick={() => {
                                  if (comparisonMode === 'roster' && selectedRosterPlayer) {
                                    setPlayerDetailModalPlayer(selectedRosterPlayer);
                                  } else if (selectedSecondFreeAgent) {
                                    setPlayerDetailModalPlayer({
                                      id: selectedSecondFreeAgent.id,
                                      full_name: selectedSecondFreeAgent.name,
                                      team: selectedSecondFreeAgent.team,
                                      positions: selectedSecondFreeAgent.pos || [],
                                      games_played: selectedSecondFreeAgent.games_played || 0,
                                      stats: selectedSecondFreeAgent.stats || {
                                        goals: 0,
                                        assists: 0,
                                        shots_on_goal: 0,
                                        power_play_points: 0,
                                        blocks: 0,
                                      },
                                      seasonFppg: selectedSecondFreeAgent.seasonFppg,
                                      last30Fppg: selectedSecondFreeAgent.last30Fppg,
                                      last7Fppg: selectedSecondFreeAgent.last7Fppg,
                                      blendedFppg: selectedSecondFreeAgent.blendedFppg,
                                    } as RosterPlayer);
                                  }
                                }}
                              >
                                {playerName}
                              </h4>
                              <div className="flex items-center gap-2 text-sm">
                                <span className={`font-semibold ${comparisonMode === 'roster' ? 'text-accent' : 'text-positive'}`}>
                                  {playerTeam}
                                </span>
                                <span className="text-ink-dim">•</span>
                                <span className="text-ink-dim">{playerPos}</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stats Comparison Table */}
                  {(() => {
                    const secondPlayer = comparisonMode === 'roster' ? selectedRosterPlayer : selectedSecondFreeAgent;
                    if (!secondPlayer) return null;

                    const freeAgentIsGoalie = selectedFreeAgent.pos?.includes('G');
                    const secondPlayerIsGoalie = comparisonMode === 'roster'
                      ? (secondPlayer as RosterPlayer).positions?.includes('G')
                      : (secondPlayer as PlayerSearchResult).pos?.includes('G');
                    const freeAgentGP = selectedFreeAgent.games_played || 1;
                    const secondPlayerGP = secondPlayer.games_played || 1;

                    const getStat = (stat: any) => (typeof stat === 'number' ? stat : 0);

                    const secondPlayerStats = comparisonMode === 'roster'
                      ? (secondPlayer as RosterPlayer).stats
                      : (secondPlayer as PlayerSearchResult).stats;

                    if (!freeAgentIsGoalie && !secondPlayerIsGoalie) {
                      // Skater Stats
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-surface-2 border-b border-line">
                                <th className="text-left py-3 px-4 text-ink-dim font-semibold">Statistic</th>
                                <th className="text-right py-3 px-4 text-positive font-semibold">Free Agent</th>
                                <th className="text-right py-3 px-4 text-positive font-semibold">Per Game</th>
                                <th className="text-right py-3 px-4 text-accent font-semibold">Your Roster</th>
                                <th className="text-right py-3 px-4 text-accent font-semibold">Per Game</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {/* Games Played */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Games Played</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">{freeAgentGP}</td>
                                <td className="text-right py-3 px-4 text-ink-dim">—</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">{secondPlayerGP}</td>
                                <td className="text-right py-3 px-4 text-ink-dim">—</td>
                              </tr>

                              {/* Goals */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Goals</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(selectedFreeAgent.stats?.goals)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(selectedFreeAgent.stats?.goals) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(secondPlayerStats?.goals)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(secondPlayerStats?.goals) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Assists */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Assists</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(selectedFreeAgent.stats?.assists)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(selectedFreeAgent.stats?.assists) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(secondPlayerStats?.assists)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(secondPlayerStats?.assists) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Points (highlighted) */}
                              <tr className="hover:bg-surface-2 bg-accent-muted">
                                <td className="py-3 px-4 text-ink-dim font-semibold">Points</td>
                                <td className="text-right py-3 px-4 text-positive font-bold">
                                  {getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)}
                                </td>
                                <td className="text-right py-3 px-4 text-positive">
                                  {((getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className={`text-right py-3 px-4 font-bold ${comparisonMode === 'roster' ? 'text-accent' : 'text-positive'}`}>
                                  {getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)}
                                </td>
                                <td className={`text-right py-3 px-4 ${comparisonMode === 'roster' ? 'text-accent' : 'text-positive'}`}>
                                  {((getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Plus/Minus */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Plus/Minus</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat((selectedFreeAgent.stats as any)?.plus_minus) > 0 && '+'}
                                  {getStat((selectedFreeAgent.stats as any)?.plus_minus)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">—</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat((secondPlayerStats as any)?.plus_minus) > 0 && '+'}
                                  {getStat((secondPlayerStats as any)?.plus_minus)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">—</td>
                              </tr>

                              {/* Shots on Goal */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Shots on Goal</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(selectedFreeAgent.stats?.shots_on_goal)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(selectedFreeAgent.stats?.shots_on_goal) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(secondPlayerStats?.shots_on_goal)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(secondPlayerStats?.shots_on_goal) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Power Play Points */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Power Play Points</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(selectedFreeAgent.stats?.power_play_points)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(selectedFreeAgent.stats?.power_play_points) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(secondPlayerStats?.power_play_points)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(secondPlayerStats?.power_play_points) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Blocks */}
                              <tr className="hover:bg-surface-2">
                                <td className="py-3 px-4 text-ink-dim">Blocks</td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(selectedFreeAgent.stats?.blocks)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(selectedFreeAgent.stats?.blocks) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink font-semibold">
                                  {getStat(secondPlayerStats?.blocks)}
                                </td>
                                <td className="text-right py-3 px-4 text-ink-dim">
                                  {(getStat(secondPlayerStats?.blocks) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Hits */}
                              {(getStat(selectedFreeAgent.stats?.hits) > 0 || getStat(secondPlayerStats?.hits) > 0) && (
                                <tr className="hover:bg-surface-2">
                                  <td className="py-3 px-4 text-ink-dim">Hits</td>
                                  <td className="text-right py-3 px-4 text-ink font-semibold">
                                    {getStat(selectedFreeAgent.stats?.hits)}
                                  </td>
                                  <td className="text-right py-3 px-4 text-ink-dim">
                                    {(getStat(selectedFreeAgent.stats?.hits) / freeAgentGP).toFixed(2)}
                                  </td>
                                  <td className="text-right py-3 px-4 text-ink font-semibold">
                                    {getStat(secondPlayerStats?.hits)}
                                  </td>
                                  <td className="text-right py-3 px-4 text-ink-dim">
                                    {(getStat(secondPlayerStats?.hits) / secondPlayerGP).toFixed(2)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    } else {
                      // Goalie Stats
                      return (
                        <div className="text-center py-8 text-ink-dim">
                          Goalie detailed comparison coming soon
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                {onSwapPlayers && (
                  <button
                    onClick={handleSwap}
                    disabled={!isPositiveImpact}
                    className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                      isPositiveImpact
                        ? 'bg-positive hover:bg-positive text-ink'
                        : 'bg-surface-2 text-ink-dim cursor-not-allowed'
                    }`}
                  >
                    {isPositiveImpact
                      ? `Make This Swap (+${iceImpact.toFixed(1)} ICE)`
                      : 'Negative Impact - Not Recommended'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-surface-2 hover:bg-surface-2 text-ink rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Free Agent Comparison (no API data needed) */}
          {comparisonMode === 'freeagent' && !isLoading && selectedFreeAgent && selectedSecondFreeAgent && (
            <div className="space-y-6">
              {/* Key Metrics Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Free Agent Stats */}
                <div className="p-4 bg-positive-muted rounded-lg border border-positive">
                  <h4 className="font-semibold text-ink mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-positive" />
                    {selectedFreeAgent.name}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">ICE rating:</span>
                      <span className="text-ink font-medium">
                        {selectedFreeAgent.blendedFppg?.toFixed(2) ?? selectedFreeAgent.seasonFppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Season FPPG:</span>
                      <span className="text-ink font-medium">
                        {selectedFreeAgent.seasonFppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Last 30 FPPG:</span>
                      <span className="text-ink font-medium">
                        {selectedFreeAgent.last30Fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Last 7 FPPG:</span>
                      <span className="text-ink font-medium">
                        {selectedFreeAgent.last7Fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Games Played:</span>
                      <span className="text-ink font-medium">
                        {selectedFreeAgent.games_played ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Second Free Agent Stats */}
                <div className="p-4 bg-positive-muted rounded-lg border border-positive">
                  <h4 className="font-semibold text-ink mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-positive" />
                    {selectedSecondFreeAgent.name}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">ICE rating:</span>
                      <span className="text-ink font-medium">
                        {selectedSecondFreeAgent.blendedFppg?.toFixed(2) ?? selectedSecondFreeAgent.seasonFppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Season FPPG:</span>
                      <span className="text-ink font-medium">
                        {selectedSecondFreeAgent.seasonFppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Last 30 FPPG:</span>
                      <span className="text-ink font-medium">
                        {selectedSecondFreeAgent.last30Fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Last 7 FPPG:</span>
                      <span className="text-ink font-medium">
                        {selectedSecondFreeAgent.last7Fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-dim">Games Played:</span>
                      <span className="text-ink font-medium">
                        {selectedSecondFreeAgent.games_played ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Stats Comparison */}
              <div className="bg-surface-2 border border-line rounded-lg p-6 space-y-6">
                {/* Player Headers with Headshots */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Free Agent Header */}
                  <div className="flex items-center gap-4">
                    <img
                      src={`https://assets.nhle.com/mugs/nhl/20242025/${selectedFreeAgent.team}/${selectedFreeAgent.id.replace(/^nhl:/, '')}.png`}
                      alt={selectedFreeAgent.name}
                      className="w-16 h-16 rounded-full bg-surface-2 object-cover border-2 border-positive"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <h3
                        className="text-xl font-bold text-positive cursor-pointer hover:text-positive transition-colors"
                        onClick={() => {
                          setPlayerDetailModalPlayer({
                            id: selectedFreeAgent.id,
                            full_name: selectedFreeAgent.name,
                            team: selectedFreeAgent.team,
                            positions: selectedFreeAgent.pos || [],
                            games_played: selectedFreeAgent.games_played || 0,
                            stats: selectedFreeAgent.stats || {
                              goals: 0,
                              assists: 0,
                              shots_on_goal: 0,
                              power_play_points: 0,
                              blocks: 0,
                            },
                            seasonFppg: selectedFreeAgent.seasonFppg,
                            last30Fppg: selectedFreeAgent.last30Fppg,
                            last7Fppg: selectedFreeAgent.last7Fppg,
                            blendedFppg: selectedFreeAgent.blendedFppg,
                          } as RosterPlayer);
                        }}
                      >
                        {selectedFreeAgent.name}
                      </h3>
                      <p className="text-sm text-ink-dim">{selectedFreeAgent.team} • {selectedFreeAgent.pos?.join('/')}</p>
                    </div>
                  </div>

                  {/* Second Free Agent Header */}
                  <div className="flex items-center gap-4">
                    <img
                      src={`https://assets.nhle.com/mugs/nhl/20242025/${selectedSecondFreeAgent.team}/${selectedSecondFreeAgent.id.replace(/^nhl:/, '')}.png`}
                      alt={selectedSecondFreeAgent.name}
                      className="w-16 h-16 rounded-full bg-surface-2 object-cover border-2 border-positive"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <h3
                        className="text-xl font-bold text-positive cursor-pointer hover:text-positive transition-colors"
                        onClick={() => {
                          setPlayerDetailModalPlayer({
                            id: selectedSecondFreeAgent.id,
                            full_name: selectedSecondFreeAgent.name,
                            team: selectedSecondFreeAgent.team,
                            positions: selectedSecondFreeAgent.pos || [],
                            games_played: selectedSecondFreeAgent.games_played || 0,
                            stats: selectedSecondFreeAgent.stats || {
                              goals: 0,
                              assists: 0,
                              shots_on_goal: 0,
                              power_play_points: 0,
                              blocks: 0,
                            },
                            seasonFppg: selectedSecondFreeAgent.seasonFppg,
                            last30Fppg: selectedSecondFreeAgent.last30Fppg,
                            last7Fppg: selectedSecondFreeAgent.last7Fppg,
                            blendedFppg: selectedSecondFreeAgent.blendedFppg,
                          } as RosterPlayer);
                        }}
                      >
                        {selectedSecondFreeAgent.name}
                      </h3>
                      <p className="text-sm text-ink-dim">{selectedSecondFreeAgent.team} • {selectedSecondFreeAgent.pos?.join('/')}</p>
                    </div>
                  </div>
                </div>

                {/* Stats Table */}
                {(() => {
                  const secondPlayerStats = selectedSecondFreeAgent.stats;
                  const freeAgentGP = selectedFreeAgent.games_played || 1;
                  const secondPlayerGP = selectedSecondFreeAgent.games_played || 1;

                  const getStat = (val: any) => {
                    if (val === null || val === undefined) return 0;
                    return typeof val === 'number' ? val : 0;
                  };

                  // Check if either player is a goalie
                  const isFreeAgentGoalie = selectedFreeAgent.pos?.includes('G');
                  const isSecondPlayerGoalie = selectedSecondFreeAgent.pos?.includes('G');

                  if (!isFreeAgentGoalie && !isSecondPlayerGoalie) {
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-line">
                              <th className="text-left py-3 px-4 text-ink-dim font-medium">Stat</th>
                              <th className="text-right py-3 px-4 text-positive font-medium">Total</th>
                              <th className="text-right py-3 px-4 text-positive font-medium">Per Game</th>
                              <th className="text-right py-3 px-4 text-positive font-medium">Total</th>
                              <th className="text-right py-3 px-4 text-positive font-medium">Per Game</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-surface-2">
                              <td className="py-3 px-4 text-ink-dim">Games Played</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">{freeAgentGP}</td>
                              <td className="text-right py-3 px-4 text-ink-dim">—</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">{secondPlayerGP}</td>
                              <td className="text-right py-3 px-4 text-ink-dim">—</td>
                            </tr>

                            <tr className="hover:bg-surface-2">
                              <td className="py-3 px-4 text-ink-dim">Goals</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(selectedFreeAgent.stats?.goals)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(selectedFreeAgent.stats?.goals) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(secondPlayerStats?.goals)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(secondPlayerStats?.goals) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-surface-2">
                              <td className="py-3 px-4 text-ink-dim">Assists</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(selectedFreeAgent.stats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(selectedFreeAgent.stats?.assists) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(secondPlayerStats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(secondPlayerStats?.assists) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-surface-2 bg-accent-muted">
                              <td className="py-3 px-4 text-ink-dim font-semibold">Points</td>
                              <td className="text-right py-3 px-4 text-positive font-bold">
                                {getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-positive">
                                {((getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-positive font-bold">
                                {getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-positive">
                                {((getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-surface-2">
                              <td className="py-3 px-4 text-ink-dim">Shots on Goal</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(selectedFreeAgent.stats?.shots_on_goal)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(selectedFreeAgent.stats?.shots_on_goal) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(secondPlayerStats?.shots_on_goal)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(secondPlayerStats?.shots_on_goal) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-surface-2">
                              <td className="py-3 px-4 text-ink-dim">Power Play Points</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(selectedFreeAgent.stats?.power_play_points)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(selectedFreeAgent.stats?.power_play_points) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(secondPlayerStats?.power_play_points)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(secondPlayerStats?.power_play_points) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-surface-2">
                              <td className="py-3 px-4 text-ink-dim">Blocks</td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(selectedFreeAgent.stats?.blocks)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(selectedFreeAgent.stats?.blocks) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink font-semibold">
                                {getStat(secondPlayerStats?.blocks)}
                              </td>
                              <td className="text-right py-3 px-4 text-ink-dim">
                                {(getStat(secondPlayerStats?.blocks) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-center py-8 text-ink-dim">
                        Goalie detailed comparison coming soon
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!comparisonData && !isLoading && comparisonMode === 'roster' && selectedFreeAgent && selectedRosterPlayer && (
            <div className="flex flex-col items-center justify-center py-12 text-ink-dim">
              <Calendar className="w-16 h-16 mb-4 opacity-50" />
              <p>Select both players to see the comparison</p>
            </div>
          )}
        </div>

        {/* Player Detail Modal */}
        {playerDetailModalPlayer && (
          <PlayerDetailModal
            isOpen={true}
            player={playerDetailModalPlayer}
            projection={projections?.[playerDetailModalPlayer.id]}
            timeWindow={timeWindow}
            leagueProfile={leagueProfile}
            onClose={() => setPlayerDetailModalPlayer(null)}
          />
        )}
      </div>
    </div>
  );
};
