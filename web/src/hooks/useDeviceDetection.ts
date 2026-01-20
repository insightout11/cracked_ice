import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'desktop';

// Breakpoint at 1024px to include tablets in mobile experience
const MOBILE_BREAKPOINT = 1024;

/**
 * Hook to detect device type based on viewport width
 *
 * Uses 1024px as the breakpoint between mobile and desktop.
 * Returns 'mobile' for screens below 1024px (phones + tablets), 'desktop' otherwise.
 *
 * Listens to window resize events to update dynamically.
 */
export function useDeviceDetection(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const newType = window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
      setDeviceType(prev => prev !== newType ? newType : prev);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
}

/**
 * Hook that returns true if device is mobile
 */
export function useIsMobile(): boolean {
  return useDeviceDetection() === 'mobile';
}

/**
 * Hook that returns true if device is desktop
 */
export function useIsDesktop(): boolean {
  return useDeviceDetection() === 'desktop';
}
