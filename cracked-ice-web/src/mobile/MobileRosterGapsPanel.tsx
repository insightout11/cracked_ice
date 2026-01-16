import { useState } from 'react';
import { ChevronDown, ChevronUp, Grid3x3 } from 'lucide-react';
import { format } from 'date-fns';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>;
}

interface TeamRecommendation {
  team: string;
  gapDatesCovered: number;
  gapDates: string[];
}

interface MobileRosterGapsPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  gapDates: GapDate[];
  teamRecommendations?: TeamRecommendation[];
  onBrowseTeamPlayers?: (teamCode: string) => void;
  simulationOptions?: Array<{ value: string; label: string }>;
  selectedSimulation?: string;
  onSimulationChange?: (value: string) => void;
}

/**
 * Mobile Roster Gaps Panel
 *
 * Displays roster gaps as vertical card list instead of table grid
 * Shows only dates with gaps, organized as individual date cards
 */
export function MobileRosterGapsPanel({
  isExpanded,
  onToggle,
  gapDates,
  teamRecommendations = [],
  onBrowseTeamPlayers,
  simulationOptions,
  selectedSimulation,
  onSimulationChange
}: MobileRosterGapsPanelProps) {
  // Filter to only show dates WITH gaps
  const datesWithGaps = gapDates.filter((date) => {
    const total = Object.values(date.unusedSlots).reduce((sum, count) => sum + count, 0);
    return total > 0;
  });

  const totalGapCount = datesWithGaps.length;

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
      {/* Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-5 h-5 text-cyan-400" />
          <div className="text-left">
            <div className="font-bold text-white text-sm">
              Roster Gaps
            </div>
            <div className="text-xs text-slate-400">
              {totalGapCount} date{totalGapCount !== 1 ? 's' : ''} with gaps
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-cyan-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Simulation Dropdown (if provided) */}
          {simulationOptions && simulationOptions.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-2">
                Simulate Dropping:
              </label>
              <select
                value={selectedSimulation || ''}
                onChange={(e) => onSimulationChange?.(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="">None (Current Roster)</option>
                {simulationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Gap Dates Card List */}
          {datesWithGaps.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide px-1">
                Dates with Gaps
              </div>
              {datesWithGaps.map((date) => (
                <MobileGapDateCard key={date.date} date={date} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm">
              No roster gaps found
            </div>
          )}

          {/* Team Recommendations */}
          {teamRecommendations.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide px-1">
                💡 Recommended Teams
              </div>
              <div className="space-y-2">
                {teamRecommendations.slice(0, 5).map((team) => (
                  <MobileTeamRecommendationCard
                    key={team.team}
                    team={team}
                    onBrowsePlayers={onBrowseTeamPlayers}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile Gap Date Card
 * Shows a single date with position badges
 */
function MobileGapDateCard({ date }: { date: GapDate }) {
  const dateObj = new Date(date.date + 'T00:00:00');
  const formattedDate = format(dateObj, 'EEE, MMM d');

  // Calculate total gaps
  const totalSlots = Object.values(date.unusedSlots).reduce((sum, count) => sum + count, 0);

  // Get position entries (only non-zero)
  const positionEntries = Object.entries(date.unusedSlots).filter(([_, count]) => count > 0);

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
      {/* Date Header */}
      <div className="font-semibold text-white text-sm mb-2">
        {formattedDate}
      </div>

      {/* Position Badges Row */}
      <div className="flex flex-wrap gap-2 mb-2">
        {positionEntries.map(([position, count]) => (
          <span
            key={position}
            className="px-2 py-1 bg-orange-500/20 border border-orange-400/40 rounded text-xs font-semibold text-orange-300"
          >
            {position}: {count}
          </span>
        ))}
      </div>

      {/* Total */}
      <div className="text-xs text-slate-400">
        Total: {totalSlots} slot{totalSlots !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/**
 * Mobile Team Recommendation Card
 */
function MobileTeamRecommendationCard({
  team,
  onBrowsePlayers
}: {
  team: TeamRecommendation;
  onBrowsePlayers?: (teamCode: string) => void;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-white text-sm">
          🏒 {team.team}
        </div>
        <div className="text-xs text-green-400 font-semibold">
          Fills {team.gapDatesCovered} gap{team.gapDatesCovered !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Gap Dates */}
      <div className="text-xs text-slate-400 mb-3">
        Dates: {team.gapDates.slice(0, 3).map(d => format(new Date(d + 'T00:00:00'), 'MMM d')).join(', ')}
        {team.gapDates.length > 3 && ` +${team.gapDates.length - 3} more`}
      </div>

      {/* Browse Players Button */}
      {onBrowsePlayers && (
        <button
          onClick={() => onBrowsePlayers(team.team)}
          className="w-full px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-colors"
        >
          Browse Players
        </button>
      )}
    </div>
  );
}
