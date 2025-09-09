export type PlayoffPreset = 
  | 'yahoo-3weeks'    // Yahoo-style (Mon–Sun) – 3 weeks
  | 'espn-2weeks'     // ESPN-style (Mon–Sun) – 2 weeks  
  | 'nhl-final-2weeks' // Last 2 weeks of NHL season
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