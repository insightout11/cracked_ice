import React, { useState, useMemo, useEffect } from 'react';
import type { PlayerProjection } from '../lib/coachSchemas';
import type { WorkingLineupPlayer } from './RosterGrid';
import type { TimeWindowState } from '../types/timeWindow';
import { format, parseISO } from 'date-fns';

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
      <div className="mt-3 pt-3 border-t border-cyan-500/20">
        <div className="text-center py-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="text-green-400 font-semibold mb-1">✅ Roster Fully Optimized!</div>
          <div className="text-xs text-gray-400">No unused roster slots in this time window</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-cyan-500/20">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        disabled={isLoading}
        className="w-full flex items-center justify-between px-4 py-2 bg-white/5 hover:bg-white/10 border border-cyan-500/20 hover:border-cyan-400/50 rounded-lg transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-semibold text-white">
            Roster Gaps Analysis
          </span>
          {!isLoading && gapDates.length > 0 && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
              {gapDates.length} dates, {totalUnusedSlots} slots
            </span>
          )}
        </div>
        <div className="text-cyan-400 text-xl">
          {isExpanded ? '▲' : '▼'}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">
              <div className="animate-pulse">Analyzing roster gaps...</div>
            </div>
          ) : (
            <>
              {/* Gap Dates Timeline */}
              <div className="bg-white/5 border border-cyan-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">Unused Roster Slots by Date</h4>
                <div className="space-y-2">
                  {gapDates.map((gapDate) => {
                    const formattedDate = format(parseISO(gapDate.date), 'EEE, MMM d');
                    const totalSlots = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);

                    return (
                      <div
                        key={gapDate.date}
                        className="flex items-center justify-between p-2 bg-orange-500/10 border border-orange-500/30 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold text-white min-w-[100px]">
                            {formattedDate}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(gapDate.unusedSlots).map(([position, count]) => (
                              <span
                                key={position}
                                className="text-xs bg-orange-400/20 text-orange-300 px-2 py-0.5 rounded border border-orange-400/30"
                              >
                                {position} ×{count}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-orange-400 font-semibold">
                          {totalSlots} slot{totalSlots !== 1 ? 's' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team Recommendations */}
              <div className="bg-white/5 border border-cyan-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">Recommended Teams to Fill Gaps</h4>
                {isLoadingSchedule ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <div className="animate-pulse">Loading team recommendations...</div>
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <div className="mb-2">🏒</div>
                    <div>No team recommendations available</div>
                    <div className="text-xs mt-1">Try adjusting your time window</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recommendations.map((rec) => (
                      <div
                        key={rec.team}
                        className="flex items-start justify-between p-3 bg-cyan-500/5 border border-cyan-500/20 rounded hover:bg-cyan-500/10 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          {/* Team Logo */}
                          <img
                            src={`https://assets.nhle.com/logos/nhl/svg/${rec.team}_light.svg`}
                            alt={rec.team}
                            className="w-8 h-8 flex-shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            {/* Team Name */}
                            <div className="text-sm font-semibold text-white mb-1">
                              {rec.team}
                            </div>

                            {/* Positions */}
                            <div className="flex flex-wrap gap-1 mb-1">
                              {rec.positions.map((pos) => (
                                <span
                                  key={pos}
                                  className="text-xs bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-400/30"
                                >
                                  {pos}
                                </span>
                              ))}
                            </div>

                            {/* Gap dates covered */}
                            <div className="text-xs text-gray-400">
                              {rec.gapDatesCovered.length} gap date{rec.gapDatesCovered.length !== 1 ? 's' : ''} covered
                            </div>
                          </div>
                        </div>

                        {/* Total slots filled badge */}
                        <div className="flex-shrink-0 ml-3">
                          <div className="bg-cyan-500/20 border border-cyan-400/30 rounded px-2 py-1">
                            <div className="text-xs text-cyan-400 font-semibold">
                              {rec.totalSlotsFilled} slots
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
