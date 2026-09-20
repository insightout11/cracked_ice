import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { MobileGapCard } from '../components/MobileGapCard';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { structuralVacancyApplies, type ScheduleOpportunityRecommendation } from '../../lib/rosterOpportunities';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>;
}

interface MobileGapsViewProps {
  // Gap data
  gapsByDate: GapDate[];
  isLoading?: boolean;

  // Position-specific recommendations
  positionRecommendations?: Record<string, ScheduleOpportunityRecommendation[]>;
  unusedSlotsByDate?: Record<string, Record<string, number>>;
  isLoadingSchedule?: boolean;
  dataError?: string | null;
  simulationError?: string | null;

  // Simulation
  roster?: RosterPlayer[];
  simulatingWithout?: string | null;
  unfilledActiveSlots?: Record<string, number>;
  unfilledBenchSlots?: number;
  onSimulateWithout?: (playerId: string | null) => void;

  // Navigation
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
  isLoading = false,
  positionRecommendations,
  unusedSlotsByDate,
  isLoadingSchedule = false,
  dataError = null,
  simulationError = null,
  roster = [],
  simulatingWithout,
  unfilledActiveSlots = {},
  unfilledBenchSlots = 0,
  onSimulateWithout,
  onBrowsePlayers,
  onDateClick,
}: MobileGapsViewProps) {
  // Expanded card state
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
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

  if (!isLoading && (dataError || (simulationError && datesWithGaps.length === 0))) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-negative-muted">
          <AlertTriangle className="h-10 w-10 text-negative" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-ink">Gap analysis unavailable</h2>
        <p className="text-center text-sm text-ink-dim">{dataError ?? simulationError}</p>
        <p className="mt-2 text-center text-xs text-ink-mute">No optimized-roster claim is made until the lineup calculation succeeds.</p>
      </div>
    );
  }

  if (!isLoading && roster.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent-muted">
          <Users className="h-10 w-10 text-accent" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-ink">Build your roster first</h2>
        <p className="max-w-xs text-center text-sm text-ink-dim">Add players in the Players tab, then Cracked Ice can find uncovered lineup slots and schedule opportunities.</p>
        <button type="button" onClick={() => onBrowsePlayers?.('', '')} className="mt-6 min-h-11 rounded-xl bg-accent px-5 font-semibold text-surface-0">Browse players</button>
      </div>
    );
  }

  // No gaps - success state
  if (!isLoading && datesWithGaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <div className="w-20 h-20 rounded-full bg-positive-muted flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-positive" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">No Open Lineup Capacity</h2>
        <p className="text-ink-dim text-center text-sm">
          Your current team schedules can cover every active slot in the selected period.
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
              {summary.datesCount} date{summary.datesCount !== 1 ? 's' : ''} with open capacity
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
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent-muted/20 p-3 text-xs text-ink-dim">
          <strong className="text-accent">Schedule only.</strong> NHL team dates, player eligibility and lineup slots are used. Projected games and estimated goalie starts are not.
        </div>
        {Object.keys(unfilledActiveSlots).length > 0 && <div className="mb-4 rounded-xl border border-warning/50 bg-warning-muted/20 p-3 text-xs text-ink-dim">
          <strong className="text-warning">Open active slots:</strong>{' '}{Object.entries(unfilledActiveSlots).map(([slot, count]) => `${slot} ×${count}`).join(' · ')}. Fill these before using team rankings as bench or streaming advice.
        </div>}
        {unfilledBenchSlots > 0 && <div className="mb-4 rounded-xl border border-line bg-surface-1 p-3 text-xs text-ink-dim">
          <strong className="text-ink">{unfilledBenchSlots} bench spot{unfilledBenchSlots === 1 ? '' : 's'} still empty.</strong>{' '}
          These totals are a current-roster snapshot and will usually shrink as those spots are filled.
        </div>}
        {simulationError && (
          <div className="mb-4 rounded-xl border border-negative bg-negative-muted p-3 text-sm text-negative" role="alert">
            {simulationError} Showing the current-roster gaps instead.
          </div>
        )}
        {/* Best Teams by Position */}
        {datesWithGaps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold text-ink-dim uppercase tracking-wide mb-3">
              Schedule openings by position
            </h3>
            <p className="mb-3 text-xs text-ink-mute">Best fit is first and worst is last. Goalies use schedule overlap only; this does not predict which goalie starts.</p>
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
                {['C', 'LW', 'RW', 'F', 'D', 'G'].map(position => {
                  const recs = positionRecommendations[position];
                  if (!recs || recs.length === 0) return null;
                  const allTeamsTied = recs.every((recommendation) => recommendation.addedOpportunities === recs[0].addedOpportunities);
                  const isStructuralVacancy = structuralVacancyApplies(position, unfilledActiveSlots);
                  const visibleRecommendations = expandedPositions.has(position) ? recs : recs.slice(0, 3);

                  return (
                    <div key={position}>
                      {/* Position header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-ink bg-accent-muted border border-accent px-2 py-0.5 rounded">
                          {position}
                        </span>
                        <span className="text-[11px] text-ink-dim">
                          {allTeamsTied && isStructuralVacancy
                            ? `Vacant slot—not a schedule edge. Every team adds ${recs[0].addedOpportunities}.`
                            : 'Potential openings with this roster'}
                        </span>
                      </div>

                      {/* Horizontal scroll of team chips */}
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
                        {visibleRecommendations.map((rec) => {
                          const recommendationIndex = recs.indexOf(rec);
                          const fitLabel = recommendationIndex === 0 ? 'Best' : recommendationIndex === recs.length - 1 ? 'Worst' : null;
                          const overlapLabel = position === 'G'
                            ? `${rec.blockedGames} overlap · ${rec.standaloneGames} neither goalie team`
                            : `${rec.blockedGames} lineup-full · ${rec.standaloneGames} no current ${position} team`;
                          return (
                          <button
                            key={rec.team}
                            onClick={() => onBrowsePlayers?.(rec.team, position)}
                            className="flex min-w-36 flex-col gap-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-accent active:bg-surface-2"
                          >
                            <span className="flex w-full items-center gap-2"><img src={getTeamLogoUrl(rec.team)} alt={rec.team} className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} /><span className="text-xs font-bold text-ink">{rec.team}</span>{fitLabel && <span className="text-[9px] font-semibold text-ink-dim">{fitLabel}</span>}<span className="ml-auto rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-bold text-accent">{rec.addedOpportunities}</span></span>
                            <span className="text-[10px] text-ink-mute">{rec.teamGames} games · {overlapLabel}</span>
                          </button>
                          );
                        })}
                      </div>
                      {recs.length > 3 && <button type="button" onClick={() => setExpandedPositions((current) => {
                        const next = new Set(current);
                        if (next.has(position)) next.delete(position); else next.add(position);
                        return next;
                      })} className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-xs font-semibold text-accent">
                        {expandedPositions.has(position) ? 'Show top 3 teams' : `View all ${recs.length} teams`}
                      </button>}
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
