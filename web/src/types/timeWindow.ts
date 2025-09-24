import { PlayoffModeState, PlayoffPreset } from './playoffMode';

export type TimeWindowMode = 'regular' | 'before-playoffs' | 'playoff';

export type TimeWindowPreset = '7d' | '14d' | '30d' | 'season' | 'custom';

export interface TimeWindowConfig {
  startUtc: string; // ISO string
  endUtc: string; // ISO string
  source: 'preset' | 'custom';
  preset?: TimeWindowPreset;
  displayLabel?: string;
}

export interface CustomDateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface TimeWindowState {
  mode: TimeWindowMode;
  preset: TimeWindowPreset;
  customRange?: CustomDateRange;
  config: TimeWindowConfig;
  error?: string;
  playoffMode?: PlayoffModeState;
}

export interface TimeWindowValidation {
  isValid: boolean;
  error?: string;
  maxDays?: number;
}

export interface SeasonBounds {
  start: Date;
  end: Date;
}

// UI Props interfaces
export interface TimeWindowProps {
  value: TimeWindowState;
  onChange: (state: TimeWindowState) => void;
  seasonBounds?: SeasonBounds;
  className?: string;
}

export interface DateRangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialRange?: CustomDateRange;
  onConfirm: (range: CustomDateRange) => void;
  seasonBounds?: SeasonBounds;
}

// URL sync types
export interface TimeWindowUrlParams {
  mode?: TimeWindowMode;
  tw?: TimeWindowPreset;
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  playoff?: PlayoffPreset; // For playoff mode presets
  weeks?: string; // Comma-separated week numbers for league weeks
  weekStart?: 'mon' | 'sun' | 'sat'; // Week start day
}