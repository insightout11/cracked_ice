/**
 * Shared utilities for roster gap analysis
 * Used by both desktop RosterGapsPanel and mobile MobileGapsView
 */

export interface PositionRecommendation {
  team: string;
  gapDatesCovered: number;  // Number of gap dates this team plays on
  gapDates: string[];       // Actual dates (for details/tooltips)
}

export interface ScheduleData {
  games: Record<string, Array<{ date: string; opponent?: string; home?: boolean }>>;
}

/**
 * Calculate position-specific team recommendations based on schedule and gap dates
 * For each position with gaps, finds teams that play on those gap dates
 */
export function calculatePositionSpecificRecommendations(
  unusedSlotsByDate: Record<string, Record<string, number>>,
  scheduleData: ScheduleData | null,
  positionsToAnalyze: string[] = ['C', 'LW', 'RW', 'D', 'G']
): Record<string, PositionRecommendation[]> {
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
        const teamGames = games as Array<{ date: string }>;
        const playsOnDate = teamGames.some((game) => game.date === date);

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
}

/**
 * Format game dates for display
 * Returns dates as "Mon 12/22, Tue 12/23" format
 */
export function formatGameDates(dates: string[]): string {
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
}

/**
 * Count total gap dates for a position
 */
export function countPositionGapDates(
  unusedSlotsByDate: Record<string, Record<string, number>>,
  position: string
): number {
  let count = 0;
  Object.values(unusedSlotsByDate).forEach(slots => {
    if (slots[position] && slots[position] > 0) {
      count++;
    }
  });
  return count;
}
