import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WeekStartDay, LeagueWeekConfig, WeekInfo } from '../../types/playoffMode';
import { SeasonBounds } from '../../types/timeWindow';
import { generateSeasonWeeks } from '../../lib/playoffCalculations';
import { DEFAULT_SEASON_BOUNDS } from '../../lib/timeWindow';

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
        className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
        onClick={handleCancel}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <div 
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl z-[9999]"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    My League Weeks
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-6">
                    Pick your league's playoff weeks. Not sure? Use Custom dates or the quick presets. 
                    You can change your week start day.
                  </p>
                  
                  {/* Week Start Day */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Week start day:
                    </label>
                    <div className="flex gap-2">
                      {weekStartOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setWeekStartDay(option.value)}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors border ${
                            weekStartDay === option.value
                              ? 'bg-blue-100 text-[#0E1A2B] border-blue-300'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Select Options */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Quick select:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSelectConsecutiveWeeks(22, 3)}
                        className="px-3 py-1 text-xs rounded-md bg-blue-100 text-[#0E1A2B] hover:bg-blue-200 border border-blue-300"
                      >
                        Weeks 22-24 (3-week)
                      </button>
                      <button
                        onClick={() => handleSelectConsecutiveWeeks(23, 3)}
                        className="px-3 py-1 text-xs rounded-md bg-blue-100 text-[#0E1A2B] hover:bg-blue-200 border border-blue-300"
                      >
                        Weeks 23-25 (3-week)
                      </button>
                    </div>
                  </div>

                  {/* Week Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select your playoff weeks:
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                      <div className="grid grid-cols-1 gap-2">
                        {weeks.map((week) => (
                          <button
                            key={week.weekNumber}
                            onClick={() => handleWeekToggle(week.weekNumber)}
                            className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              selectedWeeks.includes(week.weekNumber)
                                ? 'bg-blue-100 text-[#0E1A2B] border border-blue-300'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
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
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-600">
                        <strong>Preview:</strong> {selectedWeeks.length} weeks selected
                        <br />
                        📅 {previewRange.start.toLocaleDateString()} to {previewRange.end.toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* Validation */}
                  {selectedWeeks.length === 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-600">
                        Please select at least one week
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-[#0E1A2B] px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-[#1a2b3d] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirm}
                disabled={selectedWeeks.length === 0}
              >
                Apply Weeks
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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