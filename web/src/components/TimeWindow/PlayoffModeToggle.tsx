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
            ? 'bg-accent text-accent-ink border-accent'
            : 'bg-surface-1 text-ink-dim hover:bg-surface-2 border-line'
        }`}
      >
        Regular
      </button>
      <button
        onClick={() => onChange('playoff')}
        className={`px-3 py-1 rounded-r-md text-sm font-medium transition-colors -ml-0.5 border-2 ${
          mode === 'playoff' || mode === 'before-playoffs'
            ? 'bg-accent text-accent-ink border-accent'
            : 'bg-surface-1 text-ink-dim hover:bg-surface-2 border-line'
        }`}
      >
        Playoff
      </button>
    </div>
  );
};

export default PlayoffModeToggle;
