import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DateRangeDialogProps, CustomDateRange } from '../../types/timeWindow';
import { validateCustomRange, formatDate, DEFAULT_SEASON_BOUNDS } from '../../lib/timeWindow';

export const DateRangeDialog: React.FC<DateRangeDialogProps> = ({
  isOpen,
  onClose,
  initialRange,
  onConfirm,
  seasonBounds = DEFAULT_SEASON_BOUNDS
}) => {
  const [range, setRange] = useState<CustomDateRange>(() => {
    if (initialRange) return initialRange;
    
    // Default to next 14 days
    const today = new Date();
    const seasonStart = seasonBounds.start;
    const baseDate = today < seasonStart ? seasonStart : today;
    const endDate = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    return {
      start: formatDate(baseDate),
      end: formatDate(endDate)
    };
  });

  const [error, setError] = useState<string>('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialRange) {
        setRange(initialRange);
      }
      setError('');
    }
  }, [isOpen, initialRange]);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRange = { ...range, start: e.target.value };
    setRange(newRange);
    
    // Validate on change
    const validation = validateCustomRange(newRange, seasonBounds);
    setError(validation.isValid ? '' : validation.error || '');
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRange = { ...range, end: e.target.value };
    setRange(newRange);
    
    // Validate on change
    const validation = validateCustomRange(newRange, seasonBounds);
    setError(validation.isValid ? '' : validation.error || '');
  };

  const handleConfirm = () => {
    const validation = validateCustomRange(range, seasonBounds);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid date range');
      return;
    }
    
    onConfirm(range);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter') {
      handleConfirm();
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
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg z-[9999]"
            onKeyDown={handleKeyDown}
          >
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                    Custom Date Range
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-4">
                    Choose a time window to rank complements for this period.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={range.start}
                        onChange={handleStartChange}
                        min={formatDate(seasonBounds.start)}
                        max={formatDate(seasonBounds.end)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={range.end}
                        onChange={handleEndChange}
                        min={formatDate(seasonBounds.start)}
                        max={formatDate(seasonBounds.end)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Error message */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-600">
                        {error}
                      </p>
                    </div>
                  )}
                  
                  {/* Info about limits */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-600">
                      📅 Season: {formatDate(seasonBounds.start)} to {formatDate(seasonBounds.end)}
                      <br />
                      📊 Max range: 120 days
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-[#0E1A2B] px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-[#1a2b3d] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirm}
                disabled={!!error}
              >
                Confirm
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

export default DateRangeDialog;