import { useState, useCallback } from 'react';
import type { MobileTab } from '../components/MobileBottomNav';

interface MobileNavigationState {
  activeTab: MobileTab;
  // Filter state for Players tab
  playerFilters: {
    position: string | null;
    team: string | null;
    search: string;
  };
}

interface UseMobileNavigationReturn {
  // Tab navigation
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;

  // Player filters (for cross-tab navigation)
  playerFilters: MobileNavigationState['playerFilters'];
  setPlayerFilters: (filters: Partial<MobileNavigationState['playerFilters']>) => void;
  clearPlayerFilters: () => void;

  // Navigation helpers
  navigateToPlayersWithFilter: (filter: { position?: string; team?: string }) => void;
  navigateToGaps: () => void;
  navigateToSettings: () => void;
}

/**
 * useMobileNavigation - Central navigation state management for mobile app
 *
 * Manages:
 * - Active tab state
 * - App section (Ice Level / Press Box / Front Office)
 * - Cross-tab navigation with filters (e.g., "Browse EDM players" from Gaps)
 */
export function useMobileNavigation(): UseMobileNavigationReturn {
  const [state, setState] = useState<MobileNavigationState>({
    activeTab: 'lineup',
    playerFilters: {
      position: null,
      team: null,
      search: '',
    },
  });

  const setActiveTab = useCallback((tab: MobileTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const setPlayerFilters = useCallback((filters: Partial<MobileNavigationState['playerFilters']>) => {
    setState(prev => ({
      ...prev,
      playerFilters: { ...prev.playerFilters, ...filters },
    }));
  }, []);

  const clearPlayerFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      playerFilters: { position: null, team: null, search: '' },
    }));
  }, []);

  // Navigate to Players tab with pre-set filters
  const navigateToPlayersWithFilter = useCallback((filter: { position?: string; team?: string }) => {
    setState(prev => ({
      ...prev,
      activeTab: 'players',
      playerFilters: {
        position: filter.position || null,
        team: filter.team || null,
        search: '',
      },
    }));
  }, []);

  const navigateToGaps = useCallback(() => {
    setState(prev => ({ ...prev, activeTab: 'gaps' }));
  }, []);

  const navigateToSettings = useCallback(() => {
    setState(prev => ({ ...prev, activeTab: 'settings' }));
  }, []);

  return {
    activeTab: state.activeTab,
    setActiveTab,
    playerFilters: state.playerFilters,
    setPlayerFilters,
    clearPlayerFilters,
    navigateToPlayersWithFilter,
    navigateToGaps,
    navigateToSettings,
  };
}
