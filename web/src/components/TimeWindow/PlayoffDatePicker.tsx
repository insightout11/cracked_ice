import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SeasonBounds } from '../../types/timeWindow';
import { DEFAULT_SEASON_BOUNDS, formatDate } from '../../lib/timeWindow';

interface PlayoffDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
  initialDate?: string;
  seasonBounds?: SeasonBounds;
}

export const PlayoffDatePicker: React.FC<PlayoffDatePickerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
  seasonBounds = DEFAULT_SEASON_BOUNDS
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || '');
  const [error, setError] = useState<string>('');

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(initialDate || '');
      setError('');
    }
  }, [isOpen, initialDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);

    // Validate date
    if (newDate) {
      const date = new Date(newDate);
      if (date < seasonBounds.start || date > seasonBounds.end) {
        setError('Date must be within the season bounds');
      } else {
        setError('');
      }
    } else {
      setError('');
    }
  };

  const handleConfirm = () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    if (error) {
      return;
    }

    onConfirm(selectedDate);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleClear = () => {
    setSelectedDate('');
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

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
            className="relative transform overflow-hidden rounded-lg bg-[#0a1628] border border-white/20 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg z-[9999]"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div className="bg-[#0a1628] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-[var(--ci-white)] mb-4">
                    Playoff Start Date
                  </h3>

                  <p className="text-sm text-[var(--ci-muted)] mb-6">
                    Select when your league's playoffs begin. This helps the site show playoff-relevant data when you need it.
                  </p>

                  {/* Date Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[var(--ci-white)] mb-3">
                      Playoff Start Date:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      min={formatDate(seasonBounds.start)}
                      max={formatDate(seasonBounds.end)}
                      className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded-lg text-[var(--ci-white)] focus:outline-none focus:border-[var(--laser-cyan)] focus:ring-1 focus:ring-[var(--laser-cyan)]"
                    />
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[var(--ci-white)] mb-3">
                      Quick select:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const date = new Date('2025-03-17');
                          setSelectedDate(formatDate(date));
                          setError('');
                        }}
                        className="px-3 py-1 text-sm rounded-md bg-[var(--laser-cyan)]/20 text-[var(--laser-cyan)] hover:bg-[var(--laser-cyan)]/30 border border-[var(--laser-cyan)]/30"
                      >
                        Week 24 (Mar 17)
                      </button>
                      <button
                        onClick={() => {
                          const date = new Date('2025-03-24');
                          setSelectedDate(formatDate(date));
                          setError('');
                        }}
                        className="px-3 py-1 text-sm rounded-md bg-[var(--laser-cyan)]/20 text-[var(--laser-cyan)] hover:bg-[var(--laser-cyan)]/30 border border-[var(--laser-cyan)]/30"
                      >
                        Week 25 (Mar 24)
                      </button>
                      <button
                        onClick={() => {
                          const date = new Date('2025-03-31');
                          setSelectedDate(formatDate(date));
                          setError('');
                        }}
                        className="px-3 py-1 text-sm rounded-md bg-[var(--laser-cyan)]/20 text-[var(--laser-cyan)] hover:bg-[var(--laser-cyan)]/30 border border-[var(--laser-cyan)]/30"
                      >
                        Week 26 (Mar 31)
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  {selectedDate && !error && (
                    <div className="mb-4 p-3 bg-[var(--laser-cyan)]/10 border border-[var(--laser-cyan)]/30 rounded-md">
                      <p className="text-sm text-[var(--laser-cyan)]">
                        <strong>Selected:</strong> {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  {/* Error message */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                      <p className="text-sm text-red-400">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Info about season */}
                  <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-md">
                    <p className="text-sm text-[var(--ci-muted)]">
                      📅 Season: {seasonBounds.start.toLocaleDateString()} to {seasonBounds.end.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="bg-black/30 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-white/10">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-[var(--laser-cyan)] px-4 py-2 text-base font-medium text-black shadow-sm hover:bg-[var(--laser-cyan)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--laser-cyan)] focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirm}
                disabled={!!error || !selectedDate}
              >
                Apply Date
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-white/20 bg-black/30 px-4 py-2 text-base font-medium text-[var(--ci-white)] shadow-sm hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-[var(--laser-cyan)] focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={handleClear}
              >
                Clear
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-white/20 bg-black/30 px-4 py-2 text-base font-medium text-[var(--ci-white)] shadow-sm hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-[var(--laser-cyan)] focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
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

export default PlayoffDatePicker;
