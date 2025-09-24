import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  TeamTierData,
  TeamTierSettings,
  TeamTierCalculationResult,
  TeamTierApiRequest,
  DEFAULT_TIER_SETTINGS
} from '../types/teamTiers';
import { apiService } from '../services/api';

interface TeamTierState {
  data: TeamTierCalculationResult | null;
  loading: boolean;
  error: string | null;
  settings: TeamTierSettings;
  lastRequest: TeamTierApiRequest | null;
}

type TeamTierAction =
  | { type: 'FETCH_START'; request: TeamTierApiRequest }
  | { type: 'FETCH_SUCCESS'; data: TeamTierCalculationResult }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<TeamTierSettings> }
  | { type: 'CLEAR_ERROR' };

interface TeamTierContextType {
  state: TeamTierState;
  fetchTiers: (request?: TeamTierApiRequest) => Promise<void>;
  updateSettings: (newSettings: Partial<TeamTierSettings>) => void;
  getTeamTier: (teamCode: string) => TeamTierData | undefined;
  clearError: () => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'team-tier-settings';

const initialState: TeamTierState = {
  data: null,
  loading: false,
  error: null,
  settings: (() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      return savedSettings
        ? { ...DEFAULT_TIER_SETTINGS, ...JSON.parse(savedSettings) }
        : DEFAULT_TIER_SETTINGS;
    } catch {
      return DEFAULT_TIER_SETTINGS;
    }
  })(),
  lastRequest: null
};

function teamTierReducer(state: TeamTierState, action: TeamTierAction): TeamTierState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: true,
        error: null,
        lastRequest: action.request
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        data: action.data,
        error: null
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
        data: null
      };
    case 'UPDATE_SETTINGS':
      const newSettings = { ...state.settings, ...action.settings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
      }
      return {
        ...state,
        settings: newSettings
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
}

const TeamTierContext = createContext<TeamTierContextType | undefined>(undefined);

export function TeamTierProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(teamTierReducer, initialState);

  const fetchTiers = useCallback(async (request: TeamTierApiRequest = {}) => {
    console.log('🏒 TeamTierContext: fetchTiers called with request:', request);
    console.trace('🏒 TeamTierContext: Call stack for fetchTiers');

    dispatch({ type: 'FETCH_START', request });

    try {
      const result = await apiService.getTeamTiers(request);
      console.log('🏒 TeamTierContext: Successfully fetched team tiers, cyan teams:',
        result.teams.filter(t => t.tier === 'cyan').map(t => t.teamCode));
      dispatch({ type: 'FETCH_SUCCESS', data: result });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to fetch team tier data';
      console.error('🏒 TeamTierContext: Error fetching team tiers:', errorMessage);
      dispatch({ type: 'FETCH_ERROR', error: errorMessage });
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TeamTierSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: newSettings });
  }, []);

  const getTeamTier = useCallback((teamCode: string): TeamTierData | undefined => {
    if (!state.data || !teamCode) return undefined;
    return state.data.teams.find(team =>
      team.teamCode.toLowerCase() === teamCode.toLowerCase()
    );
  }, [state.data]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const refresh = useCallback(async () => {
    if (state.lastRequest) {
      await fetchTiers(state.lastRequest);
    }
  }, [fetchTiers, state.lastRequest]);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (error) {
      console.warn('Failed to save team tier settings to localStorage:', error);
    }
  }, [state.settings]);

  const contextValue: TeamTierContextType = {
    state,
    fetchTiers,
    updateSettings,
    getTeamTier,
    clearError,
    refresh
  };

  return (
    <TeamTierContext.Provider value={contextValue}>
      {children}
    </TeamTierContext.Provider>
  );
}

export function useTeamTiers(): TeamTierContextType {
  const context = useContext(TeamTierContext);
  if (context === undefined) {
    throw new Error('useTeamTiers must be used within a TeamTierProvider');
  }
  return context;
}

export function useTeamTierSettings() {
  const { state, updateSettings } = useTeamTiers();

  const toggleShowColors = useCallback(() => {
    updateSettings({ showScheduleColors: !state.settings.showScheduleColors });
  }, [state.settings.showScheduleColors, updateSettings]);

  const resetToDefaults = useCallback(() => {
    updateSettings(DEFAULT_TIER_SETTINGS);
  }, [updateSettings]);

  return {
    settings: state.settings,
    updateSettings,
    toggleShowColors,
    resetToDefaults
  };
}

export function useTeamTier(teamCode: string) {
  const { state, getTeamTier } = useTeamTiers();

  const teamTier = getTeamTier(teamCode);

  return {
    teamTier,
    loading: state.loading,
    error: state.error,
    hasData: !!state.data
  };
}