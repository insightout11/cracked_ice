import { useState } from 'react';
import { X, Calendar, ChevronRight } from 'lucide-react';
import { MobileBottomSheet } from '../MobileBottomSheet';
import type { TimeWindowState, TimeWindowPreset, CustomDateRange } from '../../types/timeWindow';

interface MobileTimeWindowSheetProps {
  isOpen: boolean;
  onClose: () => void;
  timeWindow: TimeWindowState;
  onPresetChange: (preset: TimeWindowPreset) => void;
  onCustomRangeChange: (range: CustomDateRange) => void;
}

const PRESETS: { value: TimeWindowPreset; label: string; shortLabel: string }[] = [
  { value: 'rest-of-week', label: 'Rest of Week', shortLabel: 'Week' },
  { value: '7d', label: 'Next 7 Days', shortLabel: '7d' },
  { value: '14d', label: 'Next 14 Days', shortLabel: '14d' },
  { value: '30d', label: 'Next 30 Days', shortLabel: '30d' },
  { value: 'rest-of-season', label: 'Rest of Season', shortLabel: 'ROS' },
  { value: 'season', label: 'Full Season', shortLabel: 'Season' },
];

/**
 * Format a date string to display format
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
function formatDateForInput(dateStr: string): string {
  if (!dateStr) return '';
  // Handle both ISO strings and date-only strings
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

/**
 * MobileTimeWindowSheet - Select analysis time window
 */
export function MobileTimeWindowSheet({
  isOpen,
  onClose,
  timeWindow,
  onPresetChange,
  onCustomRangeChange,
}: MobileTimeWindowSheetProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(() =>
    timeWindow.customRange?.start
      ? formatDateForInput(timeWindow.customRange.start)
      : formatDateForInput(timeWindow.config?.startUtc || '')
  );
  const [customEnd, setCustomEnd] = useState(() =>
    timeWindow.customRange?.end
      ? formatDateForInput(timeWindow.customRange.end)
      : formatDateForInput(timeWindow.config?.endUtc || '')
  );

  const handlePresetSelect = (preset: TimeWindowPreset) => {
    onPresetChange(preset);
    setShowCustom(false);
    onClose();
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onCustomRangeChange({
        start: customStart,
        end: customEnd,
      });
      onClose();
    }
  };

  // Get current range display
  const startDisplay = timeWindow.config?.startUtc
    ? formatDate(timeWindow.config.startUtc)
    : '';
  const endDisplay = timeWindow.config?.endUtc
    ? formatDate(timeWindow.config.endUtc)
    : '';

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['60%']}
      initialSnap={0}
    >
      <div className="px-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Analysis Window</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Current Range Display */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-xs text-slate-400 mb-1">Current Range</div>
              <div className="text-white font-medium">
                {startDisplay && endDisplay
                  ? `${startDisplay} - ${endDisplay}`
                  : 'Not set'}
              </div>
            </div>
          </div>
        </div>

        {!showCustom ? (
          <>
            {/* Preset Options */}
            <div className="mb-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">
                Quick Select
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((preset) => {
                  const isActive = timeWindow.preset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => handlePresetSelect(preset.value)}
                      className={`
                        py-3 px-4 rounded-xl text-sm font-medium transition-all
                        ${isActive
                          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }
                      `}
                    >
                      {preset.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Option */}
            <button
              onClick={() => setShowCustom(true)}
              className={`
                w-full flex items-center justify-between p-4 rounded-xl transition-colors
                ${timeWindow.preset === 'custom'
                  ? 'bg-cyan-600/20 border border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Custom Date Range</span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            {/* Custom Date Picker */}
            <div className="space-y-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">
                Custom Range
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCustomApply}
                  disabled={!customStart || !customEnd}
                  className="flex-1 py-3 px-4 bg-cyan-600 rounded-xl text-white font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </MobileBottomSheet>
  );
}
