import { useState, useEffect, useCallback } from 'react';
import {
  TeamTierData,
  TeamTierSettings,
  TeamTierCalculationResult,
  TeamTierApiRequest,
  DEFAULT_TIER_SETTINGS
} from '../types/teamTiers';
import { apiService } from '../services/api';

interface UseTeamTiersState {
  data: TeamTierCalculationResult | null;
  loading: boolean;
  error: string | null;
  settings: TeamTierSettings;
}

interface UseTeamTiersActions {
  fetchTiers: (request?: TeamTierApiRequest) => Promise<void>;
  updateSettings: (newSettings: Partial<TeamTierSettings>) => void;
  getTeamTier: (teamCode: string) => TeamTierData | undefined;
  clearError: () => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'team-tier-settings';

/**
 * Custom hook for managing team tier data and settings
 */
export function useTeamTiers(): UseTeamTiersState & UseTeamTiersActions {
  const [state, setState] = useState<UseTeamTiersState>(() => {
    // Load settings from localStorage on initialization
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    const settings = savedSettings
      ? { ...DEFAULT_TIER_SETTINGS, ...JSON.parse(savedSettings) }
      : DEFAULT_TIER_SETTINGS;

    return {
      data: null,
      loading: false,
      error: null,
      settings
    };
  });

  const [lastRequest, setLastRequest] = useState<TeamTierApiRequest | undefined>();

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }, [state.settings]);

  const fetchTiers = useCallback(async (request: TeamTierApiRequest = {}) => {
    console.log('🏒 useTeamTiers: fetchTiers called with request:', request);
    console.trace('🏒 useTeamTiers: Call stack for fetchTiers');
    setState(prev => ({ ...prev, loading: true, error: null }));
    setLastRequest(request);

    try {
      const result = await apiService.getTeamTiers(request);
      console.log('🏒 useTeamTiers: Successfully fetched team tiers, cyan teams:',
        result.teams.filter(t => t.tier === 'cyan').map(t => t.teamCode));
      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to fetch team tier data';

      console.error('🏒 useTeamTiers: Error fetching team tiers:', errorMessage);
      setState(prev => ({
        ...prev,
        data: null,
        loading: false,
        error: errorMessage
      }));
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TeamTierSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  const getTeamTier = useCallback((teamCode: string): TeamTierData | undefined => {
    if (!state.data) return undefined;
    return state.data.teams.find(team =>
      team.teamCode.toLowerCase() === teamCode.toLowerCase()
    );
  }, [state.data]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const refresh = useCallback(async () => {
    if (lastRequest) {
      await fetchTiers(lastRequest);
    }
  }, [fetchTiers, lastRequest]);

  return {
    ...state,
    fetchTiers,
    updateSettings,
    getTeamTier,
    clearError,
    refresh
  };
}

/**
 * Hook for team tier settings only (lighter version)
 */
export function useTeamTierSettings() {
  const [settings, setSettings] = useState<TeamTierSettings>(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    return savedSettings
      ? { ...DEFAULT_TIER_SETTINGS, ...JSON.parse(savedSettings) }
      : DEFAULT_TIER_SETTINGS;
  });

  const updateSettings = useCallback((newSettings: Partial<TeamTierSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
  }, [settings]);

  const toggleShowColors = useCallback(() => {
    updateSettings({ showScheduleColors: !settings.showScheduleColors });
  }, [settings.showScheduleColors, updateSettings]);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_TIER_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TIER_SETTINGS));
  }, []);

  return {
    settings,
    updateSettings,
    toggleShowColors,
    resetToDefaults
  };
}

/**
 * Hook for getting a specific team's tier data
 */
export function useTeamTier(teamCode: string) {
  const { data, loading, error, getTeamTier } = useTeamTiers();

  const teamTier = getTeamTier(teamCode);

  return {
    teamTier,
    loading,
    error,
    hasData: !!data
  };
}