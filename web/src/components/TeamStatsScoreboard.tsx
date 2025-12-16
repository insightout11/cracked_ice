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
  totalNHLGames: number;
  benchScore: number;
  scheduleQuality: {
    label: string;
    color: string;
    percentage: number;
  };
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

// Calculate total unique NHL games in the time period
const calculateTotalNHLGames = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[]
): number => {
  const uniqueGames = new Set<string>();

  workingLineup.forEach(lineupPlayer => {
    const projection = projections[lineupPlayer.player.id];
    const gamesByDate = projection?.gamesByDate ?? {};

    // Each game is represented by date + teams
    Object.entries(gamesByDate).forEach(([date, gameDetail]) => {
      const playerTeam = lineupPlayer.player.team;
      const opponent = gameDetail.opponent;
      // Create unique game ID (sort teams alphabetically to avoid duplicates)
      const teams = [playerTeam, opponent].sort();
      const gameId = `${date}-${teams[0]}-${teams[1]}`;
      uniqueGames.add(gameId);
    });
  });

  return uniqueGames.size;
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

  const gamesPerDay = totalGames / daysInWindow;

  // League average is ~12 games per day for a full roster (12 active slots * ~1 game per day)
  // Adjust based on actual roster size
  const leagueAverage = 12;
  const percentageVsAverage = (gamesPerDay / leagueAverage) * 100;

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
  const totalNHLGames = calculateTotalNHLGames(projections, workingLineup);
  const benchScore = calculateBenchScore(projections, workingLineup);
  const scheduleQuality = calculateScheduleQuality(totalGames, timeWindow);

  return {
    totalICE,
    totalGames,
    totalOffNights,
    totalNHLGames,
    benchScore,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
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
    <div className="mb-4 rounded-xl border border-cyan-500/20 p-4" style={{
      background: 'rgba(15, 25, 41, 0.85)',
      backdropFilter: 'blur(12px)'
    }}>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
        {/* Total ICE */}
        <div className="rounded-lg p-3 text-center border border-cyan-500/30" style={{
          background: 'rgba(30, 41, 59, 0.6)'
        }}>
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalICE.toFixed(1)}
          </div>
          <div className="text-xs uppercase text-gray-300 mt-1 font-semibold tracking-wide">
            Total ICE
          </div>
        </div>

        {/* Total Games */}
        <div className="rounded-lg p-3 text-center border border-cyan-500/30" style={{
          background: 'rgba(30, 41, 59, 0.6)'
        }}>
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalGames}
          </div>
          <div className="text-xs uppercase text-gray-300 mt-1 font-semibold tracking-wide">
            Total Games
          </div>
        </div>

        {/* Off-Nights */}
        <div className="rounded-lg p-3 text-center border border-cyan-500/30" style={{
          background: 'rgba(30, 41, 59, 0.6)'
        }}>
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalOffNights}
          </div>
          <div className="text-xs uppercase text-gray-300 mt-1 font-semibold tracking-wide">
            Off-Nights
          </div>
        </div>

        {/* Total NHL Games */}
        <div className="rounded-lg p-3 text-center border border-cyan-500/30" style={{
          background: 'rgba(30, 41, 59, 0.6)'
        }}>
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.totalNHLGames}
          </div>
          <div className="text-xs uppercase text-gray-300 mt-1 font-semibold tracking-wide">
            NHL Games
          </div>
        </div>

        {/* Bench Score */}
        <div className="rounded-lg p-3 text-center border border-cyan-500/30" style={{
          background: 'rgba(30, 41, 59, 0.6)'
        }}>
          <div className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]">
            {metrics.benchScore.toFixed(1)}%
          </div>
          <div className="text-xs uppercase text-gray-300 mt-1 font-semibold tracking-wide">
            Bench Score
          </div>
        </div>

        {/* Schedule Quality */}
        <div className="rounded-lg p-3 text-center border border-cyan-500/30" style={{
          background: 'rgba(30, 41, 59, 0.6)'
        }}>
          <div className={`text-3xl font-bold ${metrics.scheduleQuality.color} drop-shadow-[0_0_10px_rgba(99,230,255,0.4)]`}>
            {metrics.scheduleQuality.label}
          </div>
          <div className="text-xs uppercase text-gray-300 mt-1 font-semibold tracking-wide">
            Schedule
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
