export const OFF_NIGHT_WEEKDAYS = new Set<number>([0, 1, 3, 5]); // Sun, Mon, Wed, Fri
export const MAX_FREE_AGENT_CANDIDATES = Number.POSITIVE_INFINITY;
export const MAX_DROP_CANDIDATES = 12;
export const REQUEST_TIMEOUT_MS = 1000;

export const FEATURE_FLAGS = {
  recentFormBoost: process.env.FEATURE_RECENT_FORM === 'true',
  enableBadgeDebug: process.env.FEATURE_BADGE_DEBUG === 'true'
} as const;

export const REQUIRED_ENV = {
  NEXT_PUBLIC_ENV: 'staging',
  DISABLE_PROD: 'true'
} as const;

export type FeatureFlags = typeof FEATURE_FLAGS;
