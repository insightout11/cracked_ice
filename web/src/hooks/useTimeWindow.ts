import { useState, useEffect, useCallback } from 'react';
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

export const useTimeWindow = (seasonBounds: SeasonBounds = DEFAULT_SEASON_BOUNDS) => {
  const [state, setState] = useState<TimeWindowState>(() => {
    // Initialize from URL params with localStorage fallback
    const urlParams = parseUrlParamsFromBrowser();
    return buildInitialState(urlParams, seasonBounds);
  });

  // Update state when URL changes (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = parseUrlParamsFromBrowser();
      const newState = buildInitialState(urlParams, seasonBounds);
      setState(newState);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [seasonBounds]);

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
    setState(newState);
    persistToStorage(newState);
    
    // Update URL params (existing logic)
    const urlParams: TimeWindowUrlParams = {
      mode: newState.mode
    };
    
    if (newState.mode === 'regular') {
      urlParams.tw = newState.preset;
      
      if (newState.preset === 'custom' && newState.customRange) {
        urlParams.start = newState.customRange.start;
        urlParams.end = newState.customRange.end;
      }
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

  // Helper functions for common operations
  const setPreset = useCallback((preset: TimeWindowPreset) => {
    if (preset === 'custom') {
      // Don't auto-switch to custom without a range
      return;
    }
    
    try {
      const config = buildConfigFromPreset(preset, seasonBounds);
      const newState: TimeWindowState = {
        ...state,
        preset,
        config,
        customRange: undefined,
        error: undefined
      };
      updateStateWithPersistence(newState);
    } catch (error) {
      console.error('Failed to set preset:', error);
    }
  }, [updateStateWithPersistence, seasonBounds]);

  const setCustomRange = useCallback((customRange: CustomDateRange) => {
    const validation = validateCustomRange(customRange, seasonBounds);
    
    if (!validation.isValid) {
      const errorState: TimeWindowState = {
        ...state,
        preset: 'custom',
        customRange,
        error: validation.error
      };
      setState(errorState); // Don't update URL for invalid state
      return;
    }
    
    try {
      const config = buildConfigFromCustomRange(customRange);
      const newState: TimeWindowState = {
        ...state,
        preset: 'custom',
        customRange,
        config,
        error: undefined
      };
      updateStateWithPersistence(newState);
    } catch (error) {
      console.error('Failed to set custom range:', error);
    }
  }, [state, updateStateWithPersistence, seasonBounds]);

  // Mode change handler
  const setMode = useCallback((mode: TimeWindowMode) => {
    const newState: TimeWindowState = {
      ...state,
      mode,
      // Reset to appropriate defaults when switching modes
      ...(mode === 'regular' ? {
        preset: DEFAULT_PRESET,
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
      if (mode === 'regular') {
        newState.config = buildConfigFromPreset(DEFAULT_PRESET, seasonBounds);
      } else {
        newState.config = buildConfigFromPlayoffPreset('league-weeks', seasonBounds, {
          weekStartDay: 'monday',
          selectedWeeks: [22, 23, 24]
        });
      }
      newState.error = undefined;
    } catch (error) {
      console.error('Failed to switch modes:', error);
      newState.error = error instanceof Error ? error.message : 'Failed to switch modes';
    }

    updateStateWithPersistence(newState);
  }, [state, updateStateWithPersistence, seasonBounds]);

  // Playoff preset handler
  const setPlayoffPreset = useCallback((preset: PlayoffPreset) => {
    if (state.mode !== 'playoff') return;

    try {
      const config = buildConfigFromPlayoffPreset(preset, seasonBounds, state.playoffMode?.leagueWeekConfig);
      const newState: TimeWindowState = {
        ...state,
        config,
        playoffMode: {
          ...state.playoffMode,
          isEnabled: true,
          preset
        },
        error: undefined
      };
      updateStateWithPersistence(newState);
    } catch (error) {
      console.error('Failed to set playoff preset:', error);
    }
  }, [state, updateStateWithPersistence, seasonBounds]);

  // League weeks handler
  const setLeagueWeeks = useCallback((leagueWeekConfig: LeagueWeekConfig) => {
    if (state.mode !== 'playoff') return;

    try {
      const config = buildConfigFromPlayoffPreset('league-weeks', seasonBounds, leagueWeekConfig);
      const newState: TimeWindowState = {
        ...state,
        config,
        playoffMode: {
          ...state.playoffMode,
          isEnabled: true,
          preset: 'league-weeks',
          leagueWeekConfig
        },
        error: undefined
      };
      updateStateWithPersistence(newState);
    } catch (error) {
      console.error('Failed to set league weeks:', error);
    }
  }, [state, updateStateWithPersistence, seasonBounds]);

  return {
    state,
    setPreset,
    setCustomRange,
    setMode,
    setPlayoffPreset,
    setLeagueWeeks,
    updateState: updateStateWithPersistence
  };
};

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
    playoff,
    weeks,
    weekStart
  };
}

/**
 * Build initial state from URL params
 */
function buildInitialState(
  urlParams: TimeWindowUrlParams, 
  seasonBounds: SeasonBounds
): TimeWindowState {
  // Try localStorage fallback for mode if not in URL
  const savedMode = localStorage.getItem(STORAGE_KEYS.MODE) as TimeWindowMode | null;
  const mode = urlParams.mode || savedMode || 'regular';
  const preset = urlParams.tw || DEFAULT_PRESET;
  
  try {
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
          const config = buildConfigFromPlayoffPreset('league-weeks', seasonBounds, leagueWeekConfig);
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
        
        const validation = validateCustomRange(customRange, seasonBounds);
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
      
      // Default playoff preset
      try {
        const defaultLeagueWeekConfig = {
          weekStartDay: 'monday' as const,
          selectedWeeks: [22, 23, 24]
        };
        
        const config = buildConfigFromPlayoffPreset(
          playoffPreset, 
          seasonBounds, 
          playoffPreset === 'league-weeks' ? defaultLeagueWeekConfig : undefined
        );
        
        return {
          mode: 'playoff',
          preset: 'custom',
          config,
          playoffMode: {
            isEnabled: true,
            preset: playoffPreset,
            ...(playoffPreset === 'league-weeks' ? { leagueWeekConfig: defaultLeagueWeekConfig } : {})
          },
          error: undefined
        };
      } catch (error) {
        // Fall back to regular mode
      }
    }
    
    // Handle regular mode (or fallback)
    if (preset === 'custom' && urlParams.start && urlParams.end) {
      const customRange: CustomDateRange = {
        start: urlParams.start,
        end: urlParams.end
      };
      
      const validation = validateCustomRange(customRange, seasonBounds);
      if (!validation.isValid) {
        // Fall back to default preset if custom range is invalid
        const config = buildConfigFromPreset(DEFAULT_PRESET, seasonBounds);
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
      const config = buildConfigFromPreset(preset, seasonBounds);
      return {
        mode: 'regular',
        preset,
        config,
        error: undefined
      };
    }
    
    // Fallback to default
    const config = buildConfigFromPreset(DEFAULT_PRESET, seasonBounds);
    return {
      mode: 'regular',
      preset: DEFAULT_PRESET,
      config,
      error: undefined
    };
  } catch (error) {
    console.error('Failed to build initial state:', error);
    
    // Ultimate fallback
    const config = buildConfigFromPreset(DEFAULT_PRESET, seasonBounds);
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