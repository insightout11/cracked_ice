import React, { useState } from 'react';
import { TimeWindowState, CustomDateRange, SeasonBounds, TimeWindowPreset, TimeWindowMode } from '../../types/timeWindow';
import { PlayoffPreset, LeagueWeekConfig } from '../../types/playoffMode';
import { getPresetOptions } from '../../lib/timeWindow';
import { getPlayoffPresetOptions } from '../../lib/playoffCalculations';
import { IceDropdown, DropdownOption } from '../IceDropdown';
import { DateRangeDialog } from './DateRangeDialog';
import { PlayoffModeToggle } from './PlayoffModeToggle';
import { LeagueWeeksWizard } from './LeagueWeeksWizard';

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
      {/* Single horizontal line with all controls */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Mode Toggle + Dropdown/Button - all inline */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          {showModeToggle && (
            <PlayoffModeToggle
              mode={value.mode}
              onChange={onModeChange}
            />
          )}

          {value.mode === 'regular' ? (
            <>
              {/* Regular Mode - Dropdown */}
              <IceDropdown
                options={dropdownOptions}
                value={value.preset}
                onChange={handlePresetChange}
                placeholder="Select time window"
                aria-label="Select analysis time window"
              />
            </>
          ) : (
            <>
              {/* Playoff Mode - My League Weeks */}
              <button
                onClick={() => setIsLeagueWeeksOpen(true)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors border ${
                  value.playoffMode?.preset === 'league-weeks'
                    ? 'bg-accent-muted text-accent border-accent'
                    : 'bg-surface-1 text-ink-dim hover:bg-surface-2 border-line'
                }`}
              >
                My League Weeks
              </button>
            </>
          )}
        </div>

        {/* Show error if any */}
        {value.error && (
          <p className="text-sm text-negative">
            {value.error}
          </p>
        )}
      </div>

        {/* Mobile View - Pill Toggles */}
        <div className="block sm:hidden">
          {value.mode === 'regular' ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {presetOptions.slice(0, 6).map((option) => (
                <button
                  key={option.value}
                  onClick={() => onPresetChange(option.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    value.preset === option.value
                      ? 'bg-accent-muted text-accent border-accent'
                      : 'bg-surface-2 text-ink-dim hover:bg-surface-2 border-line'
                  } border`}
                >
                  {option.label === 'Rest of week' ? 'Week' :
                   option.label === 'Next 7 days' ? '7d' :
                   option.label === 'Next 14 days' ? '14d' :
                   option.label === 'Next 30 days' ? '30d' :
                   option.label === 'Rest of season' ? 'ROS' :
                   option.label === 'Full season' ? 'Season' : option.label}
                </button>
              ))}
              <button
                onClick={() => setIsDatePickerOpen(true)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  value.preset === 'custom'
                    ? 'bg-accent-muted text-accent border-accent'
                    : 'bg-surface-2 text-ink-dim hover:bg-surface-2 border-line'
                } border`}
              >
                Custom
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setIsLeagueWeeksOpen(true)}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    value.playoffMode?.preset === 'league-weeks'
                      ? 'bg-accent-muted text-accent border-accent'
                      : 'bg-surface-2 text-ink-dim hover:bg-surface-2 border-line'
                  } border`}
                >
                  My Weeks
                </button>
              </div>
          )}

          {/* Show error if any */}
          {value.error && (
            <p className="text-sm text-negative mb-2">
              {value.error}
            </p>
          )}
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
