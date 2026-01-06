import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type WorkstationMode = 'ice-level' | 'press-box' | 'front-office';

interface WorkstationModeContextType {
  mode: WorkstationMode;
  setMode: (mode: WorkstationMode) => void;
  isPremium: boolean;
  setIsPremium: (isPremium: boolean) => void;
}

const WorkstationModeContext = createContext<WorkstationModeContextType | undefined>(undefined);

export function WorkstationModeProvider({ children }: { children: ReactNode }) {
  // Load mode from localStorage, default to ice-level
  const [mode, setModeState] = useState<WorkstationMode>(() => {
    const saved = localStorage.getItem('workstation-mode');
    return (saved as WorkstationMode) || 'ice-level';
  });

  // Load premium status from localStorage (mocked for now)
  const [isPremium, setIsPremiumState] = useState<boolean>(() => {
    const saved = localStorage.getItem('isPremium');
    return saved === 'true';
  });

  // Persist mode to localStorage
  useEffect(() => {
    localStorage.setItem('workstation-mode', mode);
  }, [mode]);

  // Persist premium status to localStorage
  useEffect(() => {
    localStorage.setItem('isPremium', isPremium.toString());
  }, [isPremium]);

  const setMode = (newMode: WorkstationMode) => {
    // Check if front-office requires premium
    if (newMode === 'front-office' && !isPremium) {
      // For now, allow access but could show upgrade modal
      console.log('Front Office is a premium feature');
    }
    setModeState(newMode);
  };

  const setIsPremium = (premium: boolean) => {
    setIsPremiumState(premium);
  };

  return (
    <WorkstationModeContext.Provider value={{ mode, setMode, isPremium, setIsPremium }}>
      {children}
    </WorkstationModeContext.Provider>
  );
}

export function useWorkstationMode() {
  const context = useContext(WorkstationModeContext);
  if (!context) {
    throw new Error('useWorkstationMode must be used within WorkstationModeProvider');
  }
  return context;
}
