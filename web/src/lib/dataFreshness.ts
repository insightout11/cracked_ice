import type { HealthResponse } from './coachSchemas';

export interface FreshnessStatus {
  level: 'fresh' | 'recent' | 'stale' | 'critical';
  message: string;
  color: string;
  icon: string;
}

export function calculateAge(mtime: string | null | undefined): number | null {
  if (!mtime) return null;
  const mtimeDate = new Date(mtime);
  const now = new Date();
  return now.getTime() - mtimeDate.getTime();
}

export function getFreshnessStatus(mtime: string | null | undefined): FreshnessStatus {
  const ageMs = calculateAge(mtime);

  if (ageMs === null) {
    return {
      level: 'critical',
      message: 'No data',
      color: 'text-red-400',
      icon: '✗'
    };
  }

  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 6) {
    return {
      level: 'fresh',
      message: 'Up to date',
      color: 'text-green-400',
      icon: '✓'
    };
  } else if (ageHours < 24) {
    return {
      level: 'recent',
      message: 'Recent',
      color: 'text-cyan-400',
      icon: '●'
    };
  } else if (ageHours < 72) {
    return {
      level: 'stale',
      message: 'May be outdated',
      color: 'text-yellow-400',
      icon: '⚠'
    };
  } else {
    return {
      level: 'critical',
      message: 'Outdated',
      color: 'text-red-400',
      icon: '⚠'
    };
  }
}

export function formatAge(mtime: string | null | undefined): string {
  const ageMs = calculateAge(mtime);

  if (ageMs === null) {
    return 'Unknown';
  }

  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  } else if (ageHours < 24) {
    return `${ageHours}h ago`;
  } else {
    return `${ageDays}d ago`;
  }
}

export function getOverallFreshness(health: HealthResponse | null): FreshnessStatus {
  if (!health) {
    return {
      level: 'critical',
      message: 'No health data',
      color: 'text-red-400',
      icon: '✗'
    };
  }

  // Support both new backend structure (schedules/stats/players at top level)
  // and old structure (dataCache.files)
  const schedulesMtime = (health as any).schedules?.lastRefreshed ?? health.dataCache?.files?.schedule?.mtime;
  const statsMtime = (health as any).stats?.generatedAt ?? health.dataCache?.files?.stats?.mtime;
  const playersMtime = (health as any).players?.generatedAt ?? health.dataCache?.files?.players?.mtime;

  // Check critical files: players, schedule, stats
  const criticalFiles = [
    playersMtime,
    schedulesMtime,
    statsMtime
  ];

  // Get worst freshness level from critical files
  let worstLevel: 'fresh' | 'recent' | 'stale' | 'critical' = 'fresh';

  for (const mtime of criticalFiles) {
    const status = getFreshnessStatus(mtime);
    if (status.level === 'critical') {
      worstLevel = 'critical';
      break;
    } else if (status.level === 'stale' && worstLevel !== 'critical') {
      worstLevel = 'stale';
    } else if (status.level === 'recent' && worstLevel === 'fresh') {
      worstLevel = 'recent';
    }
  }

  switch (worstLevel) {
    case 'fresh':
      return {
        level: 'fresh',
        message: 'All data up to date',
        color: 'text-green-400',
        icon: '✓'
      };
    case 'recent':
      return {
        level: 'recent',
        message: 'Data is recent',
        color: 'text-cyan-400',
        icon: '●'
      };
    case 'stale':
      return {
        level: 'stale',
        message: 'Some data may be outdated',
        color: 'text-yellow-400',
        icon: '⚠'
      };
    case 'critical':
      return {
        level: 'critical',
        message: 'Data is outdated',
        color: 'text-red-400',
        icon: '⚠'
      };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown';

  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
