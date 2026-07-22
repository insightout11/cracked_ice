import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { PlayerProjection, LeagueProfile, ProjectionsRequest } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TimeWindowState } from '../types/timeWindow';
import { format, parseISO } from 'date-fns';
import { GridIcon } from './icons/GridIcon';
import { ChevronIcon } from './icons/ChevronIcon';
import { apiService } from '../services/api';
import { SCHEDULE_URL } from '../lib/season';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>; // { "C": 1, "LW": 2, ... }
}

interface PositionRecommendation {
  team: string;
  gapDatesCovered: number;  // Number of gap dates this team plays on
  gapDates: string[];       // Actual dates (for details/tooltips)
}

interface TeamRecommendation {
  team: string;
  totalSlotsFilled: number;
  gapDatesCovered: string[];
  positions: string[];
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

// Helper to generate all dates in the time window
const generateAllDatesInWindow = (
  timeWindow: TimeWindowState,
  unusedSlotsByDate?: Record<string, Record<string, number>>
): GapDate[] => {
  if (!timeWindow.config) return [];

  const allDates: GapDate[] = [];
  const startDate = new Date(timeWindow.config.startUtc.split('T')[0]);
  const endDate = new Date(timeWindow.config.endUtc.split('T')[0]);

  // Iterate through each date in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Get unused slots for this date, or default to empty
    const unusedSlots = unusedSlotsByDate?.[dateStr] ?? {};

    allDates.push({
      date: dateStr,
      unusedSlots
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return allDates;
};

// Helper to count total unused slots
const countTotalUnusedSlots = (gapDates: GapDate[]): number => {
  return gapDates.reduce((total, gapDate) => {
    return total + Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);
  }, 0);
};

// Helper to format dates for display
const formatGameDates = (dates: string[]): string => {
  if (dates.length === 0) return '';

  // Sort dates
  const sorted = [...dates].sort();

  // Format each date as "Mon 12/22"
  return sorted.map(dateStr => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${dayName} ${month}/${day}`;
  }).join(', ');
};

// Helper to calculate team recommendations based on schedule and gap dates
const calculateTeamRecommendations = (
  gapDates: GapDate[],
  scheduleData: any
): TeamRecommendation[] => {
  if (!scheduleData || !scheduleData.games) return [];

  const teamScores = new Map<string, { slots: number; dates: string[]; positions: Set<string> }>();

  // For each gap date, find which teams play on that date
  gapDates.forEach((gapDate) => {
    const gapPositions = Object.keys(gapDate.unusedSlots);
    const gapSlotCount = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);

    // Check all teams to see if they play on this date
    for (const [teamCode, games] of Object.entries(scheduleData.games)) {
      const teamGames = games as any[];
      const playsOnDate = teamGames.some((game: any) => game.date === gapDate.date);

      if (playsOnDate) {
        const existing = teamScores.get(teamCode) ?? { slots: 0, dates: [], positions: new Set<string>() };

        // Add the potential slots this team could fill
        teamScores.set(teamCode, {
          slots: existing.slots + gapSlotCount,
          dates: [...existing.dates, gapDate.date],
          positions: new Set([...existing.positions, ...gapPositions])
        });
      }
    }
  });

  // Convert to array and sort by total slots filled
  const recommendations: TeamRecommendation[] = Array.from(teamScores.entries())
    .map(([team, data]) => ({
      team,
      totalSlotsFilled: data.slots,
      gapDatesCovered: data.dates,
      positions: Array.from(data.positions)
    }))
    .sort((a, b) => b.totalSlotsFilled - a.totalSlotsFilled)
    .slice(0, 5); // Top 5 teams

  return recommendations;
};

// Helper to calculate position-specific team recommendations
const calculatePositionSpecificRecommendations = (
  unusedSlotsByDate: Record<string, Record<string, number>>,
  scheduleData: any,
  positionsToAnalyze: string[] = ['C', 'LW', 'RW', 'D', 'G']
): Record<string, PositionRecommendation[]> => {
  if (!scheduleData || !scheduleData.games) return {};

  const result: Record<string, PositionRecommendation[]> = {};

  positionsToAnalyze.forEach(position => {
    // Step 1: Extract dates where THIS position has gaps
    const gapDatesForPosition: string[] = [];
    Object.entries(unusedSlotsByDate).forEach(([date, slots]) => {
      if (slots[position] && slots[position] > 0) {
        gapDatesForPosition.push(date);
      }
    });

    // Skip positions with no gaps
    if (gapDatesForPosition.length === 0) return;

    // Step 2: Score teams by coverage
    const teamScores = new Map<string, { count: number; dates: string[] }>();

    gapDatesForPosition.forEach(date => {
      Object.entries(scheduleData.games).forEach(([teamCode, games]) => {
        const teamGames = games as any[];
        const playsOnDate = teamGames.some((game: any) => game.date === date);

        if (playsOnDate) {
          const existing = teamScores.get(teamCode) ?? { count: 0, dates: [] };
          teamScores.set(teamCode, {
            count: existing.count + 1,
            dates: [...existing.dates, date]
          });
        }
      });
    });

    // Step 3: Sort by coverage (descending) and take top 5
    const recommendations: PositionRecommendation[] = Array.from(teamScores.entries())
      .map(([team, data]) => ({
        team,
        gapDatesCovered: data.count,
        gapDates: data.dates
      }))
      .sort((a, b) => b.gapDatesCovered - a.gapDatesCovered)
      .slice(0, 5);

    result[position] = recommendations;
  });

  return result;
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
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Simulation state
  const [selectedPlayerToDrop, setSelectedPlayerToDrop] = useState<string | null>(null);
  const [simulatedData, setSimulatedData] = useState<{
    unusedSlotsByDate: Record<string, Record<string, number>>;
    isLoading: boolean;
    error: string | null;
  } | null>(null);

  // Calculate gap dates (uses simulated data if available)
  const gapDates = useMemo(() => {
    const dataSource = simulatedData?.unusedSlotsByDate ?? unusedSlotsByDate;
    return calculateGapDates(dataSource);
  }, [unusedSlotsByDate, simulatedData]);

  // Generate ALL dates in the time window (for table display)
  const allDatesInWindow = useMemo(() => {
    const dataSource = simulatedData?.unusedSlotsByDate ?? unusedSlotsByDate;
    return generateAllDatesInWindow(timeWindow, dataSource);
  }, [timeWindow, unusedSlotsByDate, simulatedData]);

  const totalUnusedSlots = useMemo(() => {
    return countTotalUnusedSlots(gapDates);
  }, [gapDates]);

  // Fetch schedule data when panel is expanded
  useEffect(() => {
    if (isExpanded && !scheduleData && gapDates.length > 0) {
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
  }, [isExpanded, scheduleData, gapDates.length]);

  // Calculate position-specific recommendations (uses simulated data if available)
  const positionRecommendations = useMemo(() => {
    if (!scheduleData || gapDates.length === 0) return {};
    const dataSource = simulatedData?.unusedSlotsByDate ?? unusedSlotsByDate;
    if (!dataSource) return {};
    return calculatePositionSpecificRecommendations(dataSource, scheduleData);
  }, [unusedSlotsByDate, simulatedData, scheduleData, gapDates.length]);

  // Player dropdown options sorted by ICE (ascending)
  const playerDropdownOptions = useMemo(() => {
    if (!projections || workingLineup.length === 0) return [];

    // Calculate total ICE (ICE score × starts) for each player
    const playersWithICE = workingLineup.map(lineupPlayer => {
      const projection = projections[lineupPlayer.player.id];
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
  const handleDropPlayerSimulation = useCallback(async (playerId: string | null) => {
    // Clear simulation if "None" selected
    if (!playerId || playerId === 'none') {
      setSelectedPlayerToDrop(null);
      setSimulatedData(null);
      return;
    }

    if (!leagueProfile) {
      console.error('League profile required for simulation');
      return;
    }

    setSelectedPlayerToDrop(playerId);
    setSimulatedData({ unusedSlotsByDate: {}, isLoading: true, error: null });

    try {
      // Filter roster without the selected player
      const filteredRoster = workingLineup
        .filter(lp => lp.player.id !== playerId)
        .map(lp => ({
          playerId: lp.player.id,
          slot: lp.slot.includes('IR+') ? 'IR+' : lp.slot.split('-')[0]
        }));

      // Build API request
      const request: ProjectionsRequest = {
        league: leagueProfile,
        window: {
          start: timeWindow.config.startUtc.split('T')[0],
          end: timeWindow.config.endUtc.split('T')[0]
        },
        roster: filteredRoster
      };

      // Call backend
      const response = await apiService.applyRosterLineup(request);
      const newUnusedSlots = response.meta?.simulation?.unusedSlotsByDate ?? {};

      setSimulatedData({
        unusedSlotsByDate: newUnusedSlots,
        isLoading: false,
        error: null
      });

    } catch (error) {
      console.error('Simulation failed:', error);
      setSimulatedData({
        unusedSlotsByDate: {},
        isLoading: false,
        error: 'Failed to load simulation. Please try again.'
      });
    }
  }, [workingLineup, leagueProfile, timeWindow]);

  // Reset simulation when time window changes
  useEffect(() => {
    if (selectedPlayerToDrop) {
      setSelectedPlayerToDrop(null);
      setSimulatedData(null);
    }
  }, [timeWindow.config?.startUtc, timeWindow.config?.endUtc]);

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
            Roster Gaps
          </span>
          {!isLoading && gapDates.length > 0 && (
            <span className="text-[10px] bg-warning-muted text-warning px-1.5 py-0.5 rounded-full">
              {gapDates.length} dates
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
              {/* Gap Dates Timeline */}
              <div className="bg-surface-1/5 border border-accent rounded p-2 relative">
                {/* Loading overlay */}
                {simulatedData?.isLoading && (
                  <div className="absolute inset-0 bg-surface-glass backdrop-blur-sm z-10 flex items-center justify-center rounded">
                    <div className="text-xs text-accent flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
                      Simulating...
                    </div>
                  </div>
                )}

                {/* Error banner */}
                {simulatedData?.error && (
                  <div className="mb-2 p-2 bg-negative-muted border border-negative rounded text-xs text-negative">
                    {simulatedData.error}
                  </div>
                )}

                {/* Simulation active indicator */}
                {selectedPlayerToDrop && !simulatedData?.isLoading && !simulatedData?.error && (
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
                      disabled={isLoading || simulatedData?.isLoading}
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
                        <th className="text-center text-accent font-semibold pb-1 px-1">C</th>
                        <th className="text-center text-accent font-semibold pb-1 px-1">LW</th>
                        <th className="text-center text-accent font-semibold pb-1 px-1">RW</th>
                        <th className="text-center text-accent font-semibold pb-1 px-1">D</th>
                        <th className="text-center text-accent font-semibold pb-1 px-1">G</th>
                        <th className="text-right text-warning font-semibold pb-1 pl-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDatesInWindow.map((gapDate) => {
                        const formattedDate = format(parseISO(gapDate.date), 'EEE, MMM d');
                        const totalSlots = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);

                        return (
                          <tr key={gapDate.date} className="border-b border-warning last:border-0">
                            <td className="text-ink font-semibold py-1.5 pr-2">{formattedDate}</td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['C'] ? (
                                <span className="bg-warning-muted text-warning px-1.5 py-0.5 rounded border border-warning">
                                  {gapDate.unusedSlots['C']}
                                </span>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['LW'] ? (
                                <span className="bg-warning-muted text-warning px-1.5 py-0.5 rounded border border-warning">
                                  {gapDate.unusedSlots['LW']}
                                </span>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['RW'] ? (
                                <span className="bg-warning-muted text-warning px-1.5 py-0.5 rounded border border-warning">
                                  {gapDate.unusedSlots['RW']}
                                </span>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['D'] ? (
                                <span className="bg-warning-muted text-warning px-1.5 py-0.5 rounded border border-warning">
                                  {gapDate.unusedSlots['D']}
                                </span>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['G'] ? (
                                <span className="bg-warning-muted text-warning px-1.5 py-0.5 rounded border border-warning">
                                  {gapDate.unusedSlots['G']}
                                </span>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>
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
                  Recommended Teams by Position
                </h4>

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
                    {(['C', 'LW', 'RW', 'D', 'G'] as const).map(position => {
                      const recommendations = positionRecommendations[position];
                      if (!recommendations || recommendations.length === 0) return null;

                      return (
                        <div key={position} className="border-t border-accent first:border-t-0 pt-2 first:pt-0">
                          {/* Position header */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-ink bg-accent-muted border border-accent px-2 py-0.5 rounded">
                              {position}
                            </span>
                            <span className="text-[10px] text-ink-dim">
                              {recommendations[0]?.gapDates.length ?? 0} gap dates
                            </span>
                          </div>

                          {/* Team list for this position */}
                          <div className="space-y-1">
                            {recommendations.slice(0, 3).map((rec) => {
                              const formattedDates = formatGameDates(rec.gapDates);

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
                                    </div>

                                    {/* Coverage badge */}
                                    <div className="flex-shrink-0 ml-2">
                                      <div className="bg-accent-muted border border-accent rounded px-1.5 py-0.5">
                                        <span className="text-[10px] text-accent font-semibold">
                                          {rec.gapDatesCovered}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Middle row: Game dates */}
                                  <div className="text-[9px] text-ink-dim leading-tight truncate">
                                    {formattedDates}
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
