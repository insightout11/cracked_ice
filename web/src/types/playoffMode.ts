export type PlayoffPreset =
  | `weeks-${number}-${number}` // A run of season weeks, e.g. weeks-26-28 (older links: 23-25, 24-26, 25-27)
  | 'league-weeks'    // My League Weeks (wizard mode)
  | 'custom';         // Custom date range

export type WeekStartDay = 'monday' | 'sunday' | 'saturday';

export interface LeagueWeekConfig {
  weekStartDay: WeekStartDay;
  selectedWeeks: number[]; // NHL season week numbers (1-26 typically)
}

export interface PlayoffPresetOption {
  value: PlayoffPreset;
  label: string;
  description?: string;
}

export interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  label: string; // e.g., "Week 22 (Mar 10-16)"
}

export interface PlayoffModeState {
  isEnabled: boolean;
  preset: PlayoffPreset;
  leagueWeekConfig?: LeagueWeekConfig;
}