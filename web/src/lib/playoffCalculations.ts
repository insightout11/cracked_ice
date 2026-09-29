import {
  PlayoffPreset,
  PlayoffPresetOption,
  WeekStartDay,
  LeagueWeekConfig,
  WeekInfo
} from '../types/playoffMode';
import { SeasonBounds } from '../types/timeWindow';
import { formatDate } from './timeWindow';
import { SEASON, seasonStartDate, seasonEndDate } from './season';
import { formatWeekRangeWithYahoo } from './yahooWeekConversion';

/** "weeks-26-28" -> [26, 28]; null for any other preset. */
export const parseWeekPreset = (preset: string): [number, number] | null => {
  const match = /^weeks-(\d+)-(\d+)$/.exec(preset);
  return match ? [Number(match[1]), Number(match[2])] : null;
};

/**
 * The season's default fantasy playoff weeks: every week touching the configured playoff
 * dates (config/season.json), so a new season moves them without code changes.
 */
export const defaultPlayoffWeeks = (): number[] => {
  const start = `${SEASON.defaultFantasyPlayoffsStart}`;
  const end = `${SEASON.defaultFantasyPlayoffsEnd}`;
  const weeks = generateSeasonWeeks({ start: seasonStartDate(), end: seasonEndDate() }, 'monday')
    .filter((week) => formatDate(week.endDate) >= start && formatDate(week.startDate) <= end)
    .map((week) => week.weekNumber);
  return weeks.length ? weeks : [24, 25, 26];
};

/** The first default playoff week (the "before playoffs" window ends the week before it). */
export const defaultPlayoffStartWeek = (): number => defaultPlayoffWeeks()[0];

/**
 * Get available playoff preset options: the season's default playoff weeks, and the same
 * length ending a week earlier (leagues that finish before the last NHL week).
 */
export const getPlayoffPresetOptions = (): PlayoffPresetOption[] => {
  const weeks = defaultPlayoffWeeks();
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  const option = (from: number, to: number, note: string): PlayoffPresetOption => ({
    value: `weeks-${from}-${to}`,
    label: formatWeekRangeWithYahoo(from, to),
    description: `Fantasy playoffs ${formatWeekRangeWithYahoo(from, to).toLowerCase()}${note}`,
  });
  return [
    option(first, last, ' (the usual playoff weeks)'),
    option(first - 1, last - 1, ' (a week earlier)'),
    ...PLAYOFF_CUSTOM_OPTIONS,
  ];
};

const PLAYOFF_CUSTOM_OPTIONS: PlayoffPresetOption[] = [
  { 
    value: 'league-weeks', 
    label: 'My League Weeks…',
    description: 'Configure your specific playoff weeks'
  },
  { 
    value: 'custom', 
    label: 'Custom range…',
    description: 'Select exact dates'
  }
];

/**
 * Get day number for WeekStartDay (Sunday = 0, Monday = 1, etc.)
 */
const getWeekStartDayNumber = (weekStartDay: WeekStartDay): number => {
  switch (weekStartDay) {
    case 'sunday': return 0;
    case 'monday': return 1;
    case 'saturday': return 6;
    default: return 1; // Default to Monday
  }
};

/**
 * Calculate date range for playoff presets
 */
export const calculatePlayoffPresetRange = (
  preset: PlayoffPreset,
  seasonBounds: SeasonBounds = { start: seasonStartDate(), end: seasonEndDate() },
  leagueWeekConfig?: LeagueWeekConfig
): { start: Date; end: Date } => {
  const seasonEnd = seasonBounds.end;

  const weekRange = parseWeekPreset(preset);
  if (weekRange) {
    const [first, last] = weekRange;
    const weeks = generateSeasonWeeks(seasonBounds, 'monday');
    const selectedWeeks = weeks.filter(w => w.weekNumber >= first && w.weekNumber <= last);
    if (!selectedWeeks.length) {
      throw new Error(`Weeks ${first}-${last} not found in season`);
    }
    return {
      start: selectedWeeks[0].startDate,
      end: selectedWeeks[selectedWeeks.length - 1].endDate
    };
  }

  switch (preset) {
    case 'league-weeks': {
      if (!leagueWeekConfig || !leagueWeekConfig.selectedWeeks.length) {
        throw new Error('League week configuration required for league-weeks preset');
      }
      
      const weeks = generateSeasonWeeks(seasonBounds, leagueWeekConfig.weekStartDay);
      const selectedWeeks = leagueWeekConfig.selectedWeeks
        .map(weekNum => weeks.find(w => w.weekNumber === weekNum))
        .filter(Boolean) as WeekInfo[];
      
      if (!selectedWeeks.length) {
        throw new Error('No valid weeks selected');
      }
      
      const start = selectedWeeks[0].startDate;
      const end = selectedWeeks[selectedWeeks.length - 1].endDate;
      
      return { start, end };
    }
    
    default:
      throw new Error(`Invalid playoff preset: ${preset}`);
  }
};

/** A date's calendar day at UTC midnight: season dates are "YYYY-MM-DD" parsed as UTC. */
const utcDay = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * Generate all weeks for the NHL season based on start day preference.
 *
 * Week 1 is the week holding opening night (Tue Sep 29 to Sun Oct 4 in 2026-27), as Yahoo
 * numbers it, clipped to the season's first day. Everything is in UTC calendar days, the
 * same as formatDate: reading local weekdays put week 1 on the opening week in the Americas
 * but on the next week east of UTC, so the same week number meant different dates.
 */
export const generateSeasonWeeks = (
  seasonBounds: SeasonBounds,
  weekStartDay: WeekStartDay = 'monday'
): WeekInfo[] => {
  const weeks: WeekInfo[] = [];
  const startDayNum = getWeekStartDayNumber(weekStartDay);
  const seasonStart = utcDay(seasonBounds.start);
  const seasonEnd = utcDay(seasonBounds.end);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // The week start day on or before opening night.
  let currentWeekStart = new Date(seasonStart);
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - ((currentWeekStart.getUTCDay() + 7 - startDayNum) % 7));
  let weekNumber = 1;

  while (currentWeekStart <= seasonEnd) {
    const weekStart = currentWeekStart < seasonStart ? seasonStart : currentWeekStart;
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setUTCDate(currentWeekStart.getUTCDate() + 6);
    const actualWeekEnd = weekEnd > seasonEnd ? seasonEnd : weekEnd;

    const startMonth = monthNames[weekStart.getUTCMonth()];
    const endMonth = monthNames[actualWeekEnd.getUTCMonth()];
    const startDay = weekStart.getUTCDate();
    const endDay = actualWeekEnd.getUTCDate();
    const label = startMonth === endMonth
      ? `Week ${weekNumber} (${startMonth} ${startDay}–${endDay})`
      : `Week ${weekNumber} (${startMonth} ${startDay}–${endMonth} ${endDay})`;

    weeks.push({
      weekNumber,
      startDate: new Date(weekStart),
      endDate: new Date(actualWeekEnd),
      label
    });

    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 7);
    weekNumber++;

    // Safety check to prevent infinite loops
    if (weekNumber > 32) break;
  }

  return weeks;
};

/**
 * Build display label for playoff configurations
 */
export const buildPlayoffDisplayLabel = (
  preset: PlayoffPreset,
  dateRange: { start: Date; end: Date },
  leagueWeekConfig?: LeagueWeekConfig
): string => {
  const startStr = formatDate(dateRange.start);
  const endStr = formatDate(dateRange.end);
  
  const weekRange = parseWeekPreset(preset);
  if (weekRange) return `Weeks ${weekRange[0]}-${weekRange[1]}: ${startStr} to ${endStr}`;

  switch (preset) {
    case 'league-weeks':
      if (leagueWeekConfig?.selectedWeeks) {
        const weekList = leagueWeekConfig.selectedWeeks.join(', ');
        return `League Weeks ${weekList}: ${startStr} to ${endStr}`;
      }
      return `League Weeks: ${startStr} to ${endStr}`;
    case 'custom':
      return `Custom: ${startStr} to ${endStr}`;
    default:
      return `${startStr} to ${endStr}`;
  }
};