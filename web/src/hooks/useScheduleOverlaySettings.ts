import { useState, useEffect } from 'react';

export interface ScheduleOverlaySettings {
  showOffNightIndicators: boolean;
  highlightUserTeams: boolean;
  showPlayerCounts: boolean;
  filterUserTeamsOnly: boolean;
}

const STORAGE_KEY = 'schedule-overlay-settings';

const DEFAULT_SETTINGS: ScheduleOverlaySettings = {
  showOffNightIndicators: true,
  highlightUserTeams: false,
  showPlayerCounts: false,
  filterUserTeamsOnly: false,
};

export function useScheduleOverlaySettings() {
  const [settings, setSettings] = useState<ScheduleOverlaySettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: Partial<ScheduleOverlaySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return { settings, updateSettings };
}
