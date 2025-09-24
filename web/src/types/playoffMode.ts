export type PlayoffPreset =
  | 'weeks-23-25'     // Weeks 23-25 (legacy)
  | 'weeks-24-26'     // Weeks 24-26
  | 'weeks-25-27'     // Weeks 25-27
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