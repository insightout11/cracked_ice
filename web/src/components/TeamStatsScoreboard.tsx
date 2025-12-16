import React, { useMemo, useState, useCallback } from 'react';
import { differenceInDays, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlayerProjection } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { LeagueProfile } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { RosterGapsPanel } from './RosterGapsPanel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';

interface TeamStatsScoreboardProps {
  projections: Record<string, PlayerProjection>;
  workingLineup: WorkingLineupPlayer[];
  leagueProfile: LeagueProfile | null;
  timeWindow: TimeWindowState;
  isLoadingProjections: boolean;
  unusedSlotsByDate?: Record<string, Record<string, number>>;
  totalNHLGamesInWindow?: number;
  onTimeWindowChange?: (range: { start: string; end: string }) => void;
  onOpenCoach: () => void;
  onOpenSwap: () => void;
}

interface TeamMetrics {
  totalICE: number;
  totalGames: number;
  totalOffNights: number;
  totalNHLGames: number;
  benchScore: number;
}

// Calculate total ICE production (ICE score × starts for each player)
const calculateTotalICE = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
  return workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    const iceScore = projection?.iceScore ?? 0;
    const starts = projection?.starts ?? 0;
    return sum + (iceScore * starts);
  }, 0);
};

// Calculate total roster starts (total games played by all active roster players)
const calculateTotalGames = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
  return workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    // Sum up all simulated starts across the roster
    return sum + (projection?.starts ?? 0);
  }, 0);
};

// Calculate total off-night STARTS across all players
// Note: "Off-night" = 8 or fewer games being played (<= 8 games per day)
// Uses 'starts' (simulated active roster starts) not 'gamesAvailable' (includes bench)
const calculateTotalOffNights = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
  return workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    // starts = simulated active roster starts, offNightRate = % of starts on off-nights
    const offNightStarts = (projection?.starts ?? 0) * (projection?.offNightRate ?? 0);
    return sum + Math.round(offNightStarts);
  }, 0);
};

// Calculate bench score (percentage of players benched vs total games)
// Lower percentage is better
const calculateBenchScore = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
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

  if (totalAvailableGames === 0) {
    return 0;
  }

  return (totalBenchGames / totalAvailableGames) * 100;
};

// Aggregate all team metrics
const calculateTeamMetrics = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[],
  totalNHLGamesInWindow: number
): TeamMetrics => {
  const totalICE = calculateTotalICE(projections, workingLineup);
  const totalGames = calculateTotalGames(projections, workingLineup);
  const totalOffNights = calculateTotalOffNights(projections, workingLineup);
  const benchScore = calculateBenchScore(projections, workingLineup);

  return {
    totalICE,
    totalGames,
    totalOffNights,
    totalNHLGames: totalNHLGamesInWindow,
    benchScore
  };
};

export const TeamStatsScoreboard: React.FC<TeamStatsScoreboardProps> = ({
  projections,
  workingLineup,
  leagueProfile,
  timeWindow,
  isLoadingProjections,
  unusedSlotsByDate,
  totalNHLGamesInWindow,
  onTimeWindowChange,
  onOpenCoach,
  onOpenSwap
}) => {
  const [isGapsExpanded, setIsGapsExpanded] = useState(false);

  // Calculate metrics (memoized for performance)
  const metrics = useMemo(() => {
    return calculateTeamMetrics(projections, workingLineup, totalNHLGamesInWindow ?? 0);
  }, [projections, workingLineup, totalNHLGamesInWindow]);

  // Week navigation handlers
  const handlePrevWeek = useCallback(() => {
    if (!onTimeWindowChange || !timeWindow.config) return;

    const startDate = new Date(timeWindow.config.startUtc);
    const endDate = new Date(timeWindow.config.endUtc);

    const newStart = addDays(startDate, -7);
    const newEnd = addDays(endDate, -7);

    onTimeWindowChange({
      start: newStart.toISOString().split('T')[0],
      end: newEnd.toISOString().split('T')[0]
    });
  }, [timeWindow, onTimeWindowChange]);

  const handleNextWeek = useCallback(() => {
    if (!onTimeWindowChange || !timeWindow.config) return;

    const startDate = new Date(timeWindow.config.startUtc);
    const endDate = new Date(timeWindow.config.endUtc);

    const newStart = addDays(startDate, 7);
    const newEnd = addDays(endDate, 7);

    onTimeWindowChange({
      start: newStart.toISOString().split('T')[0],
      end: newEnd.toISOString().split('T')[0]
    });
  }, [timeWindow, onTimeWindowChange]);

  // Show loading skeleton while projections load
  if (isLoadingProjections) {
    return (
      <div className="mb-1.5 bg-white/5 rounded border border-white/10 p-1.5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white/5 rounded p-1.5 h-10"></div>
          ))}
        </div>
      </div>
    );
  }

  // Don't show if no roster
  if (workingLineup.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="mb-1.5 rounded border border-cyan-500/20 p-1.5" style={{
        background: 'rgba(15, 25, 41, 0.85)',
        backdropFilter: 'blur(12px)'
      }}>
        {/* Week Navigation */}
        {onTimeWindowChange && (
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <button
              onClick={handlePrevWeek}
              className="p-1 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3 h-3 text-cyan-400" />
            </button>
            <div className="text-xs font-semibold text-cyan-400 min-w-[120px] text-center">
              {timeWindow.config?.displayLabel || 'Select dates'}
            </div>
            <button
              onClick={handleNextWeek}
              className="p-1 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-3 h-3 text-cyan-400" />
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1.5 mb-1.5">
        {/* Total ICE */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded p-1.5 text-center border border-cyan-500/30 cursor-help" style={{
              background: 'rgba(30, 41, 59, 0.6)'
            }}>
              <div className="text-sm lg:text-base font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
                {metrics.totalICE.toFixed(1)}
              </div>
              <div className="text-[9px] uppercase text-gray-300 font-semibold tracking-wide">
                Total ICE
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sum of ICE score × starts for all players. Higher is better.</p>
          </TooltipContent>
        </Tooltip>

        {/* Total Games */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded p-1.5 text-center border border-cyan-500/30 cursor-help" style={{
              background: 'rgba(30, 41, 59, 0.6)'
            }}>
              <div className="text-sm lg:text-base font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
                {metrics.totalGames}
              </div>
              <div className="text-[9px] uppercase text-gray-300 font-semibold tracking-wide">
                Total Games
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total number of games played by your active roster in this period.</p>
          </TooltipContent>
        </Tooltip>

        {/* Off-Nights */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded p-1.5 text-center border border-cyan-500/30 cursor-help" style={{
              background: 'rgba(30, 41, 59, 0.6)'
            }}>
              <div className="text-sm lg:text-base font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
                {metrics.totalOffNights}
              </div>
              <div className="text-[9px] uppercase text-gray-300 font-semibold tracking-wide">
                Off-Nights
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Number of starts on low-volume nights (≤8 NHL games). More off-night starts = better schedule leverage.</p>
          </TooltipContent>
        </Tooltip>

        {/* Total NHL Games */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded p-1.5 text-center border border-cyan-500/30 cursor-help" style={{
              background: 'rgba(30, 41, 59, 0.6)'
            }}>
              <div className="text-sm lg:text-base font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
                {metrics.totalNHLGames}
              </div>
              <div className="text-[9px] uppercase text-gray-300 font-semibold tracking-wide">
                NHL Games
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total number of NHL games in this time period across the entire league.</p>
          </TooltipContent>
        </Tooltip>

        {/* Bench Score */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded p-1.5 text-center border border-cyan-500/30 cursor-help" style={{
              background: 'rgba(30, 41, 59, 0.6)'
            }}>
              <div className="text-sm lg:text-base font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
                {metrics.benchScore.toFixed(1)}%
              </div>
              <div className="text-[9px] uppercase text-gray-300 font-semibold tracking-wide">
                Bench Score
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Percentage of available player-games that are benched. Lower is better - means your lineup is optimized.</p>
          </TooltipContent>
        </Tooltip>

      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={onOpenCoach}
          className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded text-cyan-400 font-semibold text-[10px] transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,230,255,0.3)]"
        >
          💬 Coach
        </button>
        <button
          onClick={onOpenSwap}
          className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded text-cyan-400 font-semibold text-[10px] transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,230,255,0.3)]"
        >
          ⚖️ Swap
        </button>
      </div>

      {/* Roster Gaps Panel */}
      <RosterGapsPanel
        isExpanded={isGapsExpanded}
        onToggle={() => setIsGapsExpanded(!isGapsExpanded)}
        unusedSlotsByDate={unusedSlotsByDate}
        projections={projections}
        workingLineup={workingLineup}
        timeWindow={timeWindow}
        isLoading={isLoadingProjections}
      />
    </div>
    </TooltipProvider>
  );
};
