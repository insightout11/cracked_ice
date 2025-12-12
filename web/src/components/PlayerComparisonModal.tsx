// @ts-nocheck
import React, { useEffect } from 'react';
import { X, Calendar, Rocket, Moon, Flame, Snowflake, TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { RosterPlayer, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { TeamTierData } from '../types/teamTiers';
import type { TimeWindowState } from '../types/timeWindow';
import { getTeamLogoUrl, getTeamColor } from '../lib/teamLogos';
import { getIceCircleStyle, shouldPulse } from '../lib/iceScore';
import {
  calculateTeamMetrics,
  calculateSwapImpact,
  findPlayerSlot,
  type WorkingLineupItem,
  type TeamMetrics,
  type SwapImpact,
} from '../lib/teamMetrics';

interface PlayerComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: [RosterPlayer, RosterPlayer];
  projections: Record<string, PlayerProjection>;
  currentLineup: WorkingLineupItem[];
  timeWindow: TimeWindowState;
  leagueProfile: LeagueProfile;
  getTeamTier?: (teamCode: string) => TeamTierData | undefined;
}

export const PlayerComparisonModal: React.FC<PlayerComparisonModalProps> = ({
  isOpen,
  onClose,
  players,
  projections,
  currentLineup,
  timeWindow,
  leagueProfile,
  getTeamTier,
}) => {
  // Keyboard handler for ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const [playerA, playerB] = players;
  const projectionA = projections[playerA.id];
  const projectionB = projections[playerB.id];

  // Helper function to get player data
  const getPlayerData = (player: RosterPlayer, projection?: PlayerProjection) => {
    const positions = Array.isArray(player.positions) ? player.positions.join('/') : 'N/A';
    const teamColor = getTeamColor(player.team);
    const teamLogo = getTeamLogoUrl(player.team);

    const getHeadshotUrl = (playerId: string, team: string) => {
      const numericId = playerId.replace(/^nhl:/, '');
      return `https://assets.nhle.com/mugs/nhl/20252026/${team}/${numericId}.png`;
    };
    const headshotUrl = getHeadshotUrl(player.id, player.team);

    // Calculate FPPG metrics
    const seasonFppg = (player as any).seasonFppg ?? projection?.fppg ?? 0;
    const last30Fppg = (player as any).last30Fppg ?? seasonFppg;
    const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
    const calculatedIce = (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);
    const iceScore = projection?.iceScore ?? calculatedIce;

    // Determine hot/cold streak
    const isHot = last7Fppg > seasonFppg && seasonFppg > 0;
    const isCold = last7Fppg < seasonFppg * 0.8 && seasonFppg > 0;
    const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;

    // Get ICE score styling
    const iceCircleStyle = getIceCircleStyle(iceScore, 0, 5);

    // SoS info
    const getSosInfo = (sos?: number): { label: string; color: string } => {
      if (sos === undefined) return { label: 'N/A', color: 'text-gray-400' };
      if (sos >= 7) return { label: 'Easy', color: 'text-green-400' };
      if (sos <= 3) return { label: 'Tough', color: 'text-red-400' };
      return { label: 'Moderate', color: 'text-yellow-400' };
    };
    const sosInfo = getSosInfo(projection?.strengthOfSchedule);

    return {
      positions,
      teamColor,
      teamLogo,
      headshotUrl,
      seasonFppg,
      last30Fppg,
      last7Fppg,
      iceScore,
      isHot,
      isCold,
      trendPercent,
      iceCircleStyle,
      sosInfo,
    };
  };

  const dataA = getPlayerData(playerA, projectionA);
  const dataB = getPlayerData(playerB, projectionB);

  // Calculate team metrics
  const currentTeamMetrics = calculateTeamMetrics(currentLineup, projections);

  // Calculate swap impact for each player
  // We need to determine which player (if any) is currently in an active slot
  const slotA = findPlayerSlot(currentLineup, playerA.id);
  const slotB = findPlayerSlot(currentLineup, playerB.id);

  // Determine comparison context: are we comparing two players both in lineup, or one vs bench, etc.
  const isAActive = slotA && !slotA.startsWith('BN') && !slotA.startsWith('IR');
  const isBActive = slotB && !slotB.startsWith('BN') && !slotB.startsWith('IR');

  // Calculate team impact deltas
  let impactA: SwapImpact | null = null;
  let impactB: SwapImpact | null = null;

  if (isAActive && isBActive) {
    // Both players are active - show impact of swapping them
    impactA = {
      iceChange: 0, // No net change if we're just swapping positions
      startsChange: 0,
      gamesChange: 0,
    };
    impactB = {
      iceChange: 0,
      startsChange: 0,
      gamesChange: 0,
    };
  } else if (isAActive) {
    // Player A is active, B is not - show impact of replacing A with B
    impactB = calculateSwapImpact(currentLineup, playerA, playerB, projections);
    impactA = { iceChange: 0, startsChange: 0, gamesChange: 0 };
  } else if (isBActive) {
    // Player B is active, A is not - show impact of replacing B with A
    impactA = calculateSwapImpact(currentLineup, playerB, playerA, projections);
    impactB = { iceChange: 0, startsChange: 0, gamesChange: 0 };
  } else {
    // Neither is active - can't calculate meaningful team impact
    impactA = null;
    impactB = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-title"
    >
      <div className="relative bg-slate-950 rounded-2xl shadow-2xl border border-slate-800/50 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border-b border-white/10 p-6">
          {/* Gradient accent bar at top */}
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r"
            style={{
              backgroundImage: `linear-gradient(to right, ${dataA.teamColor} 0%, ${dataA.teamColor} 48%, transparent 48%, transparent 52%, ${dataB.teamColor} 52%, ${dataB.teamColor} 100%)`
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-white z-10"
            aria-label="Close comparison"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 id="comparison-title" className="text-2xl font-bold text-white mb-6 text-center">
            Player Comparison
          </h2>

          {/* Player Headers - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player A Header */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="relative flex-shrink-0">
                <img
                  src={dataA.headshotUrl}
                  alt={playerA.full_name}
                  className="w-16 h-16 rounded-full bg-slate-800 object-cover border-2"
                  style={{ borderColor: dataA.teamColor }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <img
                  src={dataA.teamLogo}
                  alt={playerA.team}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 p-0.5"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{playerA.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-cyan-400 font-semibold text-sm">{playerA.team}</span>
                  <span className="text-slate-500 text-sm">•</span>
                  <span className="text-slate-300 text-sm">{dataA.positions}</span>
                </div>
                {slotA && (
                  <div className="mt-1 text-xs text-slate-400">
                    Slot: <span className="text-cyan-400 font-semibold">{slotA}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Player B Header */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="relative flex-shrink-0">
                <img
                  src={dataB.headshotUrl}
                  alt={playerB.full_name}
                  className="w-16 h-16 rounded-full bg-slate-800 object-cover border-2"
                  style={{ borderColor: dataB.teamColor }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <img
                  src={dataB.teamLogo}
                  alt={playerB.team}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 p-0.5"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{playerB.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-cyan-400 font-semibold text-sm">{playerB.team}</span>
                  <span className="text-slate-500 text-sm">•</span>
                  <span className="text-slate-300 text-sm">{dataB.positions}</span>
                </div>
                {slotB && (
                  <div className="mt-1 text-xs text-slate-400">
                    Slot: <span className="text-cyan-400 font-semibold">{slotB}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TEAM IMPACT SUMMARY */}
          <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 rounded-xl p-6 border border-cyan-500/20">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Team Impact Comparison
            </h3>

            {/* Current Lineup Baseline */}
            <div className="bg-slate-900/60 rounded-lg p-4 mb-4 border border-slate-700">
              <div className="text-sm text-slate-400 mb-2">Current Lineup</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">Total ICE Score:</span>
                  <span className="text-xl font-bold text-cyan-400">{currentTeamMetrics.totalICE.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">Total Starts:</span>
                  <span className="text-xl font-bold text-cyan-400">{currentTeamMetrics.totalStarts}</span>
                </div>
              </div>
            </div>

            {/* Impact Comparison Grid */}
            {(impactA !== null || impactB !== null) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Player A Impact */}
                <div className={`rounded-lg p-4 border-2 ${
                  impactA && impactA.iceChange > 0
                    ? 'bg-green-900/20 border-green-500/40'
                    : impactA && impactA.iceChange < 0
                    ? 'bg-red-900/20 border-red-500/40'
                    : 'bg-slate-800/50 border-slate-700'
                }`}>
                  <div className="text-sm font-semibold text-white mb-3 truncate">{playerA.full_name}</div>

                  {impactA ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">ICE Change:</span>
                          <div className="flex items-center gap-1">
                            {impactA.iceChange > 0 ? (
                              <ArrowUp className="w-3 h-3 text-green-400" />
                            ) : impactA.iceChange < 0 ? (
                              <ArrowDown className="w-3 h-3 text-red-400" />
                            ) : (
                              <Minus className="w-3 h-3 text-slate-400" />
                            )}
                            <span className={`text-sm font-bold ${
                              impactA.iceChange > 0 ? 'text-green-400' : impactA.iceChange < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {impactA.iceChange > 0 ? '+' : ''}{impactA.iceChange.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Starts Change:</span>
                          <div className="flex items-center gap-1">
                            {impactA.startsChange > 0 ? (
                              <ArrowUp className="w-3 h-3 text-green-400" />
                            ) : impactA.startsChange < 0 ? (
                              <ArrowDown className="w-3 h-3 text-red-400" />
                            ) : (
                              <Minus className="w-3 h-3 text-slate-400" />
                            )}
                            <span className={`text-sm font-bold ${
                              impactA.startsChange > 0 ? 'text-green-400' : impactA.startsChange < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {impactA.startsChange > 0 ? '+' : ''}{impactA.startsChange}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        {impactA.iceChange > 0 ? (
                          <div className="text-xs text-green-400 font-semibold">✓ Improves Team</div>
                        ) : impactA.iceChange < 0 ? (
                          <div className="text-xs text-red-400 font-semibold">↓ Weakens Team</div>
                        ) : (
                          <div className="text-xs text-slate-400">= Neutral Impact</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400">No active slot change</div>
                  )}
                </div>

                {/* Player B Impact */}
                <div className={`rounded-lg p-4 border-2 ${
                  impactB && impactB.iceChange > 0
                    ? 'bg-green-900/20 border-green-500/40'
                    : impactB && impactB.iceChange < 0
                    ? 'bg-red-900/20 border-red-500/40'
                    : 'bg-slate-800/50 border-slate-700'
                }`}>
                  <div className="text-sm font-semibold text-white mb-3 truncate">{playerB.full_name}</div>

                  {impactB ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">ICE Change:</span>
                          <div className="flex items-center gap-1">
                            {impactB.iceChange > 0 ? (
                              <ArrowUp className="w-3 h-3 text-green-400" />
                            ) : impactB.iceChange < 0 ? (
                              <ArrowDown className="w-3 h-3 text-red-400" />
                            ) : (
                              <Minus className="w-3 h-3 text-slate-400" />
                            )}
                            <span className={`text-sm font-bold ${
                              impactB.iceChange > 0 ? 'text-green-400' : impactB.iceChange < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {impactB.iceChange > 0 ? '+' : ''}{impactB.iceChange.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Starts Change:</span>
                          <div className="flex items-center gap-1">
                            {impactB.startsChange > 0 ? (
                              <ArrowUp className="w-3 h-3 text-green-400" />
                            ) : impactB.startsChange < 0 ? (
                              <ArrowDown className="w-3 h-3 text-red-400" />
                            ) : (
                              <Minus className="w-3 h-3 text-slate-400" />
                            )}
                            <span className={`text-sm font-bold ${
                              impactB.startsChange > 0 ? 'text-green-400' : impactB.startsChange < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {impactB.startsChange > 0 ? '+' : ''}{impactB.startsChange}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        {impactB.iceChange > 0 ? (
                          <div className="text-xs text-green-400 font-semibold">✓ Improves Team</div>
                        ) : impactB.iceChange < 0 ? (
                          <div className="text-xs text-red-400 font-semibold">↓ Weakens Team</div>
                        ) : (
                          <div className="text-xs text-slate-400">= Neutral Impact</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400">No active slot change</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm py-4">
                Both players are on the bench. Team impact only applies to active roster slots.
              </div>
            )}
          </div>

          {/* QUICK STATS COMPARISON */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Quick Stats Comparison</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player A Stats */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-cyan-400 mb-3">{playerA.full_name}</div>

                {/* ICE Score */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-2">ICE Score</div>
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold"
                    style={{
                      background: dataA.iceCircleStyle.backgroundColor,
                      border: dataA.iceCircleStyle.border,
                      boxShadow: dataA.iceCircleStyle.boxShadow,
                      color: dataA.iceCircleStyle.textColor,
                    }}
                  >
                    {dataA.iceScore.toFixed(1)}
                  </div>
                </div>

                {/* Games & Starts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Games
                    </div>
                    <div className="text-lg font-bold text-white">{projectionA?.gamesAvailable || 0}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Rocket className="w-3 h-3" />
                      Starts
                    </div>
                    <div className="text-lg font-bold text-white">{projectionA?.starts || 0}</div>
                  </div>
                </div>

                {/* SoS & Off-Nights */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">SoS</div>
                    <div className={`text-lg font-bold ${dataA.sosInfo.color}`}>
                      {projectionA?.strengthOfSchedule?.toFixed(1) || 'N/A'}
                    </div>
                    <div className={`text-[10px] ${dataA.sosInfo.color}`}>{dataA.sosInfo.label}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      Off-Nights
                    </div>
                    <div className="text-lg font-bold text-purple-400">
                      {projectionA ? Math.round((projectionA.offNightRate || 0) * projectionA.gamesAvailable) : 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player B Stats */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-cyan-400 mb-3">{playerB.full_name}</div>

                {/* ICE Score */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-2">ICE Score</div>
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold"
                    style={{
                      background: dataB.iceCircleStyle.backgroundColor,
                      border: dataB.iceCircleStyle.border,
                      boxShadow: dataB.iceCircleStyle.boxShadow,
                      color: dataB.iceCircleStyle.textColor,
                    }}
                  >
                    {dataB.iceScore.toFixed(1)}
                  </div>
                </div>

                {/* Games & Starts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Games
                    </div>
                    <div className="text-lg font-bold text-white">{projectionB?.gamesAvailable || 0}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Rocket className="w-3 h-3" />
                      Starts
                    </div>
                    <div className="text-lg font-bold text-white">{projectionB?.starts || 0}</div>
                  </div>
                </div>

                {/* SoS & Off-Nights */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">SoS</div>
                    <div className={`text-lg font-bold ${dataB.sosInfo.color}`}>
                      {projectionB?.strengthOfSchedule?.toFixed(1) || 'N/A'}
                    </div>
                    <div className={`text-[10px] ${dataB.sosInfo.color}`}>{dataB.sosInfo.label}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      Off-Nights
                    </div>
                    <div className="text-lg font-bold text-purple-400">
                      {projectionB ? Math.round((projectionB.offNightRate || 0) * projectionB.gamesAvailable) : 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FPPG COMPARISON WITH PROGRESS BARS */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">FPPG Performance</h3>

            <div className="space-y-6">
              {/* Season FPPG */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Season FPPG</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-cyan-400">{dataA.seasonFppg.toFixed(1)}</span>
                    <span className="text-xs text-slate-500">vs</span>
                    <span className="text-sm font-semibold text-cyan-400">{dataB.seasonFppg.toFixed(1)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Player A Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (dataA.seasonFppg / Math.max(dataA.seasonFppg, dataB.seasonFppg)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  {/* Player B Bar */}
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (dataB.seasonFppg / Math.max(dataA.seasonFppg, dataB.seasonFppg)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Last 30 FPPG */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Last 30 Days FPPG</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-cyan-400">{dataA.last30Fppg.toFixed(1)}</span>
                    <span className="text-xs text-slate-500">vs</span>
                    <span className="text-sm font-semibold text-cyan-400">{dataB.last30Fppg.toFixed(1)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Player A Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (dataA.last30Fppg / Math.max(dataA.last30Fppg, dataB.last30Fppg)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  {/* Player B Bar */}
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (dataB.last30Fppg / Math.max(dataA.last30Fppg, dataB.last30Fppg)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Last 7 FPPG */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Last 7 Days FPPG</span>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-semibold ${
                      dataA.isHot ? 'text-orange-400' : dataA.isCold ? 'text-blue-400' : 'text-cyan-400'
                    }`}>
                      {dataA.last7Fppg.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-500">vs</span>
                    <span className={`text-sm font-semibold ${
                      dataB.isHot ? 'text-orange-400' : dataB.isCold ? 'text-blue-400' : 'text-cyan-400'
                    }`}>
                      {dataB.last7Fppg.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Player A Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dataA.isHot ? 'bg-orange-500' : dataA.isCold ? 'bg-blue-500' : 'bg-purple-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (dataA.last7Fppg / Math.max(dataA.last7Fppg, dataB.last7Fppg)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  {/* Player B Bar */}
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dataB.isHot ? 'bg-orange-500' : dataB.isCold ? 'bg-blue-500' : 'bg-purple-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (dataB.last7Fppg / Math.max(dataA.last7Fppg, dataB.last7Fppg)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trend Indicators */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                {/* Player A Trend */}
                <div className="flex items-center gap-2">
                  {dataA.isHot ? (
                    <>
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-orange-400 font-semibold">Hot +{dataA.trendPercent}%</span>
                    </>
                  ) : dataA.isCold ? (
                    <>
                      <Snowflake className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-blue-400 font-semibold">Cold {dataA.trendPercent}%</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Steady</span>
                  )}
                </div>
                {/* Player B Trend */}
                <div className="flex items-center gap-2 justify-end">
                  {dataB.isHot ? (
                    <>
                      <span className="text-xs text-orange-400 font-semibold">Hot +{dataB.trendPercent}%</span>
                      <Flame className="w-4 h-4 text-orange-400" />
                    </>
                  ) : dataB.isCold ? (
                    <>
                      <span className="text-xs text-blue-400 font-semibold">Cold {dataB.trendPercent}%</span>
                      <Snowflake className="w-4 h-4 text-blue-400" />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Steady</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SCHEDULE & CONTEXT */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Schedule & Context
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player A Schedule */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-cyan-400 mb-3">{playerA.full_name}</div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Games in Window</span>
                    <span className="text-lg font-bold text-white">{projectionA?.gamesAvailable || 0}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {timeWindow.start} to {timeWindow.end}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      Off-Night Games
                    </span>
                    <span className="text-lg font-bold text-purple-400">
                      {projectionA ? Math.round((projectionA.offNightRate || 0) * projectionA.gamesAvailable) : 0}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {projectionA ? `${Math.round((projectionA.offNightRate || 0) * 100)}% of games` : 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Strength of Schedule</span>
                    <span className={`text-lg font-bold ${dataA.sosInfo.color}`}>
                      {projectionA?.strengthOfSchedule?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className={`text-[10px] ${dataA.sosInfo.color}`}>
                    {dataA.sosInfo.label} {projectionA?.strengthOfSchedule ? `(1-10 scale)` : ''}
                  </div>
                </div>

                {projectionA?.gamesByDate && Object.keys(projectionA.gamesByDate).length > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-2">Upcoming Games</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto text-[10px] text-slate-300">
                      {Object.entries(projectionA.gamesByDate).slice(0, 5).map(([date, game]: [string, any]) => (
                        <div key={date} className="flex items-center justify-between">
                          <span>{date}</span>
                          <span className="text-slate-500">vs {game.opponent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Player B Schedule */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-cyan-400 mb-3">{playerB.full_name}</div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Games in Window</span>
                    <span className="text-lg font-bold text-white">{projectionB?.gamesAvailable || 0}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {timeWindow.start} to {timeWindow.end}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      Off-Night Games
                    </span>
                    <span className="text-lg font-bold text-purple-400">
                      {projectionB ? Math.round((projectionB.offNightRate || 0) * projectionB.gamesAvailable) : 0}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {projectionB ? `${Math.round((projectionB.offNightRate || 0) * 100)}% of games` : 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Strength of Schedule</span>
                    <span className={`text-lg font-bold ${dataB.sosInfo.color}`}>
                      {projectionB?.strengthOfSchedule?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className={`text-[10px] ${dataB.sosInfo.color}`}>
                    {dataB.sosInfo.label} {projectionB?.strengthOfSchedule ? `(1-10 scale)` : ''}
                  </div>
                </div>

                {projectionB?.gamesByDate && Object.keys(projectionB.gamesByDate).length > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-2">Upcoming Games</div>
                    <div className="space-y-1 max-h-24 overflow-y-auto text-[10px] text-slate-300">
                      {Object.entries(projectionB.gamesByDate).slice(0, 5).map(([date, game]: [string, any]) => (
                        <div key={date} className="flex items-center justify-between">
                          <span>{date}</span>
                          <span className="text-slate-500">vs {game.opponent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI RECOMMENDATION PLACEHOLDER */}
          <div className="bg-gradient-to-br from-purple-900/20 to-slate-900/20 rounded-xl p-6 border border-purple-500/20">
            <div className="text-center text-slate-500 text-sm">
              <div className="mb-2">🤖 AI Coach Recommendations</div>
              <div className="text-xs">Coming Soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
