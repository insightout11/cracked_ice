import { useState, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { MobileBottomSheet } from '../MobileBottomSheet';

export interface PlayerFilters {
  positions: string[];
  teams: string[];
  availability: ('fa' | 'owned' | 'waivers')[];
  sortBy: 'ice' | 'fppg' | 'goals' | 'assists' | 'points' | 'name';
  sortOrder: 'asc' | 'desc';
}

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PlayerFilters;
  onApply: (filters: PlayerFilters) => void;
  availableTeams?: string[];
}

const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];

const AVAILABILITY_OPTIONS = [
  { value: 'fa' as const, label: 'Free Agent', color: 'text-positive bg-positive-muted' },
  { value: 'owned' as const, label: 'Owned', color: 'text-negative bg-negative-muted' },
  { value: 'waivers' as const, label: 'Waivers', color: 'text-warning bg-warning-muted' },
];

const SORT_OPTIONS = [
  { value: 'ice' as const, label: 'ICE rating' },
  { value: 'fppg' as const, label: 'FPPG' },
  { value: 'goals' as const, label: 'Goals' },
  { value: 'assists' as const, label: 'Assists' },
  { value: 'points' as const, label: 'Points' },
  { value: 'name' as const, label: 'Name' },
];

/**
 * MobileFilterSheet - Advanced player filters
 *
 * Features:
 * - Multi-select position filter
 * - Multi-select team filter
 * - Availability filter
 * - Sort by with order toggle
 * - Apply/Clear actions
 */
export function MobileFilterSheet({
  isOpen,
  onClose,
  filters,
  onApply,
  availableTeams = [],
}: MobileFilterSheetProps) {
  // Local state for editing
  const [localFilters, setLocalFilters] = useState<PlayerFilters>(filters);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Reset local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Toggle position
  const togglePosition = (pos: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      positions: prev.positions.includes(pos)
        ? prev.positions.filter((p) => p !== pos)
        : [...prev.positions, pos],
    }));
  };

  // Toggle team
  const toggleTeam = (team: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      teams: prev.teams.includes(team)
        ? prev.teams.filter((t) => t !== team)
        : [...prev.teams, team],
    }));
  };

  // Toggle availability
  const toggleAvailability = (avail: 'fa' | 'owned' | 'waivers') => {
    setLocalFilters((prev) => ({
      ...prev,
      availability: prev.availability.includes(avail)
        ? prev.availability.filter((a) => a !== avail)
        : [...prev.availability, avail],
    }));
  };

  // Set sort
  const setSort = (sortBy: PlayerFilters['sortBy']) => {
    setLocalFilters((prev) => ({
      ...prev,
      sortBy,
      // Toggle order if same sort selected
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Clear all
  const clearAll = () => {
    setLocalFilters({
      positions: [],
      teams: [],
      availability: [],
      sortBy: 'ice',
      sortOrder: 'desc',
    });
  };

  // Apply and close
  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  // Check if any filters are active
  const hasActiveFilters =
    localFilters.positions.length > 0 ||
    localFilters.teams.length > 0 ||
    localFilters.availability.length > 0;

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['70%', '90%']}
      initialSnap={0}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 bg-surface-2 border-b border-line px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Filters</h2>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="px-3 py-1.5 text-sm text-ink-dim hover:text-ink"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-2"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-ink-dim" />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Position Filter */}
          <div>
            <h3 className="text-sm font-bold text-ink mb-3">Positions</h3>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((pos) => {
                const isSelected = localFilters.positions.includes(pos);
                return (
                  <button
                    key={pos}
                    onClick={() => togglePosition(pos)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent text-ink'
                        : 'bg-surface-2 text-ink-dim hover:bg-surface-2'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team Filter */}
          <div>
            <h3 className="text-sm font-bold text-ink mb-3">Teams</h3>
            <button
              onClick={() => setShowTeamPicker(!showTeamPicker)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface-2 rounded-xl border border-line"
            >
              <span className="text-sm text-ink">
                {localFilters.teams.length === 0
                  ? 'All Teams'
                  : `${localFilters.teams.length} team${localFilters.teams.length !== 1 ? 's' : ''} selected`}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-ink-dim transition-transform ${
                  showTeamPicker ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Team Picker Grid */}
            {showTeamPicker && (
              <div className="mt-3 grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {availableTeams.map((team) => {
                  const isSelected = localFilters.teams.includes(team);
                  return (
                    <button
                      key={team}
                      onClick={() => toggleTeam(team)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-accent text-ink'
                          : 'bg-surface-2 text-ink-dim hover:bg-surface-2'
                      }`}
                    >
                      {team}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Teams Display */}
            {localFilters.teams.length > 0 && !showTeamPicker && (
              <div className="flex flex-wrap gap-2 mt-2">
                {localFilters.teams.map((team) => (
                  <span
                    key={team}
                    className="px-2 py-1 bg-accent-muted text-accent text-xs rounded-full font-medium flex items-center gap-1"
                  >
                    {team}
                    <button
                      onClick={() => toggleTeam(team)}
                      className="hover:text-ink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Availability Filter */}
          <div>
            <h3 className="text-sm font-bold text-ink mb-3">Availability</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_OPTIONS.map((opt) => {
                const isSelected = localFilters.availability.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleAvailability(opt.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? opt.color
                        : 'bg-surface-2 text-ink-dim hover:bg-surface-2'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <h3 className="text-sm font-bold text-ink mb-3">Sort By</h3>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = localFilters.sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent-muted border border-accent text-accent'
                        : 'bg-surface-2 text-ink-dim hover:bg-surface-2 border border-transparent'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="text-xs">
                        {localFilters.sortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <div className="sticky bottom-0 bg-surface-2 border-t border-line px-4 py-4 safe-area-bottom">
          <button
            onClick={handleApply}
            className="w-full py-4 bg-accent rounded-xl text-ink font-semibold text-base hover:bg-accent active:bg-accent transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

/**
 * Default empty filters
 */
export const defaultFilters: PlayerFilters = {
  positions: [],
  teams: [],
  availability: [],
  sortBy: 'ice',
  sortOrder: 'desc',
};
