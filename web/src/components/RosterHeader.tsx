import React, { useMemo } from 'react';
import { TimeWindow } from './TimeWindow/TimeWindow';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { Clock, ChevronDown, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays } from 'date-fns';
import type { TimeWindowState, CustomDateRange, TimeWindowMode } from '../types/timeWindow';
import type { PlayoffPreset, LeagueWeekConfig } from '../types/playoffMode';
import type { HealthResponse, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';

interface RosterHeaderProps {
  timeWindow: {
    state: TimeWindowState;
    setPreset: (preset: string) => void;
    setCustomRange: (range: CustomDateRange) => void;
    setMode: (mode: TimeWindowMode) => void;
    setPlayoffPreset: (preset: PlayoffPreset) => void;
    setLeagueWeeks: (config: LeagueWeekConfig) => void;
  };
  weightsSource: string | null;
  isLoadingProjections: boolean;
  healthStatus: HealthResponse | null;
  cardDensity: 'full' | 'compact';
  onCardDensityChange: (density: 'full' | 'compact') => void;
  onSettingsClick: () => void;
  onManageClick: () => void;
  onWeightsClick: () => void;
  onShareClick?: () => void;
  // New props for scoreboard integration
  projections?: Record<string, PlayerProjection>;
  workingLineup?: WorkingLineupPlayer[];
  leagueProfile?: LeagueProfile | null;
  totalNHLGamesInWindow?: number;
  onOpenCoach?: () => void;
  onOpenSwap?: () => void;
}

// Calculate team metrics
const calculateTeamMetrics = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[],
  totalNHLGamesInWindow: number
) => {
  const totalICE = workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    const iceScore = projection?.iceScore ?? 0;
    const starts = projection?.starts ?? 0;
    return sum + (iceScore * starts);
  }, 0);

  const totalGames = workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    return sum + (projection?.starts ?? 0);
  }, 0);

  const totalOffNights = workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    const offNightStarts = (projection?.starts ?? 0) * (projection?.offNightRate ?? 0);
    return sum + Math.round(offNightStarts);
  }, 0);

  let totalBenchGames = 0;
  let totalAvailableGames = 0;
  workingLineup.forEach(lineupPlayer => {
    const projection = projections[lineupPlayer.player.id];
    const gamesAvailable = projection?.gamesAvailable ?? 0;
    const starts = projection?.starts ?? 0;
    const benchGames = gamesAvailable - starts;
    totalBenchGames += benchGames;
    totalAvailableGames += gamesAvailable;
  });
  const benchScore = totalAvailableGames === 0 ? 0 : (totalBenchGames / totalAvailableGames) * 100;

  return {
    totalICE,
    totalGames,
    totalOffNights,
    totalNHLGames: totalNHLGamesInWindow,
    benchScore
  };
};

export const RosterHeader: React.FC<RosterHeaderProps> = ({
  timeWindow,
  weightsSource,
  isLoadingProjections,
  healthStatus,
  cardDensity,
  onCardDensityChange,
  onSettingsClick,
  onManageClick,
  onWeightsClick,
  onShareClick,
  projections,
  workingLineup,
  leagueProfile,
  totalNHLGamesInWindow,
  onOpenCoach,
  onOpenSwap,
}) => {
  const isCompact = cardDensity === 'compact';

  // Calculate metrics when we have the necessary data
  const metrics = useMemo(() => {
    if (!projections || !workingLineup || workingLineup.length === 0) {
      return null;
    }
    return calculateTeamMetrics(projections, workingLineup, totalNHLGamesInWindow ?? 0);
  }, [projections, workingLineup, totalNHLGamesInWindow]);

  // Week navigation handlers
  const handlePrevWeek = () => {
    if (!timeWindow.state.config) return;
    const startDate = new Date(timeWindow.state.config.startUtc);
    const endDate = new Date(timeWindow.state.config.endUtc);
    const newStart = addDays(startDate, -7);
    const newEnd = addDays(endDate, -7);
    timeWindow.setCustomRange({
      start: newStart.toISOString().split('T')[0],
      end: newEnd.toISOString().split('T')[0]
    });
  };

  const handleNextWeek = () => {
    if (!timeWindow.state.config) return;
    const startDate = new Date(timeWindow.state.config.startUtc);
    const endDate = new Date(timeWindow.state.config.endUtc);
    const newStart = addDays(startDate, 7);
    const newEnd = addDays(endDate, 7);
    timeWindow.setCustomRange({
      start: newStart.toISOString().split('T')[0],
      end: newEnd.toISOString().split('T')[0]
    });
  };

  return (
    <TooltipProvider>
    <div className={`mx-auto w-full max-w-7xl px-4 ${isCompact ? 'mt-2' : 'mt-4'}`}>
      <div className={`
        rounded-2xl
        bg-gradient-to-br from-[#061624]/90 via-[#0a1a2e]/90 to-[#0d1f36]/90
        border border-white/6
        shadow-[0_18px_40px_rgba(0,0,0,0.45)]
        backdrop-blur-lg
        ${isCompact ? 'px-3 py-1.5' : 'px-4 lg:px-6 py-2'}
      `}>
        {/* Main Header Row */}
        <div className="flex items-center justify-between gap-2 lg:gap-3 flex-wrap">
        {/* Left: Title */}
        <div className="flex items-baseline gap-1.5 lg:gap-2 flex-shrink-0">
          <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] lg:tracking-[0.18em] text-sky-300/70">
            Roster
          </span>
          <span className="text-lg lg:text-xl font-semibold text-white">
            Optimizer
          </span>
        </div>

        {/* Center: Time Window Component + Density Toggle */}
        <div className="flex items-center gap-2 order-3 lg:order-2 w-full lg:w-auto justify-center lg:justify-start">
          <TimeWindow
            value={timeWindow.state}
            onPresetChange={timeWindow.setPreset}
            onCustomRangeChange={timeWindow.setCustomRange}
            onModeChange={timeWindow.setMode}
            onPlayoffPresetChange={timeWindow.setPlayoffPreset}
            onLeagueWeeksChange={timeWindow.setLeagueWeeks}
          />

          {/* Card Density Toggle - hidden on mobile */}
          <div className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => onCardDensityChange('full')}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                cardDensity === 'full'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Detail
            </button>
            <button
              onClick={() => onCardDensityChange('compact')}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                cardDensity === 'compact'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        {/* Right: Date Range + Actions and Status */}
        <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 order-2 lg:order-3">
          {/* Date Range Display - hidden on small screens */}
          {timeWindow.state.config?.startUtc && timeWindow.state.config?.endUtc && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-300/80 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
              <Clock className="w-3 h-3 text-cyan-400/80" />
              <span className="whitespace-nowrap">
                {new Date(timeWindow.state.config.startUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(timeWindow.state.config.endUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}

          {/* Data Freshness Indicator - hidden on mobile */}
          {healthStatus?.dataCache?.generatedAt && (
            <div className="hidden lg:block px-1.5 py-1 bg-white/5 rounded-lg border border-white/10 text-[10px]">
              <DataFreshnessIndicator
                mtime={healthStatus.dataCache.generatedAt}
                label="Stats"
                showAge={true}
              />
            </div>
          )}

          {/* Loading indicator */}
          {isLoadingProjections && (
            <div className="px-2 py-1 text-xs text-cyan-400 flex items-center gap-1.5">
              <div className="animate-spin h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
              <span className="hidden sm:inline whitespace-nowrap">Calculating...</span>
            </div>
          )}

          {/* Manage Players Button */}
          <button
            onClick={onManageClick}
            className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors flex items-center gap-1"
            title="Manage players"
          >
            <span>➕</span>
            <span className="hidden sm:inline">Manage</span>
          </button>

          {/* League Settings Button */}
          <button
            onClick={onSettingsClick}
            className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors flex items-center gap-1"
            title="Configure league settings"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Share Button */}
          {onShareClick && (
            <button
              onClick={onShareClick}
              className="px-2 py-1 text-xs bg-cyan-600/80 border border-cyan-500/50 rounded-lg text-white hover:bg-cyan-500 transition-colors flex items-center gap-1"
              title="Share roster"
            >
              <Share2 className="w-3 h-3" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
        </div>
      </div>

        {/* Scoreboard Metrics Row */}
        {metrics && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Week Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevWeek}
                  className="p-0.5 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-3 h-3 text-cyan-400" />
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-0.5 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-3 h-3 text-cyan-400" />
                </button>
              </div>

              {/* Metrics - Compact inline display */}
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-cyan-500/30">
                      <span className="text-[9px] uppercase text-gray-400">ICE</span>
                      <span className="text-xs font-bold text-cyan-400">{metrics.totalICE.toFixed(1)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sum of ICE score × starts for all players. Higher is better.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-cyan-500/30">
                      <span className="text-[9px] uppercase text-gray-400">Games</span>
                      <span className="text-xs font-bold text-cyan-400">{metrics.totalGames}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total number of games played by your active roster in this period.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-cyan-500/30">
                      <span className="text-[9px] uppercase text-gray-400">Off</span>
                      <span className="text-xs font-bold text-cyan-400">{metrics.totalOffNights}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of starts on low-volume nights (≤8 NHL games). More off-night starts = better schedule leverage.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-cyan-500/30">
                      <span className="text-[9px] uppercase text-gray-400">NHL</span>
                      <span className="text-xs font-bold text-cyan-400">{metrics.totalNHLGames}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total number of NHL games in this time period across the entire league.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-cyan-500/30">
                      <span className="text-[9px] uppercase text-gray-400">Bench</span>
                      <span className="text-xs font-bold text-cyan-400">{metrics.benchScore.toFixed(1)}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Percentage of available player-games that are benched. Lower is better - means your lineup is optimized.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Quick Actions */}
              {onOpenCoach && onOpenSwap && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onOpenCoach}
                    className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded text-cyan-400 font-semibold text-[10px] transition-all"
                  >
                    💬 Coach
                  </button>
                  <button
                    onClick={onOpenSwap}
                    className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded text-cyan-400 font-semibold text-[10px] transition-all"
                  >
                    ⚖️ Swap
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
};
