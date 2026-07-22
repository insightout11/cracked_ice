import React, { useState } from 'react';
import type { HealthResponse } from '../lib/coachSchemas';
import { getOverallFreshness } from '../lib/dataFreshness';
import { X } from 'lucide-react';

interface StaleDataBannerProps {
  health: HealthResponse | null;
}

export const StaleDataBanner: React.FC<StaleDataBannerProps> = ({ health }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!health || isDismissed) {
    return null;
  }

  const status = getOverallFreshness(health);

  // Only show banner for stale or critical data
  if (status.level === 'fresh' || status.level === 'recent') {
    return null;
  }

  const bgColor = status.level === 'critical'
    ? 'bg-negative-muted border-negative'
    : 'bg-warning-muted border-warning';

  const textColor = status.level === 'critical'
    ? 'text-negative'
    : 'text-warning';

  const iconColor = status.level === 'critical'
    ? 'text-negative'
    : 'text-warning';

  return (
    <div className={`${bgColor} border rounded-lg p-4 mb-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`${iconColor} text-xl mt-0.5`}>{status.icon}</span>
          <div>
            <div className={`text-sm font-semibold ${textColor}`}>
              {status.level === 'critical' ? 'Data Outdated' : 'Data May Be Outdated'}
            </div>
            <div className="text-sm text-ink-dim mt-1">
              {status.level === 'critical' ? (
                <>
                  The player and schedule data is more than 3 days old.
                  Projections and recommendations may be inaccurate.
                </>
              ) : (
                <>
                  Some data is more than 24 hours old.
                  Recent games and roster changes may not be reflected.
                </>
              )}
            </div>
            {health.dataCache?.generatedAt && (
              <div className="text-xs text-ink-dim mt-1">
                Last updated: {new Date(health.dataCache.generatedAt).toLocaleString()}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-medium text-accent hover:text-accent transition-colors"
            >
              Refresh Page →
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-ink-dim hover:text-ink transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
