import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { LeagueProfile } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TimeWindowState } from '../types/timeWindow';
import { GridIcon } from './icons/GridIcon';
import { ChevronIcon } from './icons/ChevronIcon';
import { SCHEDULE_URL } from '../lib/season';
import { type ScheduleData } from '../lib/rosterGapsUtils';
import {
  calculateScheduleOpportunities,
  getScheduleFitLabel,
  structuralVacancyApplies,
  type ScheduleOpportunityRecommendation,
} from '../lib/rosterOpportunities';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>;
}

export interface ScheduleFitBrowseContext {
  windowStart: string;
  windowEnd: string;
  simulatedDropId?: string;
  simulatedDropName?: string;
}

interface RosterGapsPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  workingLineup: WorkingLineupPlayer[];
  timeWindow: TimeWindowState;
  leagueProfile: LeagueProfile | null;
  isLoading?: boolean;
  onBrowsePlayers?: (team: string, position: string, context?: ScheduleFitBrowseContext) => void;
}

type ScheduleStatus = 'idle' | 'loading' | 'ready' | 'error';
const POSITION_ORDER = ['C', 'LW', 'RW', 'F', 'D', 'G'];
const INACTIVE_SLOTS = new Set(['BN', 'BENCH', 'IR', 'IR+', 'IR-LT', 'NA']);

function calculateGapDates(unusedSlotsByDate: Record<string, Record<string, number>> = {}): GapDate[] {
  return Object.entries(unusedSlotsByDate)
    .filter(([, slots]) => Object.keys(slots).length > 0)
    .map(([date, unusedSlots]) => ({ date, unusedSlots }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function vacancySummary(active: Record<string, number>, bench: number): string {
  const activeCount = Object.values(active).reduce((sum, count) => sum + count, 0);
  const activeText = Object.entries(active).map(([slot, count]) => `${count} ${slot}`).join(', ');
  const sections = [];
  if (activeText) sections.push(`${activeText} active slot${activeCount === 1 ? '' : 's'}`);
  if (bench > 0) sections.push(`${bench} bench spot${bench === 1 ? '' : 's'}`);
  return sections.length > 0
    ? `${sections.join(' and ')} remain empty; results reflect your current roster.`
    : 'Your active roster is filled; results show where another player could create usable schedule capacity.';
}

function datesLabel(dates: string[]): string {
  return dates.map((date) => format(parseISO(date), 'MMM d')).join(' · ');
}

export const RosterGapsPanel: React.FC<RosterGapsPanelProps> = ({
  isExpanded,
  onToggle,
  workingLineup,
  timeWindow,
  leagueProfile,
  isLoading = false,
  onBrowsePlayers,
}) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>('idle');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedPlayerToDrop, setSelectedPlayerToDrop] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState('D');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const isWeeklyLocking = leagueProfile?.locking_mode === 'weekly';
  const windowStart = timeWindow.config.startUtc.split('T')[0];
  const windowEnd = timeWindow.config.endUtc.split('T')[0];

  useEffect(() => {
    if (!isExpanded || isWeeklyLocking || scheduleData) return;
    const controller = new AbortController();
    setScheduleStatus('loading');
    setScheduleError(null);
    fetch(SCHEDULE_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Schedule request failed (${response.status})`);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || !payload.games || typeof payload.games !== 'object') {
          throw new Error('Schedule data is incomplete');
        }
        setScheduleData(payload as ScheduleData);
        setScheduleStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load schedule data:', error);
        setScheduleError('The NHL schedule could not be loaded. No schedule-fit result is being shown.');
        setScheduleStatus('error');
      });
    return () => controller.abort();
  }, [isExpanded, isWeeklyLocking, loadAttempt, scheduleData]);

  const rosterForAnalysis = useMemo(() => workingLineup.map(({ player, slot }) => ({
    id: player.id,
    team: player.team,
    positions: player.positions,
    currentSlot: slot,
  })), [workingLineup]);

  const baselineAnalysis = useMemo(() => {
    if (!scheduleData || !leagueProfile || isWeeklyLocking) return null;
    return calculateScheduleOpportunities({
      roster: rosterForAnalysis,
      leagueProfile,
      scheduleData,
      start: windowStart,
      end: windowEnd,
    });
  }, [isWeeklyLocking, leagueProfile, rosterForAnalysis, scheduleData, windowEnd, windowStart]);

  const scheduleAnalysis = useMemo(() => {
    if (!baselineAnalysis || !scheduleData || !leagueProfile || !selectedPlayerToDrop) return baselineAnalysis;
    return calculateScheduleOpportunities({
      roster: rosterForAnalysis,
      leagueProfile,
      scheduleData,
      start: windowStart,
      end: windowEnd,
      excludedPlayerId: selectedPlayerToDrop,
    });
  }, [baselineAnalysis, leagueProfile, rosterForAnalysis, scheduleData, selectedPlayerToDrop, windowEnd, windowStart]);

  const positionRecommendations = scheduleAnalysis?.recommendations ?? {};
  const availablePositions = useMemo(() => POSITION_ORDER.filter((position) => (positionRecommendations[position]?.length ?? 0) > 0), [positionRecommendations]);
  const unfilledActiveSlots = scheduleAnalysis?.unfilledActiveSlots ?? {};
  const unfilledBenchSlots = scheduleAnalysis?.unfilledBenchSlots ?? 0;
  const gapDates = useMemo(() => calculateGapDates(scheduleAnalysis?.unusedSlotsByDate), [scheduleAnalysis]);
  const displaySlots = useMemo(() => Object.entries(leagueProfile?.lineup_slots ?? {})
    .filter(([slot, count]) => count > 0 && !INACTIVE_SLOTS.has(slot.toUpperCase()))
    .map(([slot]) => slot.toUpperCase()), [leagueProfile]);

  useEffect(() => {
    if (availablePositions.length === 0 || availablePositions.includes(selectedPosition)) return;
    const vacantPosition = POSITION_ORDER.find((position) => availablePositions.includes(position) && structuralVacancyApplies(position, unfilledActiveSlots));
    setSelectedPosition(vacantPosition ?? availablePositions[0]);
  }, [availablePositions, selectedPosition, unfilledActiveSlots]);

  useEffect(() => {
    setExpandedTeam(null);
    setShowAllTeams(false);
  }, [selectedPosition, selectedPlayerToDrop]);

  useEffect(() => {
    setSelectedPlayerToDrop(null);
  }, [windowStart, windowEnd]);

  const retrySchedule = useCallback(() => {
    setScheduleData(null);
    setScheduleStatus('idle');
    setScheduleError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const recommendations = positionRecommendations[selectedPosition] ?? [];
  const visibleRecommendations = showAllTeams ? recommendations : recommendations.slice(0, 5);
  const selectedDropName = selectedPlayerToDrop
    ? workingLineup.find(({ player }) => player.id === selectedPlayerToDrop)?.player.full_name
    : null;
  const simulationDelta = scheduleAnalysis && baselineAnalysis
    ? scheduleAnalysis.totalOpenSlotOpportunities - baselineAnalysis.totalOpenSlotOpportunities
    : 0;

  return (
    <div className="mt-2 border-t border-line pt-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={isLoading}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-surface-1 px-3 py-2 text-left transition-colors hover:border-accent disabled:opacity-60"
      >
        <span className="flex items-center gap-2">
          <GridIcon size={15} className="text-accent" />
          <span className="text-sm font-semibold text-ink">Roster schedule fit</span>
          {scheduleStatus === 'ready' && scheduleAnalysis && scheduleAnalysis.totalOpenDates > 0 ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-dim">{scheduleAnalysis.totalOpenDates} open dates</span>
          ) : null}
        </span>
        <ChevronIcon size={14} direction={isExpanded ? 'up' : 'down'} className="text-ink-dim" />
      </button>

      {isExpanded ? (
        <div className="mt-3 space-y-4 rounded-xl border border-line bg-surface-1 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Schedule fit</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">Which team’s schedule fits the next player you add?</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-dim">An opening is one additional player-game your legal active lineup can hold. It is not a projected start, free-agent guarantee, or player-quality rating.</p>
          </div>

          {isWeeklyLocking ? (
            <div className="rounded-lg border border-warning/50 bg-warning-muted/20 p-4" role="status">
              <p className="font-semibold text-warning">Daily schedule-fit recommendations are unavailable for weekly lineup locking.</p>
              <p className="mt-1 text-sm text-ink-dim">This prevents daily lineup reassignment from overstating opportunities your league cannot use. Weekly assignment support is still required before recommendations can be shown here.</p>
            </div>
          ) : scheduleStatus === 'loading' || scheduleStatus === 'idle' ? (
            <div className="rounded-lg border border-line p-5 text-center text-sm text-ink-dim"><span className="animate-pulse">Loading NHL schedule and testing lineup capacity…</span></div>
          ) : scheduleStatus === 'error' ? (
            <div className="rounded-lg border border-negative bg-negative-muted p-4" role="alert">
              <p className="font-semibold text-negative">Schedule analysis unavailable</p>
              <p className="mt-1 text-sm text-ink-dim">{scheduleError}</p>
              <button type="button" onClick={retrySchedule} className="mt-3 rounded-lg border border-negative px-3 py-2 text-sm font-semibold text-negative">Retry schedule</button>
            </div>
          ) : scheduleAnalysis?.leagueGameDates === 0 ? (
            <div className="rounded-lg border border-line p-4 text-center">
              <p className="font-semibold text-ink">No NHL games in this window</p>
              <p className="mt-1 text-sm text-ink-dim">Schedule opportunities resume on the next game date.</p>
            </div>
          ) : scheduleAnalysis ? (
            <>
              <div className="rounded-lg border border-line bg-surface-0 p-3 text-sm text-ink-dim">
                {vacancySummary(unfilledActiveSlots, unfilledBenchSlots)}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label htmlFor="schedule-fit-drop" className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Compare without a player</label>
                  <select
                    id="schedule-fit-drop"
                    value={selectedPlayerToDrop ?? 'none'}
                    onChange={(event) => setSelectedPlayerToDrop(event.target.value === 'none' ? null : event.target.value)}
                    className="mt-1 block min-w-64 rounded-lg border border-line bg-surface-0 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="none">Current roster</option>
                    {workingLineup.map(({ player }) => <option key={player.id} value={player.id}>Without {player.full_name}</option>)}
                  </select>
                </div>
                <div className="text-sm text-ink-dim">
                  <span className="font-semibold text-ink">{baselineAnalysis?.totalOpenSlotOpportunities ?? 0}</span> current open slot-games
                  {selectedPlayerToDrop ? <><span className="mx-2">→</span><span className="font-semibold text-warning">{scheduleAnalysis.totalOpenSlotOpportunities}</span> without {selectedDropName} <span className="text-warning">({simulationDelta >= 0 ? '+' : ''}{simulationDelta})</span></> : null}
                </div>
              </div>

              {availablePositions.length > 0 ? (
                <section aria-labelledby="schedule-team-comparison">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h4 id="schedule-team-comparison" className="text-base font-semibold text-ink">Team comparison</h4>
                      <p className="mt-1 text-xs text-ink-dim">Teams with the same opening total are tied. Standalone games, then team code, order equal totals.</p>
                    </div>
                    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Position to add">
                      {availablePositions.map((position) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={selectedPosition === position}
                          key={position}
                          onClick={() => setSelectedPosition(position)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold ${selectedPosition === position ? 'bg-accent text-surface-0' : 'border border-line text-ink-dim hover:border-accent hover:text-ink'}`}
                        >{position}</button>
                      ))}
                    </div>
                  </div>

                  {structuralVacancyApplies(selectedPosition, unfilledActiveSlots) ? (
                    <p className="mt-3 rounded-lg bg-warning-muted/20 px-3 py-2 text-sm text-ink-dim"><strong className="text-warning">Fill the open {selectedPosition} lane first.</strong> Large totals may primarily reflect an empty active slot rather than a unique team advantage.</p>
                  ) : null}

                  <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                    <div className="grid min-w-[620px] grid-cols-[minmax(88px,1fr)_72px_82px_72px_90px] gap-2 bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
                      <span>Team</span><span className="text-right">Openings</span><span className="text-right">Team games</span><span className="text-right">Blocked</span><span aria-hidden="true" />
                    </div>
                    {visibleRecommendations.map((recommendation: ScheduleOpportunityRecommendation) => {
                      const fitLabel = getScheduleFitLabel(recommendations, recommendation);
                      const isOpen = expandedTeam === recommendation.team;
                      return (
                        <div key={recommendation.team} className="border-t border-line first:border-t-0">
                          <div className="grid min-w-[620px] grid-cols-[minmax(88px,1fr)_72px_82px_72px_90px] items-center gap-2 px-3 py-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-semibold text-ink"><img src={`https://assets.nhle.com/logos/nhl/svg/${recommendation.team}_light.svg`} alt="" className="h-6 w-6 object-contain" /><span>{recommendation.team}</span>{fitLabel ? <span className="hidden rounded-full bg-accent-muted px-2 py-0.5 text-[11px] text-accent sm:inline">{fitLabel}</span> : null}</span>
                            <strong className="text-right text-accent">{recommendation.addedOpportunities}</strong>
                            <span className="text-right text-ink-dim">{recommendation.teamGames}</span>
                            <span className="text-right text-ink-dim">{recommendation.blockedGames}</span>
                            <button type="button" onClick={() => setExpandedTeam(isOpen ? null : recommendation.team)} aria-expanded={isOpen} className="justify-self-end text-xs font-semibold text-accent">{isOpen ? 'Hide dates' : 'View dates'}</button>
                          </div>
                          {isOpen ? (
                            <div className="border-t border-line bg-surface-0 px-3 py-3 text-sm text-ink-dim">
                              <p><strong className="text-ink">Open dates:</strong> {recommendation.opportunityDates.length > 0 ? datesLabel(recommendation.opportunityDates) : 'None'}</p>
                              <p className="mt-1"><strong className="text-ink">Blocked dates:</strong> {recommendation.blockedDates.length > 0 ? datesLabel(recommendation.blockedDates) : 'None'}</p>
                              {onBrowsePlayers ? <button type="button" onClick={() => onBrowsePlayers(recommendation.team, selectedPosition, { windowStart, windowEnd, simulatedDropId: selectedPlayerToDrop ?? undefined, simulatedDropName: selectedDropName ?? undefined })} className="mt-3 rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent">Browse {recommendation.team} {selectedPosition} players</button> : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {recommendations.length > 5 ? <button type="button" onClick={() => setShowAllTeams((value) => !value)} className="mt-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-accent">{showAllTeams ? 'Show top 5 teams' : `View all ${recommendations.length} teams`}</button> : null}
                </section>
              ) : null}

              <details className="rounded-lg border border-line">
                <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-ink">Daily lineup capacity <span className="ml-1 font-normal text-ink-dim">{gapDates.length} dates · {scheduleAnalysis.totalOpenSlotOpportunities} open slot-games</span></summary>
                <div className="overflow-x-auto border-t border-line p-3">
                  {gapDates.length === 0 ? <p className="text-sm text-ink-dim">No additional schedule capacity was found after a successful schedule analysis.</p> : (
                    <table className="w-full min-w-[560px] text-sm">
                      <thead><tr className="text-xs uppercase tracking-wide text-ink-mute"><th className="pb-2 text-left">Date</th>{displaySlots.map((slot) => <th key={slot} className="pb-2 text-center">{slot}</th>)}<th className="pb-2 text-right">Total</th></tr></thead>
                      <tbody>{gapDates.map((gapDate) => {
                        const total = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);
                        return <tr key={gapDate.date} className="border-t border-line"><td className="py-2 font-medium text-ink">{format(parseISO(gapDate.date), 'EEE, MMM d')}</td>{displaySlots.map((slot) => <td key={slot} className="py-2 text-center text-ink-dim">{gapDate.unusedSlots[slot] || '—'}</td>)}<td className="py-2 text-right font-semibold text-warning">{total}</td></tr>;
                      })}</tbody>
                    </table>
                  )}
                </div>
              </details>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
