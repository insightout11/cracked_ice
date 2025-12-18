import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../../lib/coachSchemas';
import type { PlayerSearchResult } from '../../types';
import type { TimeWindowState } from '../../types/timeWindow';
import { apiService } from '../../services/api';

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl overflow-y-auto">
        <div className="relative min-h-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Player Comparison</h2>
              <p className="text-sm text-slate-400 mt-1">
                {comparisonMode === 'roster'
                  ? 'Compare free agents with your roster to optimize team ICE'
                  : 'Compare two free agents side-by-side'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Comparison Mode Toggle */}
          <div className="mb-6 flex items-center justify-center gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700 w-fit mx-auto">
            <button
              onClick={() => {
                setComparisonMode('roster');
                setSelectedSecondFreeAgent(null);
                setSecondFreeAgentSearch('');
                setComparisonData(null);
              }}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                comparisonMode === 'roster'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
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
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
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
                <label className="block text-sm font-medium text-slate-300">
                  Free Agent (Sorted by player quality)
                </label>
                <label className="flex items-center text-xs text-slate-400 cursor-pointer">
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
                <div className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
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
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />

                  {/* Dropdown list */}
                  {showFreeAgentDropdown && sortedAndFilteredPlayers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                      {sortedAndFilteredPlayers.slice(0, 50).map(player => (
                        <button
                          key={player.id}
                          onClick={() => {
                            setSelectedFreeAgent(player);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-slate-700 transition-colors text-white text-sm border-b border-slate-700/50 last:border-b-0"
                        >
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-slate-400">
                            {player.team} • {player.pos?.join('/')} • {(player.blendedFppg || player.seasonFppg || 0).toFixed(2)} FPPG
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <p className="mt-1 text-xs text-slate-400">
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Roster
                </label>
                <select
                  value={selectedRosterPlayer?.id || ''}
                  onChange={(e) => {
                    const player = roster.find(p => p.id === e.target.value);
                    setSelectedRosterPlayer(player || null);
                  }}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Second Free Agent
                </label>

                {isLoadingPlayers ? (
                  <div className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
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
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                    />

                    {/* Dropdown list */}
                    {showSecondFreeAgentDropdown && sortedAndFilteredSecondPlayers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                        {sortedAndFilteredSecondPlayers
                          .filter(p => p.id !== selectedFreeAgent?.id) // Exclude first selected player
                          .slice(0, 50).map(player => (
                          <button
                            key={player.id}
                            onClick={() => {
                              setSelectedSecondFreeAgent(player);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-slate-700 transition-colors text-white text-sm border-b border-slate-700/50 last:border-b-0"
                          >
                            <div className="font-medium">{player.name}</div>
                            <div className="text-xs text-slate-400">
                              {player.team} • {player.pos?.join('/')} • {(player.blendedFppg || player.seasonFppg || 0).toFixed(2)} FPPG
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <p className="mt-1 text-xs text-slate-400">
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
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
              <span className="ml-3 text-slate-400">Calculating projections...</span>
            </div>
          )}

          {/* Comparison Results */}
          {comparisonData && !isLoading && (
            <div className="space-y-6">
              {/* Team Impact Summary */}
              <div className={`p-6 rounded-lg border-2 ${
                isPositiveImpact
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isPositiveImpact ? (
                      <TrendingUp className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-red-400" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Team ICE Impact
                      </h3>
                      <p className="text-sm text-slate-400">
                        {isPositiveImpact ? 'Positive' : 'Negative'} impact on total team performance
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      isPositiveImpact ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {iceImpact > 0 ? '+' : ''}{iceImpact.toFixed(1)}
                    </div>
                    <div className="text-sm text-slate-400">ICE Points</div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-sm text-slate-400">Starts Change</div>
                    <div className="text-lg font-semibold text-white mt-1">
                      {comparisonData.candidate.teamImpact.startsChange > 0 ? '+' : ''}
                      {comparisonData.candidate.teamImpact.startsChange}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">Games Change</div>
                    <div className="text-lg font-semibold text-white mt-1">
                      {comparisonData.candidate.teamImpact.gamesChange > 0 ? '+' : ''}
                      {comparisonData.candidate.teamImpact.gamesChange}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">Total Team ICE</div>
                    <div className="text-lg font-semibold text-white mt-1">
                      {comparisonData.newTeamMetrics.totalICE.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Stats Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free Agent Stats */}
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    {selectedFreeAgent?.name}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">ICE Score:</span>
                      <span className="text-white font-medium">
                        {comparisonData.candidate.player.iceScore?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Projected Starts:</span>
                      <span className="text-white font-medium">
                        {comparisonData.candidate.player.starts}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Games Available:</span>
                      <span className="text-white font-medium">
                        {comparisonData.candidate.player.gamesAvailable}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">FPPG:</span>
                      <span className="text-white font-medium">
                        {comparisonData.candidate.player.fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Roster Player Stats */}
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    {selectedRosterPlayer?.full_name}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">ICE Score:</span>
                      <span className="text-white font-medium">
                        {comparisonData.replaced.player.iceScore?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Projected Starts:</span>
                      <span className="text-white font-medium">
                        {comparisonData.replaced.currentContribution.starts}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Games Available:</span>
                      <span className="text-white font-medium">
                        {comparisonData.replaced.currentContribution.games}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">FPPG:</span>
                      <span className="text-white font-medium">
                        {comparisonData.replaced.player.fppg?.toFixed(2) ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Stats Toggle */}
              <button
                onClick={() => setShowDetailedView(!showDetailedView)}
                className="w-full py-3 px-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {showDetailedView ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                {showDetailedView ? 'Hide' : 'Show'} Detailed Stats Comparison
              </button>

              {/* Detailed Stats Comparison */}
              {showDetailedView && selectedFreeAgent && (comparisonMode === 'roster' ? selectedRosterPlayer : selectedSecondFreeAgent) && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 space-y-6">
                  {/* Player Headers with Headshots */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Free Agent Header */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={`https://assets.nhle.com/mugs/nhl/20242025/${selectedFreeAgent.team}/${selectedFreeAgent.id}.png`}
                          alt={selectedFreeAgent.name}
                          className="w-16 h-16 rounded-full bg-slate-800 object-cover border-2 border-emerald-500"
                          onError={(e) => {
                            e.currentTarget.src = '/player-placeholder.png';
                          }}
                        />
                        <img
                          src={`https://assets.nhle.com/logos/nhl/svg/${selectedFreeAgent.team}_light.svg`}
                          alt={selectedFreeAgent.team}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white/10 border border-slate-700 p-0.5"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{selectedFreeAgent.name}</h4>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-emerald-400 font-semibold">{selectedFreeAgent.team}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-300">{selectedFreeAgent.pos?.join('/')}</span>
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
                        const playerId = secondPlayer.id;

                        return (
                          <>
                            <div className="relative">
                              <img
                                src={`https://assets.nhle.com/mugs/nhl/20242025/${playerTeam}/${playerId}.png`}
                                alt={playerName}
                                className={`w-16 h-16 rounded-full bg-slate-800 object-cover border-2 ${
                                  comparisonMode === 'roster' ? 'border-slate-500' : 'border-emerald-500'
                                }`}
                                onError={(e) => {
                                  e.currentTarget.src = '/player-placeholder.png';
                                }}
                              />
                              <img
                                src={`https://assets.nhle.com/logos/nhl/svg/${playerTeam}_light.svg`}
                                alt={playerTeam}
                                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white/10 border border-slate-700 p-0.5"
                              />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">{playerName}</h4>
                              <div className="flex items-center gap-2 text-sm">
                                <span className={`font-semibold ${comparisonMode === 'roster' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                  {playerTeam}
                                </span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-300">{playerPos}</span>
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
                              <tr className="bg-slate-800/50 border-b border-slate-700">
                                <th className="text-left py-3 px-4 text-slate-300 font-semibold">Statistic</th>
                                <th className="text-right py-3 px-4 text-emerald-400 font-semibold">Free Agent</th>
                                <th className="text-right py-3 px-4 text-emerald-400/60 font-semibold">Per Game</th>
                                <th className="text-right py-3 px-4 text-cyan-400 font-semibold">Your Roster</th>
                                <th className="text-right py-3 px-4 text-cyan-400/60 font-semibold">Per Game</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {/* Games Played */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Games Played</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">{freeAgentGP}</td>
                                <td className="text-right py-3 px-4 text-slate-500">—</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">{secondPlayerGP}</td>
                                <td className="text-right py-3 px-4 text-slate-500">—</td>
                              </tr>

                              {/* Goals */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Goals</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(selectedFreeAgent.stats?.goals)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(selectedFreeAgent.stats?.goals) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(secondPlayerStats?.goals)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(secondPlayerStats?.goals) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Assists */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Assists</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(selectedFreeAgent.stats?.assists)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(selectedFreeAgent.stats?.assists) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(secondPlayerStats?.assists)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(secondPlayerStats?.assists) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Points (highlighted) */}
                              <tr className="hover:bg-slate-800/30 bg-purple-500/10">
                                <td className="py-3 px-4 text-slate-200 font-semibold">Points</td>
                                <td className="text-right py-3 px-4 text-emerald-400 font-bold">
                                  {getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)}
                                </td>
                                <td className="text-right py-3 px-4 text-emerald-300">
                                  {((getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className={`text-right py-3 px-4 font-bold ${comparisonMode === 'roster' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                  {getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)}
                                </td>
                                <td className={`text-right py-3 px-4 ${comparisonMode === 'roster' ? 'text-cyan-300' : 'text-emerald-300'}`}>
                                  {((getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Plus/Minus */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Plus/Minus</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat((selectedFreeAgent.stats as any)?.plus_minus) > 0 && '+'}
                                  {getStat((selectedFreeAgent.stats as any)?.plus_minus)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-500">—</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat((secondPlayerStats as any)?.plus_minus) > 0 && '+'}
                                  {getStat((secondPlayerStats as any)?.plus_minus)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-500">—</td>
                              </tr>

                              {/* Shots on Goal */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Shots on Goal</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(selectedFreeAgent.stats?.shots_on_goal)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(selectedFreeAgent.stats?.shots_on_goal) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(secondPlayerStats?.shots_on_goal)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(secondPlayerStats?.shots_on_goal) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Power Play Points */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Power Play Points</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(selectedFreeAgent.stats?.power_play_points)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(selectedFreeAgent.stats?.power_play_points) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(secondPlayerStats?.power_play_points)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(secondPlayerStats?.power_play_points) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Blocks */}
                              <tr className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 text-slate-200">Blocks</td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(selectedFreeAgent.stats?.blocks)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(selectedFreeAgent.stats?.blocks) / freeAgentGP).toFixed(2)}
                                </td>
                                <td className="text-right py-3 px-4 text-white font-semibold">
                                  {getStat(secondPlayerStats?.blocks)}
                                </td>
                                <td className="text-right py-3 px-4 text-slate-400">
                                  {(getStat(secondPlayerStats?.blocks) / secondPlayerGP).toFixed(2)}
                                </td>
                              </tr>

                              {/* Hits */}
                              {(getStat(selectedFreeAgent.stats?.hits) > 0 || getStat(secondPlayerStats?.hits) > 0) && (
                                <tr className="hover:bg-slate-800/30">
                                  <td className="py-3 px-4 text-slate-200">Hits</td>
                                  <td className="text-right py-3 px-4 text-white font-semibold">
                                    {getStat(selectedFreeAgent.stats?.hits)}
                                  </td>
                                  <td className="text-right py-3 px-4 text-slate-400">
                                    {(getStat(selectedFreeAgent.stats?.hits) / freeAgentGP).toFixed(2)}
                                  </td>
                                  <td className="text-right py-3 px-4 text-white font-semibold">
                                    {getStat(secondPlayerStats?.hits)}
                                  </td>
                                  <td className="text-right py-3 px-4 text-slate-400">
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
                        <div className="text-center py-8 text-slate-400">
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
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isPositiveImpact
                      ? `Make This Swap (+${iceImpact.toFixed(1)} ICE)`
                      : 'Negative Impact - Not Recommended'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Free Agent Comparison (no API data needed) */}
          {comparisonMode === 'freeagent' && !isLoading && selectedFreeAgent && selectedSecondFreeAgent && (
            <div className="space-y-6">
              {/* Detailed Stats Comparison */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 space-y-6">
                {/* Player Headers with Headshots */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Free Agent Header */}
                  <div className="flex items-center gap-4">
                    <img
                      src={`https://assets.nhle.com/mugs/nhl/20242025/${selectedFreeAgent.team}/${selectedFreeAgent.id.replace(/^nhl:/, '')}.png`}
                      alt={selectedFreeAgent.name}
                      className="w-16 h-16 rounded-full bg-slate-900/80 object-cover border-2 border-emerald-500"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <h3 className="text-xl font-bold text-emerald-400">{selectedFreeAgent.name}</h3>
                      <p className="text-sm text-slate-400">{selectedFreeAgent.team} • {selectedFreeAgent.pos?.join('/')}</p>
                    </div>
                  </div>

                  {/* Second Free Agent Header */}
                  <div className="flex items-center gap-4">
                    <img
                      src={`https://assets.nhle.com/mugs/nhl/20242025/${selectedSecondFreeAgent.team}/${selectedSecondFreeAgent.id.replace(/^nhl:/, '')}.png`}
                      alt={selectedSecondFreeAgent.name}
                      className="w-16 h-16 rounded-full bg-slate-900/80 object-cover border-2 border-emerald-500"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <h3 className="text-xl font-bold text-emerald-400">{selectedSecondFreeAgent.name}</h3>
                      <p className="text-sm text-slate-400">{selectedSecondFreeAgent.team} • {selectedSecondFreeAgent.pos?.join('/')}</p>
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
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-3 px-4 text-slate-400 font-medium">Stat</th>
                              <th className="text-right py-3 px-4 text-emerald-400 font-medium">Total</th>
                              <th className="text-right py-3 px-4 text-emerald-300 font-medium">Per Game</th>
                              <th className="text-right py-3 px-4 text-emerald-400 font-medium">Total</th>
                              <th className="text-right py-3 px-4 text-emerald-300 font-medium">Per Game</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-200">Games Played</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">{freeAgentGP}</td>
                              <td className="text-right py-3 px-4 text-slate-500">—</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">{secondPlayerGP}</td>
                              <td className="text-right py-3 px-4 text-slate-500">—</td>
                            </tr>

                            <tr className="hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-200">Goals</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(selectedFreeAgent.stats?.goals)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(selectedFreeAgent.stats?.goals) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(secondPlayerStats?.goals)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(secondPlayerStats?.goals) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-200">Assists</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(selectedFreeAgent.stats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(selectedFreeAgent.stats?.assists) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(secondPlayerStats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(secondPlayerStats?.assists) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-800/30 bg-purple-500/10">
                              <td className="py-3 px-4 text-slate-200 font-semibold">Points</td>
                              <td className="text-right py-3 px-4 text-emerald-400 font-bold">
                                {getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-emerald-300">
                                {((getStat(selectedFreeAgent.stats?.goals) + getStat(selectedFreeAgent.stats?.assists)) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-emerald-400 font-bold">
                                {getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)}
                              </td>
                              <td className="text-right py-3 px-4 text-emerald-300">
                                {((getStat(secondPlayerStats?.goals) + getStat(secondPlayerStats?.assists)) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-200">Shots on Goal</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(selectedFreeAgent.stats?.shots_on_goal)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(selectedFreeAgent.stats?.shots_on_goal) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(secondPlayerStats?.shots_on_goal)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(secondPlayerStats?.shots_on_goal) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-200">Power Play Points</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(selectedFreeAgent.stats?.power_play_points)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(selectedFreeAgent.stats?.power_play_points) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(secondPlayerStats?.power_play_points)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(secondPlayerStats?.power_play_points) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>

                            <tr className="hover:bg-slate-800/30">
                              <td className="py-3 px-4 text-slate-200">Blocks</td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(selectedFreeAgent.stats?.blocks)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(selectedFreeAgent.stats?.blocks) / freeAgentGP).toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-white font-semibold">
                                {getStat(secondPlayerStats?.blocks)}
                              </td>
                              <td className="text-right py-3 px-4 text-slate-400">
                                {(getStat(secondPlayerStats?.blocks) / secondPlayerGP).toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-center py-8 text-slate-400">
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
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Calendar className="w-16 h-16 mb-4 opacity-50" />
              <p>Select both players to see the comparison</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
