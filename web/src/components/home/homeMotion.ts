import { useEffect, useState } from 'react';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Animation frames don't run in background tabs; there, show the real number rather than 0.
function still(): boolean {
  return prefersReducedMotion() || (typeof document !== 'undefined' && document.visibilityState !== 'visible');
}

/**
 * Counts up to `target` once when it first appears (or changes), easing out.
 * Returns the final value immediately when motion is reduced or the page is hidden.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (still() ? target : 0));
  useEffect(() => {
    if (still()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, target]);
  return value;
}

/** The current time, ticking every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function headshotUrl(season: string, team: string, playerId: string): string {
  return `https://assets.nhle.com/mugs/nhl/${season}/${team}/${playerId.replace(/^nhl:/, '')}.png`;
}
