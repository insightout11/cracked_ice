import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
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

  // Sort and filter players based on estimated value
  const sortedAndFilteredPlayers = React.useMemo(() => {
    let players = allFreeAgents;

    // Filter by tracked free agents if toggle is off
    if (!showAllPlayers && trackedFreeAgentIds.size > 0) {
      players = allFreeAgents.filter(p => trackedFreeAgentIds.has(p.id));
    }

    // Sort by estimated ICE improvement if roster player is selected
    if (selectedRosterPlayer && projections[selectedRosterPlayer.id]) {
      const rosterPlayerICE = projections[selectedRosterPlayer.id].iceScore || 0;

      return [...players].sort((a, b) => {
        // Estimate ICE score from blendedFppg (simple heuristic)
        const aICE = a.blendedFppg || a.seasonFppg || 0;
        const bICE = b.blendedFppg || b.seasonFppg || 0;

        // Sort by potential improvement (higher is better)
        const aImprovement = aICE - rosterPlayerICE;
        const bImprovement = bICE - rosterPlayerICE;

        return bImprovement - aImprovement;
      });
    }

    // No sorting if no roster player selected - just alphabetical
    return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [allFreeAgents, showAllPlayers, trackedFreeAgentIds, selectedRosterPlayer, projections]);

  // Reset selection when drawer opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setSelectedFreeAgent(initialFreeAgent || null);
      setSelectedRosterPlayer(initialRosterPlayer || null);
      setComparisonData(null);
      setError(null);
    }
  }, [isOpen, initialFreeAgent, initialRosterPlayer]);

  // Load comparison when both players are selected
  useEffect(() => {
    if (selectedFreeAgent && selectedRosterPlayer && timeWindow.config) {
      loadComparison();
    } else {
      setComparisonData(null);
    }
  }, [selectedFreeAgent, selectedRosterPlayer, timeWindow]);

  const loadComparison = async () => {
    if (!selectedFreeAgent || !selectedRosterPlayer || !timeWindow.config) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('[PlayerComparisonDrawer] Loading comparison:', {
        candidateId: selectedFreeAgent.id,
        candidateName: selectedFreeAgent.name,
        replaceId: selectedRosterPlayer.id,
        replaceName: selectedRosterPlayer.full_name,
        window: {
          start: timeWindow.config.startUtc,
          end: timeWindow.config.endUtc,
        }
      });

      const result = await apiService.compareSwap(
        selectedFreeAgent.id,
        selectedRosterPlayer.id,
        {
          start: timeWindow.config.startUtc,
          end: timeWindow.config.endUtc,
        }
      );

      console.log('[PlayerComparisonDrawer] Comparison result:', result);
      setComparisonData(result);
    } catch (err: any) {
      console.error('[PlayerComparisonDrawer] Failed to load comparison:', err);
      console.error('[PlayerComparisonDrawer] Error response data:', JSON.stringify(err.response?.data, null, 2));
      console.error('[PlayerComparisonDrawer] Error status:', err.response?.status);
      console.error('[PlayerComparisonDrawer] Error message:', err.message);

      const errorMessage = err.response?.data?.error || err.message || 'Failed to load comparison data. Please try again.';
      console.error('[PlayerComparisonDrawer] Showing error to user:', errorMessage);
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
                Compare free agents with your roster to optimize team ICE
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Player Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Free Agent Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Free Agent {selectedRosterPlayer && `(Sorted by ICE vs ${selectedRosterPlayer.full_name})`}
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
              <select
                value={selectedFreeAgent?.id || ''}
                onChange={(e) => {
                  const player = sortedAndFilteredPlayers.find(p => p.id === e.target.value);
                  setSelectedFreeAgent(player || null);
                }}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select a player...</option>
                {sortedAndFilteredPlayers.slice(0, 200).map(player => {
                  // Show estimated improvement if roster player is selected
                  let suffix = '';
                  if (selectedRosterPlayer && projections[selectedRosterPlayer.id]) {
                    const rosterICE = projections[selectedRosterPlayer.id].iceScore || 0;
                    const playerFppg = player.blendedFppg || player.seasonFppg || 0;
                    const improvement = playerFppg - rosterICE;
                    if (improvement > 0) {
                      suffix = ` [+${improvement.toFixed(1)}]`;
                    } else if (improvement < 0) {
                      suffix = ` [${improvement.toFixed(1)}]`;
                    }
                  }
                  return (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.team}) - {player.pos?.join('/')}{suffix}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Showing top 200 players sorted by estimated value
              </p>
            </div>

            {/* Roster Player Selector */}
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

          {/* Empty State */}
          {!comparisonData && !isLoading && selectedFreeAgent && selectedRosterPlayer && (
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
