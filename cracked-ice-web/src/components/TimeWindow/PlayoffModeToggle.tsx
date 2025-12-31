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
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => onChange('regular')}
        className={`px-3 py-1 rounded-l-md text-sm font-medium transition-colors border-2 ${
          mode === 'regular'
            ? 'bg-[#0E1A2B] text-white border-cyan-400'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
      >
        Regular
      </button>
      <button
        onClick={() => onChange('playoff')}
        className={`px-3 py-1 rounded-r-md text-sm font-medium transition-colors -ml-0.5 border-2 ${
          mode === 'playoff' || mode === 'before-playoffs'
            ? 'bg-[#0E1A2B] text-white border-cyan-400'
            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
        }`}
      >
        Playoff
      </button>
    </div>
  );
};

export default PlayoffModeToggle;