import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPrevWeekIso, getNextWeekIso, getWeekOptions, type SortMode, type WeeklyStats } from '../lib/schedule';
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
}

export function ScoreboardBanner({ weekIso, onWeekChange, sortMode, onSortChange, overlaySettings, onOverlaySettingsChange, userTeamCount, weeklyStats }: ScoreboardBannerProps) {
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const weekOptions = getWeekOptions();

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
    <div className="mx-auto w-full max-w-7xl px-4">
      <div className={`
        rounded-2xl
        bg-gradient-to-br from-[#061624]/90 via-[#0a1a2e]/90 to-[#0d1f36]/90
        border border-white/6
        shadow-[0_18px_40px_rgba(0,0,0,0.45)]
        backdrop-blur-lg
        px-4 lg:px-6 py-2
      `}>
        {/* Main Header Row */}
        <div className="flex items-center justify-between gap-2 lg:gap-3 flex-wrap">
          {/* Left: Title + Weekly Stats */}
          <div className="flex items-baseline gap-1.5 lg:gap-3 flex-shrink-0">
            <div className="flex items-baseline gap-1.5 lg:gap-2">
              <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] lg:tracking-[0.18em] text-sky-300/70">
                Schedule
              </span>
              <span className="text-lg lg:text-xl font-semibold text-white">
                Viewer
              </span>
            </div>

            {/* Weekly Stats Badge */}
            {weeklyStats && (
              <div className="flex items-center gap-2 ml-2">
                {/* Total Games */}
                <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-[10px] text-sky-300/70 uppercase tracking-wide mr-1">
                    Week:
                  </span>
                  <span className="text-sm font-bold text-white">
                    {weeklyStats.totalGames}
                  </span>
                  <span className="text-[10px] text-sky-300/70 ml-1">
                    games
                  </span>
                </div>

                {/* Intensity Indicator */}
                <div className={`
                  px-2 py-1 rounded-lg border
                  ${weeklyStats.intensity === 'busy'
                    ? 'bg-red-500/20 border-red-400/40 text-red-300'
                    : weeklyStats.intensity === 'light'
                    ? 'bg-green-500/20 border-green-400/40 text-green-300'
                    : 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300'
                  }
                `}>
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {weeklyStats.intensity === 'busy' ? '🔥 Busy' : weeklyStats.intensity === 'light' ? '🌙 Light' : '📊 Average'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Center: Week Controls */}
          <div className="flex items-center gap-2 order-3 lg:order-2 w-full lg:w-auto justify-center lg:justify-start">
            {/* Previous Week Arrow */}
            <button
              onClick={handlePrevWeek}
              className="p-1 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3 h-3 text-cyan-400" />
            </button>

            {/* Week Dropdown */}
            <div style={{ minWidth: '200px' }}>
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
              className="p-1 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-3 h-3 text-cyan-400" />
            </button>
          </div>

          {/* Right: Sort Controls + Overlay Settings */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 order-2 lg:order-3 relative overlay-panel-container">
            <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] text-sky-300/70 hidden sm:inline">
              Sort:
            </span>
            <div style={{ minWidth: '180px' }}>
              <IceDropdown
                options={sortOptions}
                value={sortMode}
                onChange={(value) => onSortChange(value as SortMode)}
                placeholder="Sort by"
                aria-label="Sort teams"
              />
            </div>

            {/* Personalize Settings Button */}
            <button
              onClick={() => setShowOverlayPanel(!showOverlayPanel)}
              className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors flex items-center gap-1"
              title="Personalize schedule view"
            >
              <span>👁️</span>
              <span className="hidden sm:inline">Personalize</span>
              {userTeamCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-cyan-500/30 rounded text-[10px]">
                  {userTeamCount}
                </span>
              )}
            </button>

            {/* Personalize Settings Panel */}
            {showOverlayPanel && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-gradient-to-br from-[#061624]/95 via-[#0a1a2e]/95 to-[#0d1f36]/95 border border-white/10 rounded-lg shadow-xl backdrop-blur-lg z-[9999] p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>👁️</span> Personalize View
                </h3>

                {/* Off-Night Indicators */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={overlaySettings.showOffNightIndicators}
                    onChange={(e) => onOverlaySettingsChange({ showOffNightIndicators: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-white">Show off-night indicators</span>
                </label>

                {/* Highlight User Teams */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={overlaySettings.highlightUserTeams}
                    onChange={(e) => onOverlaySettingsChange({ highlightUserTeams: e.target.checked })}
                    className="w-4 h-4"
                    disabled={userTeamCount === 0}
                  />
                  <span className={`text-xs ${userTeamCount === 0 ? 'text-gray-500' : 'text-white'}`}>
                    Highlight my teams
                  </span>
                  {userTeamCount > 0 && (
                    <span className="ml-auto text-[10px] text-cyan-400">({userTeamCount} teams)</span>
                  )}
                </label>

                {/* Show Player Counts */}
                <label className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-white/5 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={overlaySettings.showPlayerCounts}
                    onChange={(e) => onOverlaySettingsChange({ showPlayerCounts: e.target.checked })}
                    className="w-4 h-4"
                    disabled={userTeamCount === 0}
                  />
                  <span className={`text-xs ${userTeamCount === 0 ? 'text-gray-500' : 'text-white'}`}>
                    Show player counts
                  </span>
                </label>

                {/* Filter User Teams Only */}
                <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded border-t border-white/10 mt-2 pt-2">
                  <input
                    type="checkbox"
                    checked={overlaySettings.filterUserTeamsOnly}
                    onChange={(e) => onOverlaySettingsChange({ filterUserTeamsOnly: e.target.checked })}
                    className="w-4 h-4"
                    disabled={userTeamCount === 0}
                  />
                  <span className={`text-xs ${userTeamCount === 0 ? 'text-gray-500' : 'text-white'}`}>
                    Show only my teams
                  </span>
                </label>

                {userTeamCount === 0 && (
                  <p className="text-[10px] text-gray-400 mt-3 italic">
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