import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { MobileGapCard } from '../components/MobileGapCard';
import { MobileTeamChip, MobileTeamChipSkeleton } from '../components/MobileTeamChip';
import type { RosterPlayer } from '../../lib/coachSchemas';
import type { PositionRecommendation } from '../../lib/rosterGapsUtils';
import { countPositionGapDates } from '../../lib/rosterGapsUtils';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>;
}

interface TeamRecommendation {
  team: string;
  gapsFilled: number;
  playersAvailable: number;
}

interface MobileGapsViewProps {
  // Gap data
  gapsByDate: GapDate[];
  teamRecommendations?: TeamRecommendation[];
  isLoading?: boolean;

  // Position-specific recommendations
  positionRecommendations?: Record<string, PositionRecommendation[]>;
  unusedSlotsByDate?: Record<string, Record<string, number>>;
  isLoadingSchedule?: boolean;

  // Simulation
  roster?: RosterPlayer[];
  simulatingWithout?: string | null;
  onSimulateWithout?: (playerId: string | null) => void;

  // Navigation
  onTeamClick?: (team: string) => void;
  onBrowsePlayers?: (team: string, position: string) => void;
  onDateClick?: (date: string) => void;
}

/**
 * MobileGapsView - Roster gaps analysis tab
 *
 * Features:
 * - Summary stats (dates with gaps, total slots)
 * - Expandable gap cards by date
 * - Team recommendations carousel
 * - Simulation dropdown
 */
export function MobileGapsView({
  gapsByDate,
  teamRecommendations = [],
  isLoading = false,
  positionRecommendations,
  unusedSlotsByDate,
  isLoadingSchedule = false,
  roster = [],
  simulatingWithout,
  onSimulateWithout,
  onTeamClick,
  onBrowsePlayers,
  onDateClick,
}: MobileGapsViewProps) {
  // Expanded card state
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [showSimDropdown, setShowSimDropdown] = useState(false);

  // Filter to only dates with gaps
  const datesWithGaps = useMemo(() => {
    return gapsByDate.filter((gd) => {
      const total = Object.values(gd.unusedSlots).reduce((sum, count) => sum + count, 0);
      return total > 0;
    });
  }, [gapsByDate]);

  // Summary stats
  const summary = useMemo(() => {
    const totalSlots = datesWithGaps.reduce((sum, gd) => {
      return sum + Object.values(gd.unusedSlots).reduce((s, c) => s + c, 0);
    }, 0);
    return {
      datesCount: datesWithGaps.length,
      totalSlots,
    };
  }, [datesWithGaps]);

  // Toggle card expansion
  const toggleExpanded = useCallback((date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  // Get simulating player name
  const simulatingPlayer = useMemo(() => {
    if (!simulatingWithout) return null;
    return roster.find((p) => p.id === simulatingWithout);
  }, [simulatingWithout, roster]);

  // No gaps - success state
  if (!isLoading && datesWithGaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <div className="w-20 h-20 rounded-full bg-positive-muted flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-positive" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">No Roster Gaps!</h2>
        <p className="text-ink-dim text-center text-sm">
          Your roster is fully optimized for the selected time period.
          All positions are covered.
        </p>
        {simulatingWithout && (
          <button
            onClick={() => onSimulateWithout?.(null)}
            className="mt-6 px-4 py-2 bg-surface-2 rounded-lg text-accent text-sm font-medium"
          >
            Clear Simulation
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-surface-2 backdrop-blur-md border-b border-line">
        {/* Simulation Dropdown */}
        {roster.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <button
                onClick={() => setShowSimDropdown(!showSimDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-2 rounded-xl border border-line"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-dim">Simulate:</span>
                  <span className="text-sm font-medium text-ink">
                    {simulatingPlayer
                      ? `Without ${simulatingPlayer.full_name}`
                      : 'Current Roster'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-ink-dim transition-transform ${
                    showSimDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {showSimDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-2 rounded-xl border border-line shadow-xl max-h-64 overflow-y-auto z-20">
                  <button
                    onClick={() => {
                      onSimulateWithout?.(null);
                      setShowSimDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm ${
                      !simulatingWithout
                        ? 'bg-accent-muted text-accent'
                        : 'text-ink hover:bg-surface-2'
                    }`}
                  >
                    Current Roster
                  </button>
                  {roster.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => {
                        onSimulateWithout?.(player.id);
                        setShowSimDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm border-t border-line ${
                        simulatingWithout === player.id
                          ? 'bg-accent-muted text-accent'
                          : 'text-ink hover:bg-surface-2'
                      }`}
                    >
                      Without {player.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <div className="flex-1">
            <span className="text-sm font-medium text-ink">
              {summary.datesCount} date{summary.datesCount !== 1 ? 's' : ''} with gaps
            </span>
            <span className="text-ink-dim mx-2">•</span>
            <span className="text-sm text-warning font-bold">
              {summary.totalSlots} total slot{summary.totalSlots !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Team Recommendations */}
        {teamRecommendations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-ink-dim uppercase tracking-wide mb-3">
              Recommended Teams
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {isLoading ? (
                <>
                  <MobileTeamChipSkeleton />
                  <MobileTeamChipSkeleton />
                  <MobileTeamChipSkeleton />
                </>
              ) : (
                teamRecommendations.map((rec) => (
                  <MobileTeamChip
                    key={rec.team}
                    team={rec.team}
                    gapsFilled={rec.gapsFilled}
                    totalGaps={summary.totalSlots}
                    playersAvailable={rec.playersAvailable}
                    onClick={() => onTeamClick?.(rec.team)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Best Teams by Position */}
        {datesWithGaps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-ink-dim uppercase tracking-wide mb-3">
              Best Teams by Position
            </h3>
            {isLoadingSchedule ? (
              <div className="bg-surface-2 rounded-xl border border-line p-4">
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i}>
                      <div className="h-4 bg-surface-2 rounded w-16 mb-2" />
                      <div className="flex gap-2">
                        <div className="h-9 bg-surface-2 rounded-lg w-20" />
                        <div className="h-9 bg-surface-2 rounded-lg w-20" />
                        <div className="h-9 bg-surface-2 rounded-lg w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : positionRecommendations && Object.keys(positionRecommendations).length > 0 ? (
              <div className="space-y-4">
                {(['C', 'LW', 'RW', 'D', 'G'] as const).map(position => {
                  const recs = positionRecommendations[position];
                  if (!recs || recs.length === 0) return null;

                  const gapDateCount = unusedSlotsByDate
                    ? countPositionGapDates(unusedSlotsByDate, position)
                    : recs[0]?.gapDates.length ?? 0;

                  return (
                    <div key={position}>
                      {/* Position header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-ink bg-accent-muted border border-accent px-2 py-0.5 rounded">
                          {position}
                        </span>
                        <span className="text-[11px] text-ink-dim">
                          {gapDateCount} gap date{gapDateCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Horizontal scroll of team chips */}
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
                        {recs.slice(0, 5).map((rec) => (
                          <button
                            key={rec.team}
                            onClick={() => onBrowsePlayers?.(rec.team, position)}
                            className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-lg border border-line hover:border-accent active:bg-surface-2 transition-colors flex-shrink-0"
                          >
                            <img
                              src={getTeamLogoUrl(rec.team)}
                              alt={rec.team}
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.opacity = '0.3';
                              }}
                            />
                            <span className="text-xs font-bold text-ink">{rec.team}</span>
                            <span className="px-1.5 py-0.5 bg-accent-muted rounded text-[10px] font-bold text-accent">
                              {rec.gapDatesCovered}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-ink-dim text-xs">
                No position-specific recommendations available
              </div>
            )}
          </div>
        )}

        {/* Gap Cards by Date */}
        <div>
          <h3 className="text-xs font-bold text-ink-dim uppercase tracking-wide mb-3">
            Gaps by Date
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-surface-2 rounded-xl border border-line p-4 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-4 bg-surface-2 rounded w-24 mb-2" />
                      <div className="flex gap-2">
                        <div className="h-5 bg-surface-2 rounded w-12" />
                        <div className="h-5 bg-surface-2 rounded w-12" />
                      </div>
                    </div>
                    <div className="h-8 bg-surface-2 rounded w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            datesWithGaps.map((gapDate) => (
              <MobileGapCard
                key={gapDate.date}
                gapDate={gapDate}
                isExpanded={expandedDates.has(gapDate.date)}
                onToggle={() => toggleExpanded(gapDate.date)}
              />
            ))
          )}
        </div>

        {/* Bottom padding for safe area */}
        <div className="h-20" />
      </div>
    </div>
  );
}
