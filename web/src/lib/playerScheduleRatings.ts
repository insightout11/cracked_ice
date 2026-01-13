/**
 * Player Schedule Ratings
 *
 * Processes schedule data to show how each roster player's schedule rating
 * fluctuates across multiple fantasy weeks.
 */

import { addDays, format } from 'date-fns';
import type { WeeklySchedule, TeamWeek, TeamScheduleMetrics } from './schedule';
import { calculateTeamMetrics, computeB2B } from './schedule';

export interface PlayerWeekRating {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  week: string;          // ISO week string "2026-01-13"
  weekLabel: string;     // Display label "Jan 12-18"
  scheduleScore: number; // 0-100 composite score
  games: number;
  offNightGames: number;
  offNightPercentage: number;
}

// Simplified roster player interface for schedule visualization
// Accepts data from actual RosterPlayer schema (full_name, positions[])
export interface RosterPlayerInput {
  id?: string;
  full_name?: string;
  team?: string;
  positions?: string[];
  current_slot?: string;
}

/**
 * Format ISO week start date as date range
 * @param isoWeekStart - ISO week string (yyyy-MM-dd)
 * @returns Date range label like "Jan 12-18" or "Dec 30-Jan 5"
 */
function formatWeekDateRange(isoWeekStart: string): string {
  const start = new Date(isoWeekStart);
  const end = addDays(start, 6);

  const startMonth = format(start, 'MMM');
  const startDay = format(start, 'd');
  const endMonth = format(end, 'MMM');
  const endDay = format(end, 'd');

  // Same month: "Jan 12-18"
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }

  // Different months: "Dec 30-Jan 5"
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

/**
 * Get next ISO week start date
 */
function getNextWeek(isoWeekStart: string): string {
  const date = new Date(isoWeekStart);
  const nextWeek = addDays(date, 7);
  return format(nextWeek, 'yyyy-MM-dd');
}

/**
 * Calculate player schedule ratings for multiple weeks
 *
 * @param rosterPlayers - Array of roster players (with full_name, positions[])
 * @param startWeek - ISO week start date (e.g., "2026-01-13")
 * @param weekCount - Number of weeks to calculate (default 8)
 * @param fetchScheduleData - Function to fetch schedule data for a given week
 * @returns Array of player week ratings
 */
export async function getPlayerScheduleRatings(
  rosterPlayers: RosterPlayerInput[],
  startWeek: string,
  weekCount: number,
  fetchScheduleData: (weekOf: string) => Promise<WeeklySchedule>
): Promise<PlayerWeekRating[]> {
  const ratings: PlayerWeekRating[] = [];

  // Generate array of week start dates
  const weeks: string[] = [];
  let currentWeek = startWeek;
  for (let i = 0; i < weekCount; i++) {
    weeks.push(currentWeek);
    currentWeek = getNextWeek(currentWeek);
  }

  // Load schedule data for all weeks in parallel
  const scheduleDataPromises = weeks.map(week => fetchScheduleData(week));
  const scheduleDataArray = await Promise.all(scheduleDataPromises);

  // Build a map of week -> team -> metrics for quick lookup
  const scheduleMetricsByWeek = new Map<string, Map<string, TeamScheduleMetrics>>();

  scheduleDataArray.forEach((scheduleData, index) => {
    const week = weeks[index];
    const teamMetricsMap = new Map<string, TeamScheduleMetrics>();

    // Calculate max games for normalization
    const maxGames = Math.max(
      ...scheduleData.teams.map(team => {
        const days = Object.keys(team.gamesByDay);
        return days.reduce((sum, d) => sum + (team.gamesByDay[d as any]?.length ?? 0), 0);
      }),
      1
    );

    // Calculate metrics for each team
    scheduleData.teams.forEach(team => {
      const b2bSet = computeB2B(team);
      const metrics = calculateTeamMetrics(team, b2bSet, maxGames);
      teamMetricsMap.set(team.team.toUpperCase(), metrics);
    });

    scheduleMetricsByWeek.set(week, teamMetricsMap);
  });

  // For each roster player, get their schedule rating for each week
  rosterPlayers.forEach(player => {
    // Normalize player data (handle full_name vs name, positions[] vs position)
    const playerId = player.id || '';
    const playerName = player.full_name || '';
    const playerTeam = player.team || '';
    const playerPosition = player.positions?.[0] || '';

    if (!playerId || !playerName || !playerTeam) {
      // Skip players with missing required data
      return;
    }

    weeks.forEach((week, weekIndex) => {
      const weekLabel = formatWeekDateRange(week);

      const teamMetrics = scheduleMetricsByWeek.get(week)?.get(playerTeam.toUpperCase());

      if (teamMetrics) {
        ratings.push({
          playerId,
          playerName,
          team: playerTeam,
          position: playerPosition,
          week,
          weekLabel,
          scheduleScore: teamMetrics.scheduleScore,
          games: teamMetrics.totalGames,
          offNightGames: teamMetrics.offNightGames,
          offNightPercentage: teamMetrics.offNightPercentage,
        });
      } else {
        // No schedule data for this team/week - use 0 values
        ratings.push({
          playerId,
          playerName,
          team: playerTeam,
          position: playerPosition,
          week,
          weekLabel,
          scheduleScore: 0,
          games: 0,
          offNightGames: 0,
          offNightPercentage: 0,
        });
      }
    });
  });

  return ratings;
}

/**
 * Get schedule color based on score (0-100)
 * Red = tough, Yellow = medium, Green = easy
 */
export function getScheduleColor(score: number): string {
  if (score >= 75) return '#22c55e';  // Green (Tailwind green-500)
  if (score >= 60) return '#84cc16';  // Light green (Tailwind lime-500)
  if (score >= 50) return '#eab308';  // Yellow (Tailwind yellow-500)
  if (score >= 40) return '#f97316';  // Orange (Tailwind orange-500)
  return '#ef4444';                   // Red (Tailwind red-500)
}

/**
 * Get text color for readability on schedule color background
 */
export function getTextColor(score: number): string {
  // Dark text on light backgrounds (green/yellow), light text on dark backgrounds (red/orange)
  return score >= 50 ? '#1f2937' : '#f9fafb';
}
