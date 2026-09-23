import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { MobileGapCard } from '../components/MobileGapCard';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { getScheduleFitLabel, structuralVacancyApplies, type ScheduleOpportunityRecommendation } from '../../lib/rosterOpportunities';
import { getTeamLogoUrl } from '../../lib/teamLogos';
import type { ScheduleFitBrowseContext } from '../../components/RosterGapsPanel';

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
  isWeeklyLocking?: boolean;
  baselineOpenSlotOpportunities?: number;
  currentOpenSlotOpportunities?: number;
  onRetrySchedule?: () => void;

  // Simulation
  roster?: RosterPlayer[];
  simulatingWithout?: string | null;
  unfilledActiveSlots?: Record<string, number>;
  unfilledBenchSlots?: number;
  onSimulateWithout?: (playerId: string | null) => void;

  // Navigation
  onBrowsePlayers?: (team: string, position: string, context?: ScheduleFitBrowseContext) => void;
  onDateClick?: (date: string) => void;
  windowStart?: string;
  windowEnd?: string;
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
  isWeeklyLocking = false,
  baselineOpenSlotOpportunities = 0,
  currentOpenSlotOpportunities = 0,
  onRetrySchedule,
  roster = [],
  simulatingWithout,
  unfilledActiveSlots = {},
  unfilledBenchSlots = 0,
  onSimulateWithout,
  onBrowsePlayers,
  onDateClick,
  windowStart,
  windowEnd,
}: MobileGapsViewProps) {
  // Expanded card state
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [selectedPosition, setSelectedPosition] = useState('D');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showAllTeams, setShowAllTeams] = useState(false);
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

  const availablePositions = useMemo(() => ['C', 'LW', 'RW', 'F', 'D', 'G']
    .filter((position) => (positionRecommendations?.[position]?.length ?? 0) > 0), [positionRecommendations]);

  const activePosition = availablePositions.includes(selectedPosition) ? selectedPosition : (availablePositions[0] ?? selectedPosition);
  const activeRecommendations = positionRecommendations?.[activePosition] ?? [];
  const visibleRecommendations = showAllTeams ? activeRecommendations : activeRecommendations.slice(0, 5);

  if (isWeeklyLocking) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-warning-muted"><AlertTriangle className="h-10 w-10 text-warning" /></div>
        <h2 className="mb-2 text-center text-xl font-bold text-ink">Weekly lineup schedule fit is not available yet</h2>
        <p className="max-w-sm text-center text-sm text-ink-dim">Daily reassignment would overstate opportunities in a weekly-lock league, so Cracked Ice is withholding those recommendations until weekly assignment is supported.</p>
      </div>
    );
  }

  if (!isLoading && (dataError || (simulationError && datesWithGaps.length === 0))) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-negative-muted">
          <AlertTriangle className="h-10 w-10 text-negative" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-ink">Gap analysis unavailable</h2>
        <p className="text-center text-sm text-ink-dim">{dataError ?? simulationError}</p>
        <p className="mt-2 text-center text-xs text-ink-mute">No optimized-roster claim is made until the lineup calculation succeeds.</p>
        {dataError && onRetrySchedule ? <button type="button" onClick={onRetrySchedule} className="mt-5 min-h-11 rounded-xl border border-negative px-5 font-semibold text-negative">Retry schedule</button> : null}
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
                  <span className="text-xs text-ink-dim">Compare:</span>
                  <span className="text-sm font-medium text-ink">
                    {simulatingPlayer
                      ? `Without ${simulatingPlayer.full_name}`
                      : 'Current roster'}
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
                    Current roster
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
        {simulatingPlayer ? <div className="px-4 pb-3 text-xs text-ink-dim"><strong className="text-ink">{baselineOpenSlotOpportunities}</strong> current open slot-games → <strong className="text-warning">{currentOpenSlotOpportunities}</strong> without {simulatingPlayer.full_name} ({currentOpenSlotOpportunities - baselineOpenSlotOpportunities >= 0 ? '+' : ''}{currentOpenSlotOpportunities - baselineOpenSlotOpportunities})</div> : null}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 rounded-xl border border-line bg-surface-1 p-3 text-sm text-ink-dim">
          <strong className="text-ink">Which team’s schedule fits the next player you add?</strong><br />An opening is one additional player-game your legal active lineup can hold. It is not a projected start, available-player guarantee, or quality rating.
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
        {/* Team comparison by position */}
        {datesWithGaps.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-dim">Team comparison</h3>
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
            ) : availablePositions.length > 0 ? (
              <div>
                <div className="mb-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Position to add">
                  {availablePositions.map((position) => <button type="button" role="tab" aria-selected={activePosition === position} key={position} onClick={() => { setSelectedPosition(position); setExpandedTeam(null); setShowAllTeams(false); }} className={`min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold ${activePosition === position ? 'bg-accent text-surface-0' : 'border border-line text-ink-dim'}`}>{position}</button>)}
                </div>
                {structuralVacancyApplies(activePosition, unfilledActiveSlots) ? <p className="mb-3 rounded-lg bg-warning-muted/20 p-3 text-xs text-ink-dim"><strong className="text-warning">Fill the open {activePosition} lane first.</strong> Large totals may reflect the empty active slot more than a team advantage.</p> : null}
                <p className="mb-2 text-xs text-ink-mute">Equal opening totals are ties. Goalies use schedule overlap only; this does not predict starts.</p>
                <div className="overflow-hidden rounded-xl border border-line">
                  <div className="grid grid-cols-[1fr_54px_54px_28px] gap-2 bg-surface-2 px-3 py-2 text-[10px] font-semibold uppercase text-ink-mute"><span>Team</span><span className="text-right">Open</span><span className="text-right">Games</span><span /></div>
                  {visibleRecommendations.map((rec) => {
                    const fitLabel = getScheduleFitLabel(activeRecommendations, rec);
                    const isOpen = expandedTeam === rec.team;
                    return <div key={rec.team} className="border-t border-line"><button type="button" onClick={() => setExpandedTeam(isOpen ? null : rec.team)} className="grid min-h-12 w-full grid-cols-[1fr_54px_54px_28px] items-center gap-2 px-3 py-2 text-left"><span className="flex items-center gap-2 font-semibold text-ink"><img src={getTeamLogoUrl(rec.team)} alt="" className="h-6 w-6 object-contain" /><span>{rec.team}</span>{fitLabel ? <span className="text-[10px] text-accent">{fitLabel}</span> : null}</span><strong className="text-right text-accent">{rec.addedOpportunities}</strong><span className="text-right text-ink-dim">{rec.teamGames}</span><ChevronDown className={`h-4 w-4 text-ink-dim ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen ? <div className="border-t border-line bg-surface-1 p-3 text-xs text-ink-dim"><p><strong className="text-ink">Open:</strong> {rec.opportunityDates.length > 0 ? rec.opportunityDates.join(' · ') : 'None'}</p><p className="mt-1"><strong className="text-ink">Blocked:</strong> {rec.blockedDates.length}</p>{onBrowsePlayers ? <button type="button" onClick={() => onBrowsePlayers(rec.team, activePosition, windowStart && windowEnd ? { windowStart, windowEnd, simulatedDropId: simulatingWithout ?? undefined, simulatedDropName: simulatingPlayer?.full_name } : undefined)} className="mt-3 min-h-11 rounded-lg border border-accent px-3 font-semibold text-accent">Browse {rec.team} players</button> : null}</div> : null}</div>;
                  })}
                </div>
                {activeRecommendations.length > 5 ? <button type="button" onClick={() => setShowAllTeams((value) => !value)} className="mt-2 min-h-11 w-full rounded-lg border border-line text-sm font-semibold text-accent">{showAllTeams ? 'Show top 5 teams' : `View all ${activeRecommendations.length} teams`}</button> : null}
              </div>
            ) : (
              <div className="text-center py-4 text-ink-dim text-xs">
                No position-specific recommendations available
              </div>
            )}
          </div>
        )}

        {/* Daily detail is supporting evidence, not the entry point. */}
        <details className="rounded-xl border border-line bg-surface-1">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">Daily lineup capacity <span className="font-normal text-ink-dim">{summary.datesCount} dates · {summary.totalSlots} open slot-games</span></summary>
          <div className="space-y-3 border-t border-line p-3">
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
        </details>

        {/* Bottom padding for safe area */}
        <div className="h-20" />
      </div>
    </div>
  );
}
