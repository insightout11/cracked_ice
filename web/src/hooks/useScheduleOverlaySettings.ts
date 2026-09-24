import { useState, useEffect } from 'react';

export interface ScheduleOverlaySettings {
  showOffNightIndicators: boolean;
  highlightUserTeams: boolean;
  showPlayerCounts: boolean;
  filterUserTeamsOnly: boolean;
  showConflictOverlay: boolean;
  showStreamingValue: boolean;
}

const STORAGE_KEY = 'schedule-overlay-settings';

const DEFAULT_SETTINGS: ScheduleOverlaySettings = {
  showOffNightIndicators: true,
  // Personal overlays are on by default; they only show anything once a roster is added.
  highlightUserTeams: true,
  showPlayerCounts: true,
  filterUserTeamsOnly: false,
  showConflictOverlay: true,
  showStreamingValue: true,
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
