import { TooltipLabel } from './ui/tooltip';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, SlidersHorizontal } from 'lucide-react';
import { getPrevWeekIso, getNextWeekIso, getWeekOptions, type SortMode, type WeeklyStats, type DayId } from '../lib/schedule';
import { seasonWeeks } from '../lib/season';
import { IceDropdown } from './IceDropdown';
import type { ScheduleOverlaySettings } from '../hooks/useScheduleOverlaySettings';

interface ScoreboardBannerProps {
  weekIso: string;
  onWeekChange: (iso: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  overlaySettings: ScheduleOverlaySettings;
  onOverlaySettingsChange: (settings: Partial<ScheduleOverlaySettings>) => void;
  userTeamCount: number;
  weeklyStats: WeeklyStats | null;
  selectedDay?: DayId | null;
  onClearDayFilter?: () => void;
  // New props for view toggle
  scheduleView: 'teams' | 'players';
  onScheduleViewChange: (view: 'teams' | 'players') => void;
  userHasRoster: boolean;
  playerViewWeekRange: number;
  onPlayerViewWeekRangeChange: (weeks: number) => void;
}

export function ScoreboardBanner({ weekIso, onWeekChange, sortMode, onSortChange, overlaySettings, onOverlaySettingsChange, userTeamCount, weeklyStats, selectedDay, onClearDayFilter, scheduleView, onScheduleViewChange, userHasRoster, playerViewWeekRange, onPlayerViewWeekRangeChange }: ScoreboardBannerProps) {
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const weekOptions = getWeekOptions();

  // Week range options for player schedule view. The full-season option tracks
  // the configured season length (config/season.json).
  const weekRangeOptions = [
    { value: 8, label: '8 Weeks' },
    { value: 16, label: '16 Weeks' },
    { value: seasonWeeks, label: 'Season End' }
  ];

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showOverlayPanel && !(event.target as Element).closest('.overlay-panel-container')) {
        setShowOverlayPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverlayPanel]);

  const sortOptions = [
    { value: 'alphabetical', label: 'Alphabetical' },
    { value: 'best', label: 'Best Schedule First' },
    { value: 'worst', label: 'Worst Schedule First' }
  ];

  const handlePrevWeek = () => {
    onWeekChange(getPrevWeekIso(weekIso));
  };

  const handleNextWeek = () => {
    onWeekChange(getNextWeekIso(weekIso));
  };

  const handleWeekSelect = (value: string | number) => {
    onWeekChange(String(value));
  };

  return (
    <div className='mx-auto w-full max-w-7xl px-4 relative z-[1000]'>
      <div className={`
        rounded-2xl
        bg-gradient-to-br from-surface-0/90 via-surface-1/90 to-surface-2/90
        border border-line
        shadow-[0_18px_40px_var(--surface-0)]
        backdrop-blur-lg
        px-4 lg:px-6 py-2
      `}>
        {/* Main Header Row */}
        <div className="flex items-center justify-between gap-2 lg:gap-3 flex-wrap">
          {/* Left: Title + View Toggle Buttons + Weekly Stats */}
          <div className="flex w-full min-w-0 items-center gap-1.5 lg:w-auto lg:gap-3 flex-wrap">
            <div className="flex items-baseline gap-1.5 lg:gap-2">
              <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] lg:tracking-[0.18em] text-accent">
                Schedule
              </span>
              <span className="text-lg lg:text-xl font-semibold text-ink">
                Viewer
              </span>
            </div>

            {/* View Toggle Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onScheduleViewChange('teams')}
                className="view-toggle-button"
                data-active={scheduleView === 'teams'}
              >
                Team Grid
              </button>
              <button
                onClick={() => onScheduleViewChange('players')}
                disabled={!userHasRoster}
                className="view-toggle-button"
                data-active={scheduleView === 'players'}
              >
                Player Schedule
              </button>

              {/* Week Range Dropdown (only visible when Player Schedule is active) */}
              {scheduleView === 'players' && (
                <div className='min-w-[110px]'>
                  <IceDropdown
                    options={weekRangeOptions}
                    value={playerViewWeekRange}
                    onChange={(weeks) => onPlayerViewWeekRangeChange(weeks as number)}
                    placeholder="Range"
                    aria-label="Select week range"
                  />
                </div>
              )}
            </div>

            {/* Weekly Stats Badge */}
            {weeklyStats && (
              <div className="flex items-center gap-2 lg:ml-2">
                {/* Total Games */}
                <div className="px-2 py-1 bg-surface-1/5 border border-line rounded-lg">
                  <span className="text-[10px] text-accent uppercase tracking-wide mr-1">
                    Week:
                  </span>
                  <span className="text-sm font-bold text-ink">
                    {weeklyStats.totalGames}
                  </span>
                  <span className="text-[10px] text-accent ml-1">
                    games
                  </span>
                </div>

                {/* Intensity Indicator */}
                <div className={`
                  px-2 py-1 rounded-lg border
                  ${weeklyStats.intensity === 'heavy'
                    ? 'bg-negative-muted border-negative text-negative'
                    : weeklyStats.intensity === 'light'
                    ? 'bg-positive-muted border-positive text-positive'
                    : 'bg-warning-muted border-warning text-warning'
                  }
                `}>
                  <span className="text-[10px] font-bold uppercase tracking-wide">
 {weeklyStats.intensity === 'heavy' ? ' Heavy' : weeklyStats.intensity === 'light' ? ' Light' : ' Average'}
                  </span>
                </div>
              </div>
            )}

            {/* Day Filter Indicator */}
            {selectedDay && (
              <div className="flex items-center gap-1 px-2 py-1 bg-accent-muted border border-accent rounded-lg">
                <span className="text-[10px] text-accent uppercase tracking-wide">
                  Filtered: {selectedDay}
                </span>
                <TooltipLabel label='Clear day filter'><button
                    onClick={onClearDayFilter}
                    className="ml-1 text-accent hover:text-ink transition-colors"
                    aria-label="Clear day filter">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button></TooltipLabel>
              </div>
            )}
          </div>

          {/* Center: Week Controls */}
          <div className="flex items-center gap-2 order-3 lg:order-2">
            {/* Previous Week Arrow */}
            <button
              onClick={handlePrevWeek}
              className="p-1 rounded bg-surface-1/5 border border-line hover:bg-accent-muted hover:border-accent transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3 h-3 text-accent" />
            </button>

            {/* Week Dropdown */}
            <div className='min-w-[200px]'>
              <IceDropdown
                options={weekOptions}
                value={weekIso}
                onChange={handleWeekSelect}
                placeholder="Pick week"
                aria-label="Select week"
              />
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

          {/* Right: Sort Controls + Overlay Settings */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 order-2 lg:order-3 relative overlay-panel-container">
            <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] text-accent hidden sm:inline">
              Sort:
            </span>
            <div className='min-w-[180px]'>
              <IceDropdown
                options={sortOptions}
                value={sortMode}
                onChange={(value) => onSortChange(value as SortMode)}
                placeholder="Sort by"
                aria-label="Sort teams"
              />
            </div>

            {/* Personalize Settings Button */}
            <TooltipLabel label='Personalize schedule view'><button
                onClick={() => setShowOverlayPanel(!showOverlayPanel)}
                className="px-2 py-1 text-xs bg-surface-1/5 border border-line rounded-lg text-ink hover:bg-surface-1/10 transition-colors flex items-center gap-1">
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">Personalize</span>
                {userTeamCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-accent-muted rounded text-[10px]">
                    {userTeamCount}
                  </span>
                )}
              </button></TooltipLabel>

            {/* Personalize Settings Panel */}
            {showOverlayPanel && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-gradient-to-br from-surface-0/95 via-surface-1/95 to-surface-2/95 border border-line rounded-lg shadow-xl backdrop-blur-lg p-4 overlay-panel-container">
                <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={14} /> Personalize View
                </h3>

                {/* Off-Night Indicators */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-surface-1/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={overlaySettings.showOffNightIndicators}
                    onChange={(e) => onOverlaySettingsChange({ showOffNightIndicators: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-ink">Show off-night indicators</span>
                </label>

                {/* Highlight User Teams */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-surface-1/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={overlaySettings.highlightUserTeams}
                    onChange={(e) => onOverlaySettingsChange({ highlightUserTeams: e.target.checked })}
                    className="w-4 h-4"
                    disabled={userTeamCount === 0}
                  />
                  <span className={`text-xs ${userTeamCount === 0 ? 'text-ink-mute' : 'text-ink'}`}>
                    Highlight my teams
                  </span>
                  {userTeamCount > 0 && (
                    <span className="ml-auto text-[10px] text-accent">({userTeamCount} teams)</span>
                  )}
                </label>

                {/* Show Player Counts */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-surface-1/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={overlaySettings.showPlayerCounts}
                    onChange={(e) => onOverlaySettingsChange({ showPlayerCounts: e.target.checked })}
                    className="w-4 h-4"
                    disabled={userTeamCount === 0}
                  />
                  <span className={`text-xs ${userTeamCount === 0 ? 'text-ink-mute' : 'text-ink'}`}>
                    Show player counts
                  </span>
                </label>

                {/* Filter User Teams Only */}
                <label className="flex items-center gap-2 cursor-pointer hover:bg-surface-1/5 p-2 rounded border-t border-line mt-2 pt-2">
                  <input
                    type="checkbox"
                    checked={overlaySettings.filterUserTeamsOnly}
                    onChange={(e) => onOverlaySettingsChange({ filterUserTeamsOnly: e.target.checked })}
                    className="w-4 h-4"
                    disabled={userTeamCount === 0}
                  />
                  <span className={`text-xs ${userTeamCount === 0 ? 'text-ink-mute' : 'text-ink'}`}>
                    Show only my teams
                  </span>
                </label>

                {/* PRO Features Section */}
                <div className="border-t border-line mt-2 pt-2">
                  <div className="text-[10px] text-accent uppercase tracking-wide mb-2 px-2">
                    PRO Features
                  </div>

                  <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-surface-1/5 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={overlaySettings.showConflictOverlay}
                      onChange={(e) => onOverlaySettingsChange({ showConflictOverlay: e.target.checked })}
                      className="w-4 h-4"
                      disabled={userTeamCount === 0}
                    />
                    <span className={`text-xs ${userTeamCount === 0 ? 'text-ink-mute' : 'text-ink'}`}>
                      Show daily conflicts
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer hover:bg-surface-1/5 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={overlaySettings.showStreamingValue}
                      onChange={(e) => onOverlaySettingsChange({ showStreamingValue: e.target.checked })}
                      className="w-4 h-4"
                      disabled={userTeamCount === 0}
                    />
                    <span className={`text-xs ${userTeamCount === 0 ? 'text-ink-mute' : 'text-ink'}`}>
                      Show streaming opportunities
                    </span>
                  </label>
                </div>

                {userTeamCount === 0 && (
                  <p className="text-[10px] text-ink-dim mt-3 italic">
                    Add players to your roster to enable personalization features
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
