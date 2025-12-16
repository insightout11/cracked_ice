import React, { useState, useMemo, useEffect } from 'react';
import type { PlayerProjection } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TimeWindowState } from '../types/timeWindow';
import { format, parseISO } from 'date-fns';
import { GridIcon } from './icons/GridIcon';
import { ChevronIcon } from './icons/ChevronIcon';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>; // { "C": 1, "LW": 2, ... }
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
  isLoading?: boolean;
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

// Helper to count total unused slots
const countTotalUnusedSlots = (gapDates: GapDate[]): number => {
  return gapDates.reduce((total, gapDate) => {
    return total + Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);
  }, 0);
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

export const RosterGapsPanel: React.FC<RosterGapsPanelProps> = ({
  isExpanded,
  onToggle,
  unusedSlotsByDate,
  projections,
  workingLineup,
  timeWindow,
  isLoading = false
}) => {
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Calculate gap dates
  const gapDates = useMemo(() => {
    return calculateGapDates(unusedSlotsByDate);
  }, [unusedSlotsByDate]);

  const totalUnusedSlots = useMemo(() => {
    return countTotalUnusedSlots(gapDates);
  }, [gapDates]);

  // Fetch schedule data when panel is expanded
  useEffect(() => {
    if (isExpanded && !scheduleData && gapDates.length > 0) {
      setIsLoadingSchedule(true);
      fetch('/schedules-20252026.json')
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

  // Calculate team recommendations
  const recommendations = useMemo(() => {
    if (!scheduleData || gapDates.length === 0) return [];
    return calculateTeamRecommendations(gapDates, scheduleData);
  }, [gapDates, scheduleData]);

  // If no gaps, show success message
  if (gapDates.length === 0 && !isLoading) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-cyan-500/20">
        <div className="text-center py-2 bg-green-500/10 border border-green-500/30 rounded">
          <div className="text-green-400 font-semibold text-xs mb-0.5">✅ Roster Optimized!</div>
          <div className="text-[10px] text-gray-400">No unused slots</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 pt-1.5 border-t border-cyan-500/20">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        disabled={isLoading}
        className="w-full flex items-center justify-between px-2 py-1 bg-white/5 hover:bg-white/10 border border-cyan-500/20 hover:border-cyan-400/50 rounded transition-all duration-200"
      >
        <div className="flex items-center gap-1.5">
          <GridIcon size={14} className="text-cyan-400" />
          <span className="font-semibold text-white text-xs">
            Roster Gaps
          </span>
          {!isLoading && gapDates.length > 0 && (
            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">
              {gapDates.length} dates
            </span>
          )}
        </div>
        <ChevronIcon size={12} direction={isExpanded ? 'up' : 'down'} className="text-cyan-400" />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-1.5 space-y-1.5">
          {isLoading ? (
            <div className="text-center py-4 text-gray-400 text-xs">
              <div className="animate-pulse">Analyzing gaps...</div>
            </div>
          ) : (
            <>
              {/* Gap Dates Timeline */}
              <div className="bg-white/5 border border-cyan-500/20 rounded p-2">
                <h4 className="text-xs font-semibold text-cyan-400 mb-1.5">Unused Slots</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-cyan-500/20">
                        <th className="text-left text-cyan-400 font-semibold pb-1 pr-2 min-w-[70px]">Date</th>
                        <th className="text-center text-cyan-400 font-semibold pb-1 px-1">C</th>
                        <th className="text-center text-cyan-400 font-semibold pb-1 px-1">LW</th>
                        <th className="text-center text-cyan-400 font-semibold pb-1 px-1">RW</th>
                        <th className="text-center text-cyan-400 font-semibold pb-1 px-1">D</th>
                        <th className="text-center text-cyan-400 font-semibold pb-1 px-1">G</th>
                        <th className="text-right text-orange-400 font-semibold pb-1 pl-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapDates.map((gapDate) => {
                        const formattedDate = format(parseISO(gapDate.date), 'EEE, MMM d');
                        const totalSlots = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);

                        return (
                          <tr key={gapDate.date} className="border-b border-orange-500/20 last:border-0">
                            <td className="text-white font-semibold py-1.5 pr-2">{formattedDate}</td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['C'] ? (
                                <span className="bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-400/30">
                                  {gapDate.unusedSlots['C']}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['LW'] ? (
                                <span className="bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-400/30">
                                  {gapDate.unusedSlots['LW']}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['RW'] ? (
                                <span className="bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-400/30">
                                  {gapDate.unusedSlots['RW']}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['D'] ? (
                                <span className="bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-400/30">
                                  {gapDate.unusedSlots['D']}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="text-center py-1.5 px-1">
                              {gapDate.unusedSlots['G'] ? (
                                <span className="bg-orange-400/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-400/30">
                                  {gapDate.unusedSlots['G']}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="text-orange-400 font-semibold text-right py-1.5 pl-2">{totalSlots}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Recommendations */}
              <div className="bg-white/5 border border-cyan-500/20 rounded p-2">
                <h4 className="text-xs font-semibold text-cyan-400 mb-1.5">Recommended Teams</h4>
                {isLoadingSchedule ? (
                  <div className="text-center py-3 text-gray-400 text-xs">
                    <div className="animate-pulse">Loading...</div>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 text-xs">
                    <div className="mb-1">🏒</div>
                    <div>No recommendations</div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recommendations.map((rec) => (
                      <div
                        key={rec.team}
                        className="flex items-start justify-between p-2 bg-cyan-500/5 border border-cyan-500/20 rounded hover:bg-cyan-500/10 transition-colors"
                      >
                        <div className="flex items-start gap-2 flex-1">
                          {/* Team Logo */}
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${rec.team}_light.svg`}
                            alt={rec.team}
                            className="w-5 h-5 flex-shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            {/* Team Name */}
                            <div className="text-xs font-semibold text-white mb-0.5">
                              {rec.team}
                            </div>

                            {/* Positions */}
                            <div className="flex flex-wrap gap-0.5 mb-0.5">
                              {rec.positions.map((pos) => (
                                <span
                                  key={pos}
                                  className="text-[10px] bg-cyan-400/20 text-cyan-300 px-1 py-0.5 rounded border border-cyan-400/30"
                                >
                                  {pos}
                                </span>
                              ))}
                            </div>

                            {/* Gap dates covered */}
                            <div className="text-[10px] text-gray-400">
                              {rec.gapDatesCovered.length} dates
                            </div>
                          </div>
                        </div>

                        {/* Total slots filled badge */}
                        <div className="flex-shrink-0 ml-2">
                          <div className="bg-cyan-500/20 border border-cyan-400/30 rounded px-1.5 py-0.5">
                            <div className="text-[10px] text-cyan-400 font-semibold">
                              {rec.totalSlotsFilled}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
