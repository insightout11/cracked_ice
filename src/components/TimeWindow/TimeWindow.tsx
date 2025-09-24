import React, { useState } from 'react';
import { TimeWindowState, CustomDateRange, SeasonBounds, TimeWindowPreset, TimeWindowMode } from '../../types/timeWindow';
import { PlayoffPreset, LeagueWeekConfig } from '../../types/playoffMode';
import { getPresetOptions } from '../../lib/timeWindow';
import { getPlayoffPresetOptions } from '../../lib/playoffCalculations';
import { IceDropdown, DropdownOption } from '../IceDropdown';
import { DateRangeDialog } from './DateRangeDialog';
import { PlayoffModeToggle } from './PlayoffModeToggle';
import { LeagueWeeksWizard } from './LeagueWeeksWizard';
import { YahooWeekWarning } from '../YahooWeekWarning';

interface TimeWindowComponentProps {
  value: TimeWindowState;
  onPresetChange: (preset: TimeWindowPreset) => void;
  onCustomRangeChange: (range: CustomDateRange) => void;
  onModeChange: (mode: TimeWindowMode) => void;
  onPlayoffPresetChange: (preset: PlayoffPreset) => void;
  onLeagueWeeksChange: (config: LeagueWeekConfig) => void;
  seasonBounds?: SeasonBounds;
  className?: string;
  showModeToggle?: boolean;
}

export const TimeWindow: React.FC<TimeWindowComponentProps> = ({
  value,
  onPresetChange,
  onCustomRangeChange,
  onModeChange,
  onPlayoffPresetChange,
  onLeagueWeeksChange,
  seasonBounds,
  className = '',
  showModeToggle = true
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLeagueWeeksOpen, setIsLeagueWeeksOpen] = useState(false);
  
  const presetOptions = getPresetOptions();
  const playoffPresetOptions = getPlayoffPresetOptions();

  // Convert to dropdown options format
  const dropdownOptions: DropdownOption[] = presetOptions.map(option => ({
    value: option.value,
    label: option.label
  }));

  const handlePresetChange = (selectedValue: string | number) => {
    if (selectedValue === 'custom') {
      setIsDatePickerOpen(true);
      return;
    }

    const preset = selectedValue as TimeWindowPreset;
    onPresetChange(preset);
  };

  const handleCustomRangeConfirm = (customRange: CustomDateRange) => {
    onCustomRangeChange(customRange);
    setIsDatePickerOpen(false);
  };

  const handlePlayoffPresetChange = (preset: PlayoffPreset) => {
    if (preset === 'league-weeks') {
      setIsLeagueWeeksOpen(true);
      return;
    }
    
    if (preset === 'custom') {
      setIsDatePickerOpen(true);
      return;
    }

    onPlayoffPresetChange(preset);
  };

  const handleLeagueWeeksConfirm = (config: LeagueWeekConfig) => {
    onLeagueWeeksChange(config);
    setIsLeagueWeeksOpen(false);
  };

  return (
    <div className={`time-window-control ${className}`}>
      <div className="flex flex-col">
        <label className="font-medium mb-2 scoreboard-text">
          Time Window:
        </label>
        
        {/* Mode Toggle */}
        {showModeToggle && (
          <PlayoffModeToggle
            mode={value.mode}
            onChange={onModeChange}
          />
        )}
        
        {value.mode === 'regular' ? (
          <>
            {/* Regular Mode - Desktop/Tablet View */}
            <div className="hidden sm:block">
              <IceDropdown
                options={dropdownOptions}
                value={value.preset}
                onChange={handlePresetChange}
                placeholder="Select time window"
                aria-label="Select analysis time window"
              />
              
              {/* Display current effective range */}
              {value.config.displayLabel && (
                <p className="text-sm text-gray-500 mt-1 font-mono">
                  📅 {value.config.displayLabel}
                </p>
              )}
              
              {/* Show error if any */}
              {value.error && (
                <p className="text-sm text-red-600 mt-1">
                  {value.error}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Playoff Mode - My League Weeks Only */}
            <div className="hidden sm:block">
              {/* Yahoo Week Warning */}
              <YahooWeekWarning compact className="mb-4" />

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setIsLeagueWeeksOpen(true)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
                    value.playoffMode?.preset === 'league-weeks'
                      ? 'bg-blue-100 text-[#0E1A2B] border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                  }`}
                >
                  My League Weeks
                </button>
              </div>
              
              {/* Display current effective range */}
              {value.config.displayLabel && (
                <p className="text-sm text-gray-500 mt-1 font-mono">
                  📅 {value.config.displayLabel}
                </p>
              )}
              
              {/* Show error if any */}
              {value.error && (
                <p className="text-sm text-red-600 mt-1">
                  {value.error}
                </p>
              )}
            </div>
          </>
        )}

        {/* Mobile View - Pill Toggles */}
        <div className="block sm:hidden">
          {value.mode === 'regular' ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {presetOptions.slice(0, 4).map((option) => (
                <button
                  key={option.value}
                  onClick={() => onPresetChange(option.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    value.preset === option.value
                      ? 'bg-blue-100 text-[#0E1A2B] border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                  } border`}
                >
                  {option.label === 'Next 7 days' ? '7d' :
                   option.label === 'Next 14 days' ? '14d' :
                   option.label === 'Next 30 days' ? '30d' :
                   option.label === 'Full season' ? 'Season' : option.label}
                </button>
              ))}
              <button
                onClick={() => setIsDatePickerOpen(true)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  value.preset === 'custom'
                    ? 'bg-blue-100 text-[#0E1A2B] border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                } border`}
              >
                Custom
              </button>
            </div>
          ) : (
            <>
              {/* Yahoo Week Warning - Mobile */}
              <YahooWeekWarning compact className="mb-3" />

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setIsLeagueWeeksOpen(true)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    value.playoffMode?.preset === 'league-weeks'
                      ? 'bg-blue-100 text-[#0E1A2B] border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                  } border`}
                >
                  My Weeks
                </button>
              </div>
            </>
          )}
          
          {/* Display current effective range */}
          {value.config.displayLabel && (
            <p className="text-xs text-gray-500 mb-2 font-mono">
              📅 {value.config.displayLabel}
            </p>
          )}
          
          {/* Show error if any */}
          {value.error && (
            <p className="text-sm text-red-600 mb-2">
              {value.error}
            </p>
          )}
        </div>
      </div>

      {/* Custom Date Range Dialog */}
      <DateRangeDialog
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        initialRange={value.customRange}
        onConfirm={handleCustomRangeConfirm}
        seasonBounds={seasonBounds}
      />

      {/* League Weeks Wizard */}
      <LeagueWeeksWizard
        isOpen={isLeagueWeeksOpen}
        onClose={() => setIsLeagueWeeksOpen(false)}
        onConfirm={handleLeagueWeeksConfirm}
        initialConfig={value.playoffMode?.leagueWeekConfig}
        seasonBounds={seasonBounds}
      />
    </div>
  );
};

export default TimeWindow;