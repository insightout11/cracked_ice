import React from 'react';
import { TimeWindow } from './TimeWindow/TimeWindow';
import { DataFreshnessIndicator } from './DataFreshnessIndicator';
import { Clock, ChevronDown, Share2 } from 'lucide-react';
import type { TimeWindowState, CustomDateRange, TimeWindowMode } from '../types/timeWindow';
import type { PlayoffPreset, LeagueWeekConfig } from '../types/playoffMode';
import type { HealthResponse } from '../lib/coachSchemas';

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
}

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
}) => {
  const isCompact = cardDensity === 'compact';

  return (
    <div className={`mx-auto w-full max-w-7xl px-4 ${isCompact ? 'mt-2' : 'mt-4'}`}>
      <div className={`
        flex items-center justify-between gap-2 lg:gap-3 flex-wrap
        rounded-2xl
        bg-gradient-to-br from-[#061624]/90 via-[#0a1a2e]/90 to-[#0d1f36]/90
        border border-white/6
        shadow-[0_18px_40px_rgba(0,0,0,0.45)]
        backdrop-blur-lg
        ${isCompact ? 'px-3 py-1.5' : 'px-4 lg:px-6 py-2'}
      `}>
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
    </div>
  );
};
