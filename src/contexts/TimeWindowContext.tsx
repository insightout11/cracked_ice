import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  TimeWindowState,
  TimeWindowPreset,
  TimeWindowMode,
  CustomDateRange,
  TimeWindowUrlParams,
  SeasonBounds
} from '../types/timeWindow';
import { PlayoffPreset, LeagueWeekConfig } from '../types/playoffMode';
import {
  buildConfigFromPreset,
  buildConfigFromCustomRange,
  buildConfigFromPlayoffPreset,
  buildConfigFromBeforePlayoffs,
  validateCustomRange,
  DEFAULT_SEASON_BOUNDS
} from '../lib/timeWindow';

const DEFAULT_PRESET: TimeWindowPreset = 'season';

// localStorage keys
const STORAGE_KEYS = {
  MODE: 'off-night-time-window-mode',
  PLAYOFF_PRESET: 'off-night-playoff-preset',
  PLAYOFF_CUSTOM_DATES: 'off-night-playoff-custom-dates',
  LEAGUE_WEEKS: 'off-night-league-weeks'
};

interface TimeWindowContextType {
  state: TimeWindowState;
  setPreset: (preset: TimeWindowPreset) => void;
  setCustomRange: (range: CustomDateRange) => void;
  setMode: (mode: TimeWindowMode) => void;
  setPlayoffPreset: (preset: PlayoffPreset) => void;
  setLeagueWeeks: (config: LeagueWeekConfig) => void;
  updateState: (newState: TimeWindowState) => void;
}

type TimeWindowAction =
  | { type: 'SET_STATE'; state: TimeWindowState }
  | { type: 'SET_PRESET'; preset: TimeWindowPreset }
  | { type: 'SET_CUSTOM_RANGE'; range: CustomDateRange }
  | { type: 'SET_MODE'; mode: TimeWindowMode }
  | { type: 'SET_PLAYOFF_PRESET'; preset: PlayoffPreset }
  | { type: 'SET_LEAGUE_WEEKS'; config: LeagueWeekConfig };

function timeWindowReducer(state: TimeWindowState, action: TimeWindowAction): TimeWindowState {
  switch (action.type) {
    case 'SET_STATE':
      return action.state;
    case 'SET_PRESET':
      if (action.preset === 'custom') {
        return state; // Don't auto-switch to custom without a range
      }
      try {
        const config = buildConfigFromPreset(action.preset, DEFAULT_SEASON_BOUNDS);
        return {
          ...state,
          preset: action.preset,
          config,
          customRange: undefined,
          error: undefined
        };
      } catch (error) {
        console.error('Failed to set preset:', error);
        return state;
      }
    case 'SET_CUSTOM_RANGE':
      const validation = validateCustomRange(action.range, DEFAULT_SEASON_BOUNDS);
      if (!validation.isValid) {
        return {
          ...state,
          preset: 'custom',
          customRange: action.range,
          error: validation.error
        };
      }
      try {
        const config = buildConfigFromCustomRange(action.range);
        return {
          ...state,
          preset: 'custom',
          customRange: action.range,
          config,
          error: undefined
        };
      } catch (error) {
        console.error('Failed to set custom range:', error);
        return state;
      }
    case 'SET_MODE':
      console.log('🕰️ TimeWindow Context: Mode changing from', state.mode, 'to', action.mode);
      const newState: TimeWindowState = {
        ...state,
        mode: action.mode,
        // Reset to appropriate defaults when switching modes
        ...(action.mode === 'regular' ? {
          preset: DEFAULT_PRESET,
          playoffMode: undefined
        } : action.mode === 'before-playoffs' ? {
          preset: 'custom', // Before-playoffs mode uses custom preset type
          playoffMode: undefined
        } : {
          preset: 'custom', // Playoff mode always uses custom preset type
          playoffMode: {
            isEnabled: true,
            preset: 'league-weeks', // Default to league weeks
            leagueWeekConfig: {
              weekStartDay: 'monday',
              selectedWeeks: [22, 23, 24] // Default 3-week playoff
            }
          }
        })
      };

      // Rebuild config for the new mode
      try {
        if (action.mode === 'regular') {
          newState.config = buildConfigFromPreset(DEFAULT_PRESET, DEFAULT_SEASON_BOUNDS);
        } else if (action.mode === 'before-playoffs') {
          newState.config = buildConfigFromBeforePlayoffs(DEFAULT_SEASON_BOUNDS);
        } else {
          newState.config = buildConfigFromPlayoffPreset('league-weeks', DEFAULT_SEASON_BOUNDS, {
            weekStartDay: 'monday',
            selectedWeeks: [22, 23, 24]
          });
        }
        newState.error = undefined;
      } catch (error) {
        console.error('Failed to switch modes:', error);
        newState.error = error instanceof Error ? error.message : 'Failed to switch modes';
      }
      return newState;
    case 'SET_PLAYOFF_PRESET':
      if (state.mode !== 'playoff') return state;
      try {
        const config = buildConfigFromPlayoffPreset(action.preset, DEFAULT_SEASON_BOUNDS, state.playoffMode?.leagueWeekConfig);
        return {
          ...state,
          config,
          playoffMode: {
            ...state.playoffMode,
            isEnabled: true,
            preset: action.preset
          },
          error: undefined
        };
      } catch (error) {
        console.error('Failed to set playoff preset:', error);
        return state;
      }
    case 'SET_LEAGUE_WEEKS':
      if (state.mode !== 'playoff') return state;
      try {
        const config = buildConfigFromPlayoffPreset('league-weeks', DEFAULT_SEASON_BOUNDS, action.config);
        return {
          ...state,
          config,
          playoffMode: {
            ...state.playoffMode,
            isEnabled: true,
            preset: 'league-weeks',
            leagueWeekConfig: action.config
          },
          error: undefined
        };
      } catch (error) {
        console.error('Failed to set league weeks:', error);
        return state;
      }
    default:
      return state;
  }
}

const TimeWindowContext = createContext<TimeWindowContextType | undefined>(undefined);

export function TimeWindowProvider({ children }: { children: React.ReactNode }) {
  // Initialize from URL params with localStorage fallback
  const [state, dispatch] = useReducer(timeWindowReducer, buildInitialState());

  // Persist preferences to localStorage
  const persistToStorage = useCallback((newState: TimeWindowState) => {
    try {
      // Always save the mode
      localStorage.setItem(STORAGE_KEYS.MODE, newState.mode);

      // Save playoff-specific preferences
      if (newState.mode === 'playoff' && newState.playoffMode) {
        localStorage.setItem(STORAGE_KEYS.PLAYOFF_PRESET, newState.playoffMode.preset);

        // Save custom dates for playoff mode
        if (newState.playoffMode.preset === 'custom' && newState.customRange) {
          localStorage.setItem(STORAGE_KEYS.PLAYOFF_CUSTOM_DATES, JSON.stringify(newState.customRange));
        }

        // Save league weeks configuration
        if (newState.playoffMode.preset === 'league-weeks' && newState.playoffMode.leagueWeekConfig) {
          localStorage.setItem(STORAGE_KEYS.LEAGUE_WEEKS, JSON.stringify(newState.playoffMode.leagueWeekConfig));
        }
      }
    } catch (error) {
      console.warn('Failed to save time window preferences to localStorage:', error);
    }
  }, []);

  // Enhanced updateState with localStorage persistence
  const updateStateWithPersistence = useCallback((newState: TimeWindowState) => {
    console.log('🕰️ TimeWindow Context: Updating state:', newState);
    dispatch({ type: 'SET_STATE', state: newState });
    persistToStorage(newState);

    // Update URL params
    const urlParams: TimeWindowUrlParams = {
      mode: newState.mode
    };

    if (newState.mode === 'regular') {
      urlParams.tw = newState.preset;

      if (newState.preset === 'custom' && newState.customRange) {
        urlParams.start = newState.customRange.start;
        urlParams.end = newState.customRange.end;
      }
    } else if (newState.mode === 'before-playoffs') {
      // Before-playoffs mode doesn't need extra URL params - it's a fixed range
    } else if (newState.mode === 'playoff' && newState.playoffMode) {
      urlParams.playoff = newState.playoffMode.preset;

      if (newState.playoffMode.preset === 'league-weeks' && newState.playoffMode.leagueWeekConfig) {
        urlParams.weeks = newState.playoffMode.leagueWeekConfig.selectedWeeks.join(',');
        urlParams.weekStart = newState.playoffMode.leagueWeekConfig.weekStartDay === 'sunday' ? 'sun' :
                              newState.playoffMode.leagueWeekConfig.weekStartDay === 'saturday' ? 'sat' : 'mon';
      }

      if (newState.playoffMode.preset === 'custom' && newState.customRange) {
        urlParams.start = newState.customRange.start;
        urlParams.end = newState.customRange.end;
      }
    }

    updateBrowserUrlParams(urlParams);
  }, [persistToStorage]);

  // Update state when URL changes (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = parseUrlParamsFromBrowser();
      const newState = buildInitialState(urlParams);
      dispatch({ type: 'SET_STATE', state: newState });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setPreset = useCallback((preset: TimeWindowPreset) => {
    dispatch({ type: 'SET_PRESET', preset });
  }, []);

  const setCustomRange = useCallback((range: CustomDateRange) => {
    dispatch({ type: 'SET_CUSTOM_RANGE', range });
  }, []);

  const setMode = useCallback((mode: TimeWindowMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const setPlayoffPreset = useCallback((preset: PlayoffPreset) => {
    dispatch({ type: 'SET_PLAYOFF_PRESET', preset });
  }, []);

  const setLeagueWeeks = useCallback((config: LeagueWeekConfig) => {
    dispatch({ type: 'SET_LEAGUE_WEEKS', config });
  }, []);

  // Persist state changes to localStorage
  useEffect(() => {
    persistToStorage(state);
  }, [state, persistToStorage]);

  const contextValue: TimeWindowContextType = {
    state,
    setPreset,
    setCustomRange,
    setMode,
    setPlayoffPreset,
    setLeagueWeeks,
    updateState: updateStateWithPersistence
  };

  return (
    <TimeWindowContext.Provider value={contextValue}>
      {children}
    </TimeWindowContext.Provider>
  );
}

export function useTimeWindow(): TimeWindowContextType {
  const context = useContext(TimeWindowContext);
  if (context === undefined) {
    throw new Error('useTimeWindow must be used within a TimeWindowProvider');
  }
  return context;
}

/**
 * Parse URL search params from browser into TimeWindowUrlParams
 */
function parseUrlParamsFromBrowser(): TimeWindowUrlParams {
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode') as TimeWindowMode | null;
  const tw = searchParams.get('tw') as TimeWindowPreset | null;
  const start = searchParams.get('start') || undefined;
  const end = searchParams.get('end') || undefined;
  const playoff = searchParams.get('playoff') || undefined;
  const weeks = searchParams.get('weeks') || undefined;
  const weekStart = searchParams.get('weekStart') || undefined;

  return {
    mode: mode || undefined,
    tw: tw || undefined,
    start,
    end,
    playoff: playoff as any,
    weeks,
    weekStart: weekStart as any
  };
}

/**
 * Build initial state from URL params
 */
function buildInitialState(urlParams?: TimeWindowUrlParams): TimeWindowState {
  if (!urlParams) {
    urlParams = parseUrlParamsFromBrowser();
  }

  // Try localStorage fallback for mode if not in URL
  const savedMode = localStorage.getItem(STORAGE_KEYS.MODE) as TimeWindowMode | null;
  const mode = urlParams.mode || savedMode || 'regular';
  const preset = urlParams.tw || DEFAULT_PRESET;

  try {
    // Handle before-playoffs mode
    if (mode === 'before-playoffs') {
      const config = buildConfigFromBeforePlayoffs(DEFAULT_SEASON_BOUNDS);
      return {
        mode: 'before-playoffs',
        preset: 'custom',
        config,
        error: undefined
      };
    }

    // Handle playoff mode
    if (mode === 'playoff') {
      const playoffPreset = urlParams.playoff || 'league-weeks';

      // Handle league weeks with URL params
      if (playoffPreset === 'league-weeks' && urlParams.weeks && urlParams.weekStart) {
        const leagueWeekConfig: LeagueWeekConfig = {
          weekStartDay: urlParams.weekStart === 'sun' ? 'sunday' :
                       urlParams.weekStart === 'sat' ? 'saturday' : 'monday',
          selectedWeeks: urlParams.weeks.split(',').map(w => parseInt(w, 10)).filter(n => !isNaN(n))
        };

        try {
          const config = buildConfigFromPlayoffPreset('league-weeks', DEFAULT_SEASON_BOUNDS, leagueWeekConfig);
          return {
            mode: 'playoff',
            preset: 'custom',
            config,
            playoffMode: {
              isEnabled: true,
              preset: 'league-weeks',
              leagueWeekConfig
            },
            error: undefined
          };
        } catch (error) {
          // Fall back to default playoff preset
        }
      }

      // Handle custom playoff range
      if (playoffPreset === 'custom' && urlParams.start && urlParams.end) {
        const customRange: CustomDateRange = {
          start: urlParams.start,
          end: urlParams.end
        };

        const validation = validateCustomRange(customRange, DEFAULT_SEASON_BOUNDS);
        if (validation.isValid) {
          const config = buildConfigFromCustomRange(customRange);
          return {
            mode: 'playoff',
            preset: 'custom',
            customRange,
            config,
            playoffMode: {
              isEnabled: true,
              preset: 'custom'
            },
            error: undefined
          };
        }
      }

      // Load saved league weeks from localStorage
      try {
        const savedLeagueWeeks = localStorage.getItem(STORAGE_KEYS.LEAGUE_WEEKS);
        const leagueWeekConfig = savedLeagueWeeks
          ? JSON.parse(savedLeagueWeeks)
          : {
              weekStartDay: 'monday' as const,
              selectedWeeks: [22, 23, 24]
            };

        const config = buildConfigFromPlayoffPreset(
          playoffPreset === 'league-weeks' ? 'league-weeks' : playoffPreset,
          DEFAULT_SEASON_BOUNDS,
          playoffPreset === 'league-weeks' ? leagueWeekConfig : undefined
        );

        return {
          mode: 'playoff',
          preset: 'custom',
          config,
          playoffMode: {
            isEnabled: true,
            preset: playoffPreset,
            ...(playoffPreset === 'league-weeks' ? { leagueWeekConfig } : {})
          },
          error: undefined
        };
      } catch (error) {
        // Fall back to default
      }
    }

    // Handle regular mode (or fallback)
    if (preset === 'custom' && urlParams.start && urlParams.end) {
      const customRange: CustomDateRange = {
        start: urlParams.start,
        end: urlParams.end
      };

      const validation = validateCustomRange(customRange, DEFAULT_SEASON_BOUNDS);
      if (!validation.isValid) {
        // Fall back to default preset if custom range is invalid
        const config = buildConfigFromPreset(DEFAULT_PRESET, DEFAULT_SEASON_BOUNDS);
        return {
          mode: 'regular',
          preset: DEFAULT_PRESET,
          config,
          error: undefined
        };
      }

      const config = buildConfigFromCustomRange(customRange);
      return {
        mode: 'regular',
        preset: 'custom',
        customRange,
        config,
        error: undefined
      };
    }

    // Handle regular preset
    if (preset !== 'custom') {
      const config = buildConfigFromPreset(preset, DEFAULT_SEASON_BOUNDS);
      return {
        mode: 'regular',
        preset,
        config,
        error: undefined
      };
    }

    // Fallback to default
    const config = buildConfigFromPreset(DEFAULT_PRESET, DEFAULT_SEASON_BOUNDS);
    return {
      mode: 'regular',
      preset: DEFAULT_PRESET,
      config,
      error: undefined
    };
  } catch (error) {
    console.error('Failed to build initial state:', error);

    // Ultimate fallback
    const config = buildConfigFromPreset(DEFAULT_PRESET, DEFAULT_SEASON_BOUNDS);
    return {
      mode: 'regular',
      preset: DEFAULT_PRESET,
      config,
      error: undefined
    };
  }
}

/**
 * Update browser URL params without replacing other params
 */
function updateBrowserUrlParams(timeWindowParams: TimeWindowUrlParams) {
  const currentParams = new URLSearchParams(window.location.search);

  // Clear existing time window params
  currentParams.delete('mode');
  currentParams.delete('tw');
  currentParams.delete('playoff');
  currentParams.delete('weeks');
  currentParams.delete('weekStart');
  currentParams.delete('start');
  currentParams.delete('end');

  // Set new time window params
  if (timeWindowParams.mode) {
    currentParams.set('mode', timeWindowParams.mode);
  }

  if (timeWindowParams.tw) {
    currentParams.set('tw', timeWindowParams.tw);
  }

  if (timeWindowParams.playoff) {
    currentParams.set('playoff', timeWindowParams.playoff);
  }

  if (timeWindowParams.weeks) {
    currentParams.set('weeks', timeWindowParams.weeks);
  }

  if (timeWindowParams.weekStart) {
    currentParams.set('weekStart', timeWindowParams.weekStart);
  }

  if (timeWindowParams.start) {
    currentParams.set('start', timeWindowParams.start);
  }

  if (timeWindowParams.end) {
    currentParams.set('end', timeWindowParams.end);
  }

  // Update URL without page reload
  const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
  window.history.pushState(null, '', newUrl);
}