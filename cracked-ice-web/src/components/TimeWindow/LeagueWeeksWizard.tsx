import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WeekStartDay, LeagueWeekConfig, WeekInfo } from '../../types/playoffMode';
import { SeasonBounds } from '../../types/timeWindow';
import { generateSeasonWeeks } from '../../lib/playoffCalculations';
import { DEFAULT_SEASON_BOUNDS } from '../../lib/timeWindow';
import { YahooWeekWarning } from '../YahooWeekWarning';
import { formatWeekRangeWithYahoo } from '../../lib/yahooWeekConversion';

interface LeagueWeeksWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: LeagueWeekConfig) => void;
  initialConfig?: LeagueWeekConfig;
  seasonBounds?: SeasonBounds;
}

export const LeagueWeeksWizard: React.FC<LeagueWeeksWizardProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
  seasonBounds = DEFAULT_SEASON_BOUNDS
}) => {
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>(
    initialConfig?.weekStartDay || 'monday'
  );
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>(
    initialConfig?.selectedWeeks || []
  );
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);

  // Regenerate weeks when week start day changes
  useEffect(() => {
    const generatedWeeks = generateSeasonWeeks(seasonBounds, weekStartDay);
    setWeeks(generatedWeeks);
  }, [weekStartDay, seasonBounds]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setWeekStartDay(initialConfig?.weekStartDay || 'monday');
      setSelectedWeeks(initialConfig?.selectedWeeks || []);
    }
  }, [isOpen, initialConfig]);

  const handleWeekToggle = (weekNumber: number) => {
    setSelectedWeeks(prev => 
      prev.includes(weekNumber)
        ? prev.filter(w => w !== weekNumber)
        : [...prev, weekNumber].sort((a, b) => a - b)
    );
  };

  const handleSelectConsecutiveWeeks = (startWeek: number, count: number) => {
    const consecutive = Array.from({ length: count }, (_, i) => startWeek + i)
      .filter(week => weeks.some(w => w.weekNumber === week));
    setSelectedWeeks(consecutive);
  };

  const handleConfirm = () => {
    if (selectedWeeks.length === 0) {
      return; // Don't confirm if no weeks selected
    }

    const config: LeagueWeekConfig = {
      weekStartDay,
      selectedWeeks
    };

    onConfirm(config);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  const weekStartOptions = [
    { value: 'monday' as const, label: 'Monday' },
    { value: 'sunday' as const, label: 'Sunday' },
    { value: 'saturday' as const, label: 'Saturday' }
  ];

  // Get date range preview
  const previewRange = selectedWeeks.length > 0 ? (() => {
    const firstWeek = weeks.find(w => w.weekNumber === selectedWeeks[0]);
    const lastWeek = weeks.find(w => w.weekNumber === selectedWeeks[selectedWeeks.length - 1]);
    return firstWeek && lastWeek ? {
      start: firstWeek.startDate,
      end: lastWeek.endDate
    } : null;
  })() : null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <div
            className="relative transform overflow-hidden rounded-xl bg-gradient-to-br from-[#061624]/95 via-[#0a1a2e]/95 to-[#0d1f36]/95 backdrop-blur-lg border border-white/10 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl z-[9999]"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold leading-6 text-white mb-4">
                    My League Weeks
                  </h3>

                  <p className="text-sm text-slate-300 mb-4">
                    Pick your league's playoff weeks. Not sure? Use Custom dates or the quick presets.
                    You can change your week start day.
                  </p>

                  {/* Yahoo Week Warning */}
                  <YahooWeekWarning compact className="mb-6" />
                  
                  {/* Week Start Day */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-200 mb-3">
                      Week start day:
                    </label>
                    <div className="flex gap-2">
                      {weekStartOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setWeekStartDay(option.value)}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors border ${
                            weekStartDay === option.value
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Select Options */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-200 mb-3">
                      Quick select:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSelectConsecutiveWeeks(24, 3)}
                        className="px-3 py-1 text-xs rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-400/50"
                        title="Site weeks 24-26, Yahoo weeks 21-23"
                      >
                        {formatWeekRangeWithYahoo(24, 26)}
                      </button>
                      <button
                        onClick={() => handleSelectConsecutiveWeeks(25, 3)}
                        className="px-3 py-1 text-xs rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-400/50"
                        title="Site weeks 25-27, Yahoo weeks 22-24"
                      >
                        {formatWeekRangeWithYahoo(25, 27)}
                      </button>
                      <button
                        onClick={() => handleSelectConsecutiveWeeks(22, 3)}
                        className="px-2 py-1 text-xs rounded-md bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
                        title="Site weeks 22-24, Yahoo weeks 19-21"
                      >
                        {formatWeekRangeWithYahoo(22, 24)}
                      </button>
                    </div>
                  </div>

                  {/* Week Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-200 mb-3">
                      Select your playoff weeks:
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-white/10 rounded-md p-3 bg-black/20">
                      <div className="grid grid-cols-1 gap-2">
                        {weeks.map((week) => (
                          <button
                            key={week.weekNumber}
                            onClick={() => handleWeekToggle(week.weekNumber)}
                            className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              selectedWeeks.includes(week.weekNumber)
                                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                            }`}
                          >
                            {week.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {previewRange && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-400/30 rounded-md">
                      <p className="text-sm text-green-300">
                        <strong>Preview:</strong> {selectedWeeks.length} weeks selected
                        <br />
                        📅 {previewRange.start.toLocaleDateString()} to {previewRange.end.toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* Validation */}
                  {selectedWeeks.length === 0 && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-md">
                      <p className="text-sm text-yellow-300">
                        Please select at least one week
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="bg-black/20 border-t border-white/10 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-cyan-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#0a1a2e] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirm}
                disabled={selectedWeeks.length === 0}
              >
                Apply Weeks
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-white/20 bg-white/5 px-4 py-2 text-base font-medium text-slate-300 shadow-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#0a1a2e] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render modal as a portal to document.body to avoid z-index issues
  return createPortal(modalContent, document.body);
};

export default LeagueWeeksWizard;