import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { PlayerProjection, LeagueProfile } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TimeWindowState } from '../types/timeWindow';
import { format, parseISO } from 'date-fns';
import { GridIcon } from './icons/GridIcon';
import { ChevronIcon } from './icons/ChevronIcon';
import { SCHEDULE_URL } from '../lib/season';
import { getPlayerProjection } from '../lib/playerProjection';
import { type ScheduleData } from '../lib/rosterGapsUtils';
import { calculateScheduleOpportunities, structuralVacancyApplies, type ScheduleOpportunityRecommendation } from '../lib/rosterOpportunities';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>; // { "C": 1, "LW": 2, ... }
}

interface RosterGapsPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  unusedSlotsByDate?: Record<string, Record<string, number>>;
  projections: Record<string, PlayerProjection>;
  workingLineup: WorkingLineupPlayer[];
  timeWindow: TimeWindowState;
  leagueProfile: LeagueProfile | null;  // NEW - required for simulation API calls
  isLoading?: boolean;
  dataError?: string | null;
  onBrowsePlayers?: (team: string, position: string) => void;  // NEW - callback to open player management with filters
}

// Helper to calculate which dates have unused slots
const calculateGapDates = (
  unusedSlotsByDate?: Record<string, Record<string, number>>
): GapDate[] => {
  if (!unusedSlotsByDate) return [];

  const gapDates: GapDate[] = [];

  for (const [date, slots] of Object.entries(unusedSlotsByDate)) {
    // Only include dates where there are actually unused slots
    if (Object.keys(slots).length > 0) {
      gapDates.push({ date, unusedSlots: slots });
    }
  }

  // Sort by date
  return gapDates.sort((a, b) => a.date.localeCompare(b.date));
};

export const RosterGapsPanel: React.FC<RosterGapsPanelProps> = ({
  isExpanded,
  onToggle,
  unusedSlotsByDate,
  projections,
  workingLineup,
  timeWindow,
  leagueProfile,
  isLoading = false,
  onBrowsePlayers
}) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());

  const [selectedPlayerToDrop, setSelectedPlayerToDrop] = useState<string | null>(null);

  const scheduleAnalysis = useMemo(() => {
    if (!scheduleData || !leagueProfile || !timeWindow.config) return null;
    return calculateScheduleOpportunities({
      roster: workingLineup.map(({ player, slot }) => ({
        id: player.id,
        team: player.team,
        positions: player.positions,
        currentSlot: slot,
      })),
      leagueProfile,
      scheduleData,
      start: timeWindow.config.startUtc.split('T')[0],
      end: timeWindow.config.endUtc.split('T')[0],
      excludedPlayerId: selectedPlayerToDrop,
    });
  }, [leagueProfile, scheduleData, selectedPlayerToDrop, timeWindow.config, workingLineup]);

  const actionableUnusedSlots = scheduleAnalysis?.unusedSlotsByDate ?? unusedSlotsByDate ?? {};

  // Calculate gap dates (uses simulated data if available)
  const gapDates = useMemo(() => {
    return calculateGapDates(actionableUnusedSlots);
  }, [actionableUnusedSlots]);

  // Fetch schedule data when panel is expanded
  useEffect(() => {
    if (isExpanded && !scheduleData) {
      setIsLoadingSchedule(true);
      fetch(SCHEDULE_URL)
        .then(res => res.json())
        .then(data => {
          setScheduleData(data);
          setIsLoadingSchedule(false);
        })
        .catch(err => {
          console.error('Failed to load schedule data:', err);
          setIsLoadingSchedule(false);
        });
    }
  }, [isExpanded, scheduleData]);

  const positionRecommendations = scheduleAnalysis?.recommendations ?? {};
  const displaySlots = useMemo(() => Object.entries(leagueProfile?.lineup_slots ?? {})
    .filter(([slot, count]) => count > 0 && !['BN', 'BENCH', 'IR', 'IR+', 'IR-LT', 'NA'].includes(slot.toUpperCase()))
    .map(([slot]) => slot.toUpperCase()), [leagueProfile]);
  const unfilledActiveSlots = scheduleAnalysis?.unfilledActiveSlots ?? {};
  const unfilledBenchSlots = scheduleAnalysis?.unfilledBenchSlots ?? 0;

  // Player dropdown options sorted by ICE (ascending)
  const playerDropdownOptions = useMemo(() => {
    if (!projections || workingLineup.length === 0) return [];

    // Calculate total ICE (ICE score × starts) for each player
    const playersWithICE = workingLineup.map(lineupPlayer => {
      const projection = getPlayerProjection(projections, lineupPlayer.player.id);
      const iceScore = projection?.iceScore ?? 0;
      const starts = projection?.starts ?? 0;
      const totalICE = iceScore * starts;

      return {
        playerId: lineupPlayer.player.id,
        playerName: lineupPlayer.player.full_name,
        totalICE
      };
    });

    // Sort by ICE ascending (lowest contributors first)
    playersWithICE.sort((a, b) => a.totalICE - b.totalICE);

    return [
      { value: 'none', label: 'None (Current Roster)' },
      ...playersWithICE.map(p => ({
        value: p.playerId,
        label: `${p.playerName} (${p.totalICE.toFixed(1)})`
      }))
    ];
  }, [workingLineup, projections]);

  // Simulation handler
  const handleDropPlayerSimulation = useCallback((playerId: string | null) => {
    setSelectedPlayerToDrop(!playerId || playerId === 'none' ? null : playerId);
  }, []);

  // Reset simulation when time window changes
  useEffect(() => {
    if (selectedPlayerToDrop) {
      setSelectedPlayerToDrop(null);
    }
  }, [timeWindow.config?.startUtc, timeWindow.config?.endUtc]);

  if (!isLoading && !isLoadingSchedule && scheduleAnalysis?.leagueGameDates === 0) {
    return (
      <div className="mt-1.5 border-t border-line pt-1.5">
        <div className="rounded border border-line bg-surface-1 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-ink">No NHL games in this window</div>
          <div className="mt-0.5 text-[10px] text-ink-dim">Schedule opportunities resume on the next game date.</div>
        </div>
      </div>
    );
  }

  // If no gaps, show success message
  if (gapDates.length === 0 && !isLoading) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-accent">
        <div className="text-center py-2 bg-positive-muted border border-positive rounded">
 <div className="text-positive font-semibold text-xs mb-0.5"> Roster Optimized!</div>
          <div className="text-[10px] text-ink-dim">No unused slots</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 pt-1.5 border-t border-accent">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        disabled={isLoading}
        className="w-full flex items-center justify-between px-2 py-1 bg-surface-1/5 hover:bg-surface-1/10 border border-accent hover:border-accent rounded transition-all duration-200"
      >
        <div className="flex items-center gap-1.5">
          <GridIcon size={14} className="text-accent" />
          <span className="font-semibold text-ink text-xs">
            Roster Opportunities
          </span>
          {!isLoading && (scheduleAnalysis?.totalOpenDates ?? gapDates.length) > 0 && (
            <span className="text-[10px] bg-warning-muted text-warning px-1.5 py-0.5 rounded-full">
              {scheduleAnalysis?.totalOpenDates ?? gapDates.length} dates
            </span>
          )}
        </div>
        <ChevronIcon size={12} direction={isExpanded ? 'up' : 'down'} className="text-accent" />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-1.5 space-y-1.5">
          {isLoading ? (
            <div className="text-center py-4 text-ink-dim text-xs">
              <div className="animate-pulse">Analyzing gaps...</div>
            </div>
          ) : (
            <>
              <div className="rounded border border-accent/40 bg-accent-muted/20 px-3 py-2 text-[10px] text-ink-dim">
                <strong className="text-accent">Schedule only.</strong> These results use NHL team dates, legal eligibility and your lineup slots. Player projections and estimated goalie starts are not used.
              </div>
              {Object.keys(unfilledActiveSlots).length > 0 && <div className="rounded border border-warning/50 bg-warning-muted/20 px-3 py-2 text-[10px] text-ink-dim">
                <strong className="text-warning">Open active roster slots:</strong>{' '}
                {Object.entries(unfilledActiveSlots).map(([slot, count]) => `${slot} ×${count}`).join(' · ')}. Fill these before treating the team rankings as bench or streaming advice; teams may be tied while a starting slot is empty.
              </div>}
              {unfilledBenchSlots > 0 && <div className="rounded border border-line bg-surface-1 px-3 py-2 text-[10px] text-ink-dim">
                <strong className="text-ink">{unfilledBenchSlots} bench spot{unfilledBenchSlots === 1 ? '' : 's'} still empty.</strong>{' '}
                Opportunity totals describe your roster right now and will usually shrink as you fill those spots. Recheck after each draft selection or transaction.
              </div>}

              {/* Gap Dates Timeline */}
              <div className="bg-surface-1/5 border border-accent rounded p-2 relative">
                {/* Simulation active indicator */}
                {selectedPlayerToDrop && (
                  <div className="mb-2 p-1.5 bg-warning-muted border border-warning rounded text-xs text-warning">
                    Showing results with{' '}
                    <span className="font-semibold">
                      {workingLineup.find(lp => lp.player.id === selectedPlayerToDrop)?.player.full_name}
                    </span>{' '}
                    removed
                  </div>
                )}

                {/* Header with dropdown */}
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold text-accent">Unused Slots</h4>

                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-ink-dim">Simulate drop:</label>
                    <select
                      value={selectedPlayerToDrop ?? 'none'}
                      onChange={(e) => handleDropPlayerSimulation(e.target.value === 'none' ? null : e.target.value)}
                      disabled={isLoading}
                      className="text-[10px] bg-surface-1/5 border border-accent text-ink rounded px-2 py-1 focus:outline-none focus:border-accent disabled:opacity-50 cursor-pointer"
                    >
                      {playerDropdownOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-accent">
                        <th className="text-left text-accent font-semibold pb-1 pr-2 min-w-[70px]">Date</th>
                        {displaySlots.map((slot) => <th key={slot} className="text-center text-accent font-semibold pb-1 px-1">{slot}</th>)}
                        <th className="text-right text-warning font-semibold pb-1 pl-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapDates.map((gapDate) => {
                        const formattedDate = format(parseISO(gapDate.date), 'EEE, MMM d');
                        const totalSlots = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);

                        return (
                          <tr key={gapDate.date} className="border-b border-warning last:border-0">
                            <td className="text-ink font-semibold py-1.5 pr-2">{formattedDate}</td>
                            {displaySlots.map((slot) => <td key={slot} className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots[slot] ? (
                                <span className="bg-warning-muted text-warning px-1.5 py-0.5 rounded border border-warning">
                                  {gapDate.unusedSlots[slot]}
                                </span>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>)}
                            <td className="text-warning font-semibold text-right py-1.5 pl-2">{totalSlots}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Position-Specific Team Recommendations */}
              <div className="bg-surface-1/5 border border-accent rounded p-2">
                <h4 className="text-xs font-semibold text-accent mb-1.5">
                  Schedule openings by position
                </h4>
                <p className="mb-2 text-[10px] text-ink-mute">Each team is tested against your current roster with legal lineup reassignment. Best fit is first and worst is last. For goalies, this is schedule overlap only—not a prediction of who starts.</p>

                {isLoadingSchedule ? (
                  <div className="text-center py-3 text-ink-dim text-xs">
                    <div className="animate-pulse">Loading schedule...</div>
                  </div>
                ) : Object.keys(positionRecommendations).length === 0 ? (
                  <div className="text-center py-3 text-ink-dim text-xs">
 <div className="mb-1"></div>
                    <div>No gaps to fill</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {['C', 'LW', 'RW', 'F', 'D', 'G'].map(position => {
                      const recommendations = positionRecommendations[position];
                      if (!recommendations || recommendations.length === 0) return null;
                      const allTeamsTied = recommendations.every((recommendation) => recommendation.addedOpportunities === recommendations[0].addedOpportunities);
                      const isStructuralVacancy = structuralVacancyApplies(position, unfilledActiveSlots);
                      const visibleRecommendations = expandedPositions.has(position) ? recommendations : recommendations.slice(0, 3);

                      return (
                        <div key={position} className="border-t border-accent first:border-t-0 pt-2 first:pt-0">
                          {/* Position header */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-ink bg-accent-muted border border-accent px-2 py-0.5 rounded">
                              {position}
                            </span>
                            <span className="text-[10px] text-ink-dim">{allTeamsTied && isStructuralVacancy
                              ? `Roster-slot vacancy—not a schedule edge. Every team adds ${recommendations[0].addedOpportunities}; compare player quality first.`
                              : 'Potential lineup openings with the current roster'}</span>
                          </div>

                          {/* Team list for this position */}
                          <div className="space-y-1">
                            {visibleRecommendations.map((rec: ScheduleOpportunityRecommendation) => {
                              const recommendationIndex = recommendations.indexOf(rec);
                              const fitLabel = recommendationIndex === 0 ? 'Best fit' : recommendationIndex === recommendations.length - 1 ? 'Worst fit' : null;
                              const overlapLabel = position === 'G'
                                ? `${rec.blockedGames} overlap dates (both G slots occupied) · ${rec.standaloneGames} games when neither current goalie team plays`
                                : `${rec.blockedGames} lineup-full · ${rec.standaloneGames} games with no current ${position}-eligible roster team`;
                              return (
                                <div
                                  key={rec.team}
                                  className="flex flex-col p-1.5 bg-accent-muted border border-accent rounded hover:bg-accent-muted transition-colors gap-1"
                                >
                                  {/* Top row: Logo, Team, Coverage badge */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {/* Team Logo */}
                                      <img
                                        src={`https://assets.nhle.com/logos/nhl/svg/${rec.team}_light.svg`}
                                        alt={rec.team}
                                        className="w-4 h-4 flex-shrink-0"
                                      />

                                      {/* Team Code */}
                                      <span className="text-xs font-semibold text-ink truncate">
                                        {rec.team}
                                      </span>
                                      {fitLabel && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-ink-dim">{fitLabel}</span>}
                                    </div>

                                    {/* Coverage badge */}
                                    <div className="flex-shrink-0 ml-2">
                                      <div className="bg-accent-muted border border-accent rounded px-1.5 py-0.5">
                                        <span className="text-[10px] text-accent font-semibold">
                                          {rec.addedOpportunities} openings
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Middle row: Game dates */}
                                  <div className="text-[9px] text-ink-dim leading-tight truncate">
                                    {rec.teamGames} team games · {overlapLabel}
                                  </div>

                                  {/* Bottom row: Browse button */}
                                  {onBrowsePlayers && (
                                    <button
                                      onClick={() => onBrowsePlayers(rec.team, position)}
                                      className="w-full px-2 py-1 text-[10px] font-semibold bg-accent-muted text-accent rounded border border-accent hover:bg-accent-muted hover:border-accent transition-colors"
                                    >
                                      Browse Players
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {recommendations.length > 3 && <button type="button" onClick={() => setExpandedPositions((current) => {
                              const next = new Set(current);
                              if (next.has(position)) next.delete(position); else next.add(position);
                              return next;
                            })} className="w-full rounded border border-line px-2 py-1.5 text-[10px] font-semibold text-accent hover:border-accent">
                              {expandedPositions.has(position) ? 'Show top 3 teams' : `View all ${recommendations.length} teams`}
                            </button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
