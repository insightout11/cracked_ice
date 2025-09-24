import { 
  PlayoffPreset, 
  PlayoffPresetOption, 
  WeekStartDay, 
  LeagueWeekConfig, 
  WeekInfo 
} from '../types/playoffMode';
import { SeasonBounds } from '../types/timeWindow';
import { formatDate } from './timeWindow';

/**
 * Get available playoff preset options
 */
export const getPlayoffPresetOptions = (): PlayoffPresetOption[] => [
  {
    value: 'weeks-24-26',
    label: 'Weeks 24-26',
    description: 'Fantasy playoffs weeks 24-26'
  },
  {
    value: 'weeks-25-27',
    label: 'Weeks 25-27',
    description: 'Fantasy playoffs weeks 25-27'
  },
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
 * Find the last occurrence of a specific day before a given date
 */
const findLastDayBefore = (date: Date, targetDay: number): Date => {
  const result = new Date(date);
  const daysDiff = (result.getDay() + 7 - targetDay) % 7;
  result.setDate(result.getDate() - daysDiff);
  return result;
};

/**
 * Find the first occurrence of a specific day on or after a given date
 */
const findFirstDayOnOrAfter = (date: Date, targetDay: number): Date => {
  const result = new Date(date);
  const daysDiff = (targetDay - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + daysDiff);
  return result;
};

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
  seasonBounds: SeasonBounds = { start: new Date('2025-10-01'), end: new Date('2026-04-30') },
  leagueWeekConfig?: LeagueWeekConfig
): { start: Date; end: Date } => {
  const seasonEnd = seasonBounds.end;

  switch (preset) {
    case 'weeks-23-25': {
      // Generate season weeks and find weeks 23-25
      const weeks = generateSeasonWeeks(seasonBounds, 'monday');
      const selectedWeeks = weeks.filter(w => w.weekNumber >= 23 && w.weekNumber <= 25);
      
      if (!selectedWeeks.length) {
        throw new Error('Weeks 23-25 not found in season');
      }
      
      return { 
        start: selectedWeeks[0].startDate, 
        end: selectedWeeks[selectedWeeks.length - 1].endDate 
      };
    }
    
    case 'weeks-24-26': {
      // Generate season weeks and find weeks 24-26
      const weeks = generateSeasonWeeks(seasonBounds, 'monday');
      const selectedWeeks = weeks.filter(w => w.weekNumber >= 24 && w.weekNumber <= 26);

      if (!selectedWeeks.length) {
        throw new Error('Weeks 24-26 not found in season');
      }

      return {
        start: selectedWeeks[0].startDate,
        end: selectedWeeks[selectedWeeks.length - 1].endDate
      };
    }

    case 'weeks-25-27': {
      // Generate season weeks and find weeks 25-27
      const weeks = generateSeasonWeeks(seasonBounds, 'monday');
      const selectedWeeks = weeks.filter(w => w.weekNumber >= 25 && w.weekNumber <= 27);

      if (!selectedWeeks.length) {
        throw new Error('Weeks 25-27 not found in season');
      }

      return {
        start: selectedWeeks[0].startDate,
        end: selectedWeeks[selectedWeeks.length - 1].endDate
      };
    }
    
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

/**
 * Generate all weeks for the NHL season based on start day preference
 */
export const generateSeasonWeeks = (
  seasonBounds: SeasonBounds,
  weekStartDay: WeekStartDay = 'monday'
): WeekInfo[] => {
  const weeks: WeekInfo[] = [];
  const startDayNum = getWeekStartDayNumber(weekStartDay);
  
  // Find the first week start day on or after season start
  let currentWeekStart = findFirstDayOnOrAfter(seasonBounds.start, startDayNum);
  let weekNumber = 1;
  
  while (currentWeekStart < seasonBounds.end) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6); // End of week (6 days later)
    
    // Don't go past season end
    const actualWeekEnd = weekEnd > seasonBounds.end ? seasonBounds.end : weekEnd;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const startMonth = monthNames[currentWeekStart.getMonth()];
    const endMonth = monthNames[actualWeekEnd.getMonth()];
    
    const startDay = currentWeekStart.getDate();
    const endDay = actualWeekEnd.getDate();
    
    const label = startMonth === endMonth 
      ? `Week ${weekNumber} (${startMonth} ${startDay}–${endDay})`
      : `Week ${weekNumber} (${startMonth} ${startDay}–${endMonth} ${endDay})`;
    
    weeks.push({
      weekNumber,
      startDate: new Date(currentWeekStart),
      endDate: new Date(actualWeekEnd),
      label
    });
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    weekNumber++;
    
    // Safety check to prevent infinite loops
    if (weekNumber > 30) break;
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
  
  switch (preset) {
    case 'weeks-23-25':
      return `Weeks 23-25: ${startStr} to ${endStr}`;
    case 'weeks-24-26':
      return `Weeks 24-26: ${startStr} to ${endStr}`;
    case 'weeks-25-27':
      return `Weeks 25-27: ${startStr} to ${endStr}`;
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