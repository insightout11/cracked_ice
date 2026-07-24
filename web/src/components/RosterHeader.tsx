import React, { useMemo, useState } from 'react';
import { TimeWindow } from './TimeWindow/TimeWindow';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { Clock, ChevronDown, Share2, ChevronLeft, ChevronRight, Users, Settings } from 'lucide-react';
import { addDays, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import type { TimeWindowState, CustomDateRange, TimeWindowMode } from '../types/timeWindow';
import type { PlayoffPreset, LeagueWeekConfig } from '../types/playoffMode';
import type { HealthResponse, PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import { RosterGapsPanel } from './RosterGapsPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipLabel } from './ui/tooltip';
import { getPlayerProjection } from '../lib/playerProjection';

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
  projectionError?: string | null;
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
  unusedSlotsByDate?: Record<string, Record<string, number>>;
  onBrowsePlayers?: (team: string, position: string) => void;
}

// Calculate team metrics
const calculateTeamMetrics = (
  projections: Record<string, PlayerProjection>,
  workingLineup: WorkingLineupPlayer[],
  totalNHLGamesInWindow: number
) => {
  const totalICE = workingLineup.reduce((sum, lineupPlayer) => {
    const projection = getPlayerProjection(projections, lineupPlayer.player.id);
    const iceScore = projection?.iceScore ?? 0;
    const starts = projection?.starts ?? 0;
    return sum + (iceScore * starts);
  }, 0);

  const totalGames = workingLineup.reduce((sum, lineupPlayer) => {
    const projection = getPlayerProjection(projections, lineupPlayer.player.id);
    return sum + (projection?.starts ?? 0);
  }, 0);

  const totalOffNights = workingLineup.reduce((sum, lineupPlayer) => {
    const projection = getPlayerProjection(projections, lineupPlayer.player.id);
    const offNightStarts = (projection?.starts ?? 0) * (projection?.offNightRate ?? 0);
    return sum + Math.round(offNightStarts);
  }, 0);

  let totalBenchGames = 0;
  let totalAvailableGames = 0;
  workingLineup.forEach(lineupPlayer => {
    const projection = getPlayerProjection(projections, lineupPlayer.player.id);
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
  projectionError,
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
  unusedSlotsByDate,
  onBrowsePlayers,
}) => {
  const isCompact = cardDensity === 'compact';
  const [isGapsExpanded, setIsGapsExpanded] = useState(false);

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
    const today = new Date();

    // Parse current start as local date (YYYY-MM-DD)
    const currentStartStr = timeWindow.state.config.startUtc.split('T')[0];
    const [year, month, day] = currentStartStr.split('-').map(Number);
    const currentStart = new Date(year, month - 1, day);

    // Find the Monday of current week, go back 7 days
    const currentDay = currentStart.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const currentMonday = new Date(currentStart);
    currentMonday.setDate(currentStart.getDate() - daysFromMonday);

    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);

    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);

    // Check if previous week includes today
    const isCurrentWeek = isSameWeek(prevMonday, today, { weekStartsOn: 1 });

    if (isCurrentWeek) {
      // Current week: start from today, end on Sunday
      const todayDay = today.getDay();
      const daysUntilSunday = todayDay === 0 ? 0 : 7 - todayDay;
      const thisSunday = new Date(today);
      thisSunday.setDate(today.getDate() + daysUntilSunday);

      timeWindow.setCustomRange({
        start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        end: `${thisSunday.getFullYear()}-${String(thisSunday.getMonth() + 1).padStart(2, '0')}-${String(thisSunday.getDate()).padStart(2, '0')}`
      });
    } else {
      timeWindow.setCustomRange({
        start: `${prevMonday.getFullYear()}-${String(prevMonday.getMonth() + 1).padStart(2, '0')}-${String(prevMonday.getDate()).padStart(2, '0')}`,
        end: `${prevSunday.getFullYear()}-${String(prevSunday.getMonth() + 1).padStart(2, '0')}-${String(prevSunday.getDate()).padStart(2, '0')}`
      });
    }
  };

  const handleNextWeek = () => {
    if (!timeWindow.state.config) return;

    // Parse current end as local date (YYYY-MM-DD)
    const currentEndStr = timeWindow.state.config.endUtc.split('T')[0];
    const [year, month, day] = currentEndStr.split('-').map(Number);
    const currentEnd = new Date(year, month - 1, day);

    // Next Monday = current end + 1 day
    const nextMonday = new Date(currentEnd);
    nextMonday.setDate(currentEnd.getDate() + 1);

    // Next Sunday = next Monday + 6 days
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    timeWindow.setCustomRange({
      start: `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, '0')}-${String(nextMonday.getDate()).padStart(2, '0')}`,
      end: `${nextSunday.getFullYear()}-${String(nextSunday.getMonth() + 1).padStart(2, '0')}-${String(nextSunday.getDate()).padStart(2, '0')}`
    });
  };

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className={`
          rounded-2xl
          bg-gradient-to-br from-surface-0/90 via-surface-1/90 to-surface-2/90
          border border-line
          shadow-[0_18px_40px_var(--surface-0)]
          backdrop-blur-lg
          ${isCompact ? 'px-3 py-1.5' : 'px-4 lg:px-6 py-2'}
        `}>
          {/* Main Header Row */}
          <div className="flex items-center justify-between gap-2 lg:gap-3 flex-wrap">
          {/* Left: Title */}
          <div className="flex items-baseline gap-1.5 lg:gap-2 flex-shrink-0">
            <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] lg:tracking-[0.18em] text-accent">
              My Team
            </span>
            <span className="text-lg lg:text-xl font-semibold text-ink">
              Roster
            </span>
          </div>

          {/* Center: All Date/Time Controls Grouped */}
          <div className="flex items-center gap-2 order-3 lg:order-2 w-full lg:w-auto justify-center lg:justify-start flex-wrap">
            {/* Time Window Dropdown */}
            <TimeWindow
              value={timeWindow.state}
              onPresetChange={timeWindow.setPreset}
              onCustomRangeChange={timeWindow.setCustomRange}
              onModeChange={timeWindow.setMode}
              onPlayoffPresetChange={timeWindow.setPlayoffPreset}
              onLeagueWeeksChange={timeWindow.setLeagueWeeks}
            />

            {/* Date Range Display with Week Navigation */}
            {timeWindow.state.config?.startUtc && timeWindow.state.config?.endUtc && (
              <div className="flex items-center gap-1">
                {/* Previous Week Arrow */}
                <button
                  onClick={handlePrevWeek}
                  className="p-1 rounded bg-surface-1/5 border border-line hover:bg-accent-muted hover:border-accent transition-colors"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-3 h-3 text-accent" />
                </button>

                {/* Date Range */}
                <div className="flex items-center gap-1.5 text-xs text-ink-dim px-2 py-1 bg-surface-1/5 rounded-lg border border-line">
                  <Clock className="w-3 h-3 text-accent" />
                  <span className="whitespace-nowrap">
                    {new Date(timeWindow.state.config.startUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(timeWindow.state.config.endUtc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Next Week Arrow */}
                <button
                  onClick={handleNextWeek}
                  className="p-1 rounded bg-surface-1/5 border border-line hover:bg-accent-muted hover:border-accent transition-colors"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-3 h-3 text-accent" />
                </button>
              </div>
            )}

            {/* Card Density Toggle - hidden on mobile */}
            <div className="hidden md:flex items-center gap-1 bg-surface-1/5 border border-line rounded-lg p-0.5">
              <button
                onClick={() => onCardDensityChange('full')}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                  cardDensity === 'full'
                    ? 'bg-surface-1/10 text-ink'
                    : 'text-ink-dim hover:bg-surface-1/5'
                }`}
              >
                Detail
              </button>
              <button
                onClick={() => onCardDensityChange('compact')}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                  cardDensity === 'compact'
                    ? 'bg-surface-1/10 text-ink'
                    : 'text-ink-dim hover:bg-surface-1/5'
                }`}
              >
                Compact
              </button>
            </div>
          </div>

          {/* Right: Actions and Status */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 order-2 lg:order-3">
            {/* Data Freshness Indicator - hidden on mobile */}
            {healthStatus?.dataCache?.generatedAt && (
              <div className="hidden lg:block px-1.5 py-1 bg-surface-1/5 rounded-lg border border-line text-[10px]">
                <DataFreshnessIndicator
                  mtime={healthStatus.dataCache.generatedAt}
                  label="Stats"
                  showAge={true}
                />
              </div>
            )}

            {/* Loading indicator */}
            {isLoadingProjections && (
              <div className="px-2 py-1 text-xs text-accent flex items-center gap-1.5">
                <div className="animate-spin h-3 w-3 border-2 border-accent border-t-transparent rounded-full"></div>
                <span className="hidden sm:inline whitespace-nowrap">Calculating...</span>
              </div>
            )}

            {/* Manage Players Button */}
            <TooltipLabel label='Manage players'><button
                onClick={onManageClick}
                className="px-2 py-1 text-xs bg-surface-1/5 border border-line rounded-lg text-ink hover:bg-surface-1/10 transition-colors flex items-center gap-1">
                <Users size={14} />
                <span className="hidden sm:inline">Manage</span>
              </button></TooltipLabel>

            {/* League Settings Button */}
            <TooltipLabel label='Configure league settings'><button
                onClick={onSettingsClick}
                className="px-2 py-1 text-xs bg-surface-1/5 border border-line rounded-lg text-ink hover:bg-surface-1/10 transition-colors flex items-center gap-1">
                <Settings size={14} />
                <span className="hidden sm:inline">Settings</span>
              </button></TooltipLabel>

            {/* Share Button */}
            {onShareClick && (
              <TooltipLabel label='Share roster'><button
                  onClick={onShareClick}
                  className="px-2 py-1 text-xs bg-accent-muted border border-accent rounded-lg text-ink hover:bg-accent transition-colors flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Share</span>
                </button></TooltipLabel>
            )}
          </div>
        </div>

          {/* Scoreboard Metrics Row */}
          {metrics && (
            <div className="mt-2 pt-2 border-t border-line">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Metrics - Compact inline display */}
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-1/5 border border-accent">
                        <span className="text-[9px] uppercase text-ink-dim">Lineup value</span>
                        <span className="text-xs font-bold text-accent">{metrics.totalICE.toFixed(1)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sum of each player's ICE rating × usable starts. Higher is better.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-1/5 border border-accent">
                        <span className="text-[9px] uppercase text-ink-dim">Roster Games</span>
                        <span className="text-xs font-bold text-accent">{metrics.totalGames}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total number of games played by your active roster in this period.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-1/5 border border-accent">
                        <span className="text-[9px] uppercase text-ink-dim">Off Nights</span>
                        <span className="text-xs font-bold text-accent">{metrics.totalOffNights}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of starts on low-volume nights (≤8 NHL games). More off-night starts = better schedule leverage.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-1/5 border border-accent">
                        <span className="text-[9px] uppercase text-ink-dim">Total NHL Games</span>
                        <span className="text-xs font-bold text-accent">{metrics.totalNHLGames}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total number of NHL games in this time period across the entire league.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-1/5 border border-accent">
                        <span className="text-[9px] uppercase text-ink-dim">Bench</span>
                        <span className="text-xs font-bold text-accent">{metrics.benchScore.toFixed(1)}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Percentage of available player-games that are benched. Lower is better - means your lineup is optimized.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Roster Gaps Panel */}
              {projections && workingLineup && (
                <RosterGapsPanel
                  isExpanded={isGapsExpanded}
                  onToggle={() => setIsGapsExpanded(!isGapsExpanded)}
                  unusedSlotsByDate={unusedSlotsByDate}
                  projections={projections}
                  workingLineup={workingLineup}
                  timeWindow={timeWindow.state}
                  leagueProfile={leagueProfile ?? null}
                  isLoading={isLoadingProjections}
                  dataError={projectionError}
                  onBrowsePlayers={onBrowsePlayers}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
