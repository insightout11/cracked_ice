import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'desktop';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect device type based on viewport width
 *
 * Uses 768px as the breakpoint between mobile and desktop.
 * Returns 'mobile' for screens below 768px, 'desktop' otherwise.
 *
 * Listens to window resize events to update dynamically.
 */
export function useDeviceDetection(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    // Initial detection
    if (typeof window === 'undefined') return 'desktop';
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    console.log('[useDeviceDetection] Initial:', { width: window.innerWidth, isMobile });
    return isMobile ? 'mobile' : 'desktop';
  });

  useEffect(() => {
    // Handler to update device type on resize
    const handleResize = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const newType = isMobile ? 'mobile' : 'desktop';
      console.log('[useDeviceDetection] Resize:', { width: window.innerWidth, isMobile, newType });
      setDeviceType(newType);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Call handler immediately to ensure correct initial state
    handleResize();

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  console.log('[useDeviceDetection] Current deviceType:', deviceType);
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
