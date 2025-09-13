import { 
  TimeWindowPreset, 
  TimeWindowConfig, 
  CustomDateRange, 
  TimeWindowValidation,
  TimeWindowState,
  TimeWindowMode,
  SeasonBounds 
} from '../types/timeWindow';
import { PlayoffPreset, PlayoffModeState, LeagueWeekConfig } from '../types/playoffMode';
import { calculatePlayoffPresetRange, buildPlayoffDisplayLabel } from './playoffCalculations';

// Default season bounds for 2025-2026
export const DEFAULT_SEASON_BOUNDS: SeasonBounds = {
  start: new Date('2025-10-01'),
  end: new Date('2026-04-30')
};

/**
 * Format date as YYYY-MM-DD
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Parse YYYY-MM-DD to Date
 */
export const parseDate = (dateStr: string): Date => {
  return new Date(dateStr + 'T00:00:00Z');
};

/**
 * Calculate absolute date range for a preset
 */
export const calculatePresetRange = (
  preset: TimeWindowPreset, 
  seasonBounds: SeasonBounds = DEFAULT_SEASON_BOUNDS
): { start: Date; end: Date } => {
  const today = new Date();
  const seasonStart = seasonBounds.start;
  
  switch (preset) {
    case '7d': {
      const baseDate = today < seasonStart ? seasonStart : today;
      const endDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start: baseDate, end: endDate };
    }
    case '14d': {
      const baseDate = today < seasonStart ? seasonStart : today;
      const endDate = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      return { start: baseDate, end: endDate };
    }
    case '30d': {
      const baseDate = today < seasonStart ? seasonStart : today;
      const endDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      return { start: baseDate, end: endDate };
    }
    case 'season':
      return { start: seasonBounds.start, end: seasonBounds.end };
    default:
      throw new Error(`Invalid preset: ${preset}`);
  }
};

/**
 * Build TimeWindowConfig from preset
 */
export const buildConfigFromPreset = (
  preset: TimeWindowPreset,
  seasonBounds?: SeasonBounds
): TimeWindowConfig => {
  if (preset === 'custom') {
    throw new Error('Use buildConfigFromCustomRange for custom preset');
  }

  const range = calculatePresetRange(preset, seasonBounds);
  const displayLabel = getPresetDisplayLabel(preset, range.start, range.end);
  
  return {
    startUtc: range.start.toISOString(),
    endUtc: range.end.toISOString(),
    source: 'preset',
    preset,
    displayLabel
  };
};

/**
 * Build TimeWindowConfig from custom range
 */
export const buildConfigFromCustomRange = (
  customRange: CustomDateRange
): TimeWindowConfig => {
  const start = parseDate(customRange.start);
  const end = parseDate(customRange.end);
  const displayLabel = getCustomDisplayLabel(start, end);
  
  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    source: 'custom',
    preset: 'custom',
    displayLabel
  };
};

/**
 * Get display label for preset
 */
export const getPresetDisplayLabel = (preset: TimeWindowPreset, start: Date, end: Date): string => {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  switch (preset) {
    case '7d':
      return `Next 7 days · ${startStr} → ${endStr}`;
    case '14d':
      return `Next 14 days · ${startStr} → ${endStr}`;
    case '30d':
      return `Next 30 days · ${startStr} → ${endStr}`;
    case 'season':
      return '2025-2026 Season';
    default:
      return 'Unknown';
  }
};

/**
 * Get display label for custom range
 */
export const getCustomDisplayLabel = (start: Date, end: Date): string => {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Custom · ${startStr} → ${endStr}`;
};

/**
 * Validate custom date range
 */
export const validateCustomRange = (
  range: CustomDateRange,
  seasonBounds: SeasonBounds = DEFAULT_SEASON_BOUNDS
): TimeWindowValidation => {
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  const maxDays = 120;
  
  // Check if start <= end
  if (start >= end) {
    return {
      isValid: false,
      error: 'Start date must be before end date',
      maxDays
    };
  }
  
  // Check max span
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > maxDays) {
    return {
      isValid: false,
      error: `Date range cannot exceed ${maxDays} days`,
      maxDays
    };
  }
  
  // Check season bounds
  if (start < seasonBounds.start || end > seasonBounds.end) {
    return {
      isValid: false,
      error: 'Date range must be within the 2025-2026 season',
      maxDays
    };
  }
  
  return { isValid: true, maxDays };
};

/**
 * Clamp custom range to season bounds
 */
export const clampRangeToSeason = (
  range: CustomDateRange,
  seasonBounds: SeasonBounds = DEFAULT_SEASON_BOUNDS
): CustomDateRange => {
  const start = parseDate(range.start);
  const end = parseDate(range.end);
  
  const clampedStart = start < seasonBounds.start ? seasonBounds.start : start;
  const clampedEnd = end > seasonBounds.end ? seasonBounds.end : end;
  
  return {
    start: formatDate(clampedStart),
    end: formatDate(clampedEnd)
  };
};

/**
 * Get preset options for UI
 */
export const getPresetOptions = () => [
  { value: '7d' as const, label: 'Next 7 days' },
  { value: '14d' as const, label: 'Next 14 days' },
  { value: '30d' as const, label: 'Next 30 days' },
  { value: 'season' as const, label: 'Full season' },
  { value: 'custom' as const, label: 'Custom range…' }
];

/**
 * Build TimeWindowConfig from playoff preset
 */
export const buildConfigFromPlayoffPreset = (
  preset: PlayoffPreset,
  seasonBounds?: SeasonBounds,
  leagueWeekConfig?: LeagueWeekConfig
): TimeWindowConfig => {
  if (preset === 'custom') {
    throw new Error('Custom playoff preset requires explicit date range');
  }

  try {
    const { start, end } = calculatePlayoffPresetRange(preset, seasonBounds, leagueWeekConfig);
    const displayLabel = buildPlayoffDisplayLabel(preset, { start, end }, leagueWeekConfig);

    return {
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      source: 'preset',
      preset: undefined, // Playoff presets don't use regular presets
      displayLabel
    };
  } catch (error) {
    console.error('Failed to build playoff preset config:', error);
    throw error;
  }
};