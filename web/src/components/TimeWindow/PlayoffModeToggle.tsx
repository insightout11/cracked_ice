import React from 'react';
import { TimeWindowMode } from '../../types/timeWindow';

interface PlayoffModeToggleProps {
  mode: TimeWindowMode;
  onChange: (mode: TimeWindowMode) => void;
  className?: string;
}

export const PlayoffModeToggle: React.FC<PlayoffModeToggleProps> = ({
  mode,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-1 mb-3 ${className}`}>
      <button
        onClick={() => onChange('regular')}
        className={`px-3 py-1 rounded-l-md text-sm font-medium transition-colors border ${
          mode === 'regular'
            ? 'bg-[#0E1A2B] text-white border-[#0E1A2B]'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
      >
        Full Season
      </button>
      <button
        onClick={() => onChange('before-playoffs')}
        className={`px-3 py-1 text-sm font-medium transition-colors border-l-0 border ${
          mode === 'before-playoffs'
            ? 'bg-[#0E1A2B] text-white border-[#0E1A2B]'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
      >
        Before Playoffs
      </button>
      <button
        onClick={() => onChange('playoff')}
        className={`px-3 py-1 rounded-r-md text-sm font-medium transition-colors border-l-0 border ${
          mode === 'playoff'
            ? 'bg-[#0E1A2B] text-white border-[#0E1A2B]'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
      >
        Playoff Weeks
      </button>
    </div>
  );
};

export default PlayoffModeToggle;