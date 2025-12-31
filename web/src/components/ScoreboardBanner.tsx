import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPrevWeekIso, getNextWeekIso, getWeekOptions, type SortMode } from '../lib/schedule';
import { IceDropdown } from './IceDropdown';

interface ScoreboardBannerProps {
  weekIso: string;
  onWeekChange: (iso: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

export function ScoreboardBanner({ weekIso, onWeekChange, sortMode, onSortChange }: ScoreboardBannerProps) {
  const weekOptions = getWeekOptions();

  const sortOptions = [
    { value: 'alphabetical', label: 'Alphabetical' },
    { value: 'best', label: 'Best Schedule First' },
    { value: 'worst', label: 'Worst Schedule First' }
  ];

  const handlePrevWeek = () => {
    onWeekChange(getPrevWeekIso(weekIso));
  };

  const handleNextWeek = () => {
    onWeekChange(getNextWeekIso(weekIso));
  };

  const handleWeekSelect = (value: string | number) => {
    onWeekChange(String(value));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4">
      <div className={`
        rounded-2xl
        bg-gradient-to-br from-[#061624]/90 via-[#0a1a2e]/90 to-[#0d1f36]/90
        border border-white/6
        shadow-[0_18px_40px_rgba(0,0,0,0.45)]
        backdrop-blur-lg
        px-4 lg:px-6 py-2
      `}>
        {/* Main Header Row */}
        <div className="flex items-center justify-between gap-2 lg:gap-3 flex-wrap">
          {/* Left: Title */}
          <div className="flex items-baseline gap-1.5 lg:gap-2 flex-shrink-0">
            <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] lg:tracking-[0.18em] text-sky-300/70">
              Schedule
            </span>
            <span className="text-lg lg:text-xl font-semibold text-white">
              Viewer
            </span>
          </div>

          {/* Center: Week Controls */}
          <div className="flex items-center gap-2 order-3 lg:order-2 w-full lg:w-auto justify-center lg:justify-start">
            {/* Previous Week Arrow */}
            <button
              onClick={handlePrevWeek}
              className="p-1 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3 h-3 text-cyan-400" />
            </button>

            {/* Week Dropdown */}
            <div style={{ minWidth: '200px' }}>
              <IceDropdown
                options={weekOptions}
                value={weekIso}
                onChange={handleWeekSelect}
                placeholder="Pick week"
                aria-label="Select week"
              />
            </div>

            {/* Next Week Arrow */}
            <button
              onClick={handleNextWeek}
              className="p-1 rounded bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-3 h-3 text-cyan-400" />
            </button>
          </div>

          {/* Right: Sort Controls */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 order-2 lg:order-3">
            <span className="text-xs lg:text-sm font-medium uppercase tracking-[0.12em] text-sky-300/70 hidden sm:inline">
              Sort:
            </span>
            <div style={{ minWidth: '180px' }}>
              <IceDropdown
                options={sortOptions}
                value={sortMode}
                onChange={(value) => onSortChange(value as SortMode)}
                placeholder="Sort by"
                aria-label="Sort teams"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}