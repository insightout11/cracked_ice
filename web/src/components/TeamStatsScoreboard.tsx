import React, { useMemo, useState } from 'react';
import { differenceInDays } from 'date-fns';
import type { PlayerProjection } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { LeagueProfile } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { RosterGapsPanel } from './RosterGapsPanel';

interface TeamStatsScoreboardProps {
  projections: Record<string, PlayerProjection>;
  workingLineup: WorkingLineupPlayer[];
  leagueProfile: LeagueProfile | null;
  timeWindow: TimeWindowState;
  isLoadingProjections: boolean;
  unusedSlotsByDate?: Record<string, Record<string, number>>;
  onOpenCoach: () => void;
  onOpenSwap: () => void;
}

interface TeamMetrics {
  totalICE: number;
  totalGames: number;
  totalOffNights: number;
  scheduleQuality: {
    label: string;
    color: string;
    percentage: number;
  };
}

// Calculate total ICE score for the roster
const calculateTotalICE = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
  return workingLineup.reduce((sum, lineupPlayer) => {
    const projection = projections[lineupPlayer.player.id];
    return sum + (projection?.iceScore ?? 0);
  }, 0);
};

// Count total unique game dates across all roster players
const calculateTotalGames = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
  const uniqueDates = new Set<string>();

  workingLineup.forEach(lineupPlayer => {
    const projection = projections[lineupPlayer.player.id];
    // Use gamesByDate to get all game dates for this player
    if (projection?.gamesByDate) {
      Object.keys(projection.gamesByDate).forEach(date => {
        uniqueDates.add(date);
      });
    }
  });

  return uniqueDates.size;
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

// Calculate schedule quality vs league average
const calculateScheduleQuality = (
  totalGames: number,
  timeWindow: TimeWindowState
): { label: string; color: string; percentage: number } => {
  if (!timeWindow.config?.startUtc || !timeWindow.config?.endUtc) {
    return { label: 'N/A', color: 'text-gray-400', percentage: 0 };
  }

  const daysInWindow = differenceInDays(
    new Date(timeWindow.config.endUtc),
    new Date(timeWindow.config.startUtc)
  );

  if (daysInWindow === 0) {
    return { label: 'N/A', color: 'text-gray-400', percentage: 0 };
  }

  const gamesPerWeek = (totalGames / daysInWindow) * 7;

  // League average is ~3.5 games per week per roster slot
  const leagueAverage = 3.5;
  const percentageVsAverage = (gamesPerWeek / leagueAverage) * 100;

  if (percentageVsAverage >= 110) {
    return { label: 'Elite', color: 'text-green-400', percentage: percentageVsAverage };
  } else if (percentageVsAverage >= 90) {
    return { label: 'Good', color: 'text-cyan-400', percentage: percentageVsAverage };
  } else if (percentageVsAverage >= 70) {
    return { label: 'Fair', color: 'text-yellow-400', percentage: percentageVsAverage };
  } else {
    return { label: 'Poor', color: 'text-red-400', percentage: percentageVsAverage };
  }
};

// Aggregate all team metrics
const calculateTeamMetrics = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[],
  timeWindow: TimeWindowState
): TeamMetrics => {
  const totalICE = calculateTotalICE(projections, workingLineup);
  const totalGames = calculateTotalGames(projections, workingLineup);
  const totalOffNights = calculateTotalOffNights(projections, workingLineup);
  const scheduleQuality = calculateScheduleQuality(totalGames, timeWindow);

  return {
    totalICE,
    totalGames,
    totalOffNights,
    scheduleQuality
  };
};

export const TeamStatsScoreboard: React.FC<TeamStatsScoreboardProps> = ({
  projections,
  workingLineup,
  leagueProfile,
  timeWindow,
  isLoadingProjections,
  unusedSlotsByDate,
  onOpenCoach,
  onOpenSwap
}) => {
  const [isGapsExpanded, setIsGapsExpanded] = useState(false);

  // Calculate metrics (memoized for performance)
  const metrics = useMemo(() => {
    return calculateTeamMetrics(projections, workingLineup, timeWindow);
  }, [projections, workingLineup, timeWindow]);

  // Show loading skeleton while projections load
  if (isLoadingProjections) {
    return (
      <div className="mb-4 bg-white/5 rounded-xl border border-white/10 p-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/5 rounded-lg p-4 h-24"></div>
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
    <div className="mb-4 bg-white/5 backdrop-blur-md rounded-xl border border-cyan-500/20 p-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {/* Total ICE */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalICE.toFixed(1)}
          </div>
          <div className="text-xs uppercase text-gray-400 mt-1 font-semibold tracking-wide">
            Total ICE
          </div>
        </div>

        {/* Total Games */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalGames}
          </div>
          <div className="text-xs uppercase text-gray-400 mt-1 font-semibold tracking-wide">
            Total Games
          </div>
        </div>

        {/* Off-Nights */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-lg p-3 text-center">
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalOffNights}
          </div>
          <div className="text-xs uppercase text-gray-400 mt-1 font-semibold tracking-wide">
            Off-Nights
          </div>
        </div>

        {/* Schedule Quality */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-lg p-3 text-center">
          <div className={`text-3xl font-bold ${metrics.scheduleQuality.color} drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]`}>
            {metrics.scheduleQuality.label}
          </div>
          <div className="text-xs uppercase text-gray-400 mt-1 font-semibold tracking-wide">
            Schedule {metrics.scheduleQuality.percentage > 0 && `(${Math.round(metrics.scheduleQuality.percentage)}%)`}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpenCoach}
          className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded-lg text-cyan-400 font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,230,255,0.3)]"
        >
          💬 Coach
        </button>
        <button
          onClick={onOpenSwap}
          className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 rounded-lg text-cyan-400 font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,230,255,0.3)]"
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
  );
};
