import React, { useState } from 'react';
import type { HealthResponse } from '../lib/coachSchemas';
import { getFreshnessStatus, formatBytes, formatDateTime, getOverallFreshness } from '../lib/dataFreshness';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface CacheStatusPanelProps {
  health: HealthResponse | null;
}

export const CacheStatusPanel: React.FC<CacheStatusPanelProps> = ({ health }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!health) {
    return null;
  }

  const overallStatus = getOverallFreshness(health);

  if (!health.dataCache?.loaded) {
    return (
      <div className="bg-negative-muted border border-negative rounded-lg p-3">
        <div className="flex items-center gap-2">
 <AlertCircle className="text-negative" size={18} />
          <div className="flex-1">
            <div className="text-sm font-medium text-negative">Data Cache Not Loaded</div>
            <div className="text-xs text-negative">The application may not function correctly</div>
          </div>
        </div>
      </div>
    );
  }

  const { dataCache } = health;
  const fileEntries = Object.entries(dataCache.files || {});

  return (
    <div className="bg-surface-1/5 border border-line rounded-lg overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-1/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg ${overallStatus.color}`}>{overallStatus.icon}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-ink">Data Cache Status</div>
            <div className={`text-xs ${overallStatus.color}`}>{overallStatus.message}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataCache.generatedAt && (
            <div className="text-xs text-ink-dim">
              Updated {formatDateTime(dataCache.generatedAt)}
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-ink-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-line">
          {/* Cache Version */}
          {dataCache.version && (
            <div className="pt-3 flex items-center justify-between text-xs">
              <span className="text-ink-dim">Cache Version:</span>
              <span className="text-ink-dim font-mono">{dataCache.version}</span>
            </div>
          )}

          {/* File Details */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-accent uppercase tracking-wide">
              Cache Files ({fileEntries.length})
            </div>
            <div className="space-y-1.5">
              {fileEntries.map(([key, file]) => {
                const status = getFreshnessStatus(file.mtime);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1.5 px-2 bg-surface-1/5 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`${status.color} text-sm`}>{status.icon}</span>
                      <span className="text-xs font-medium text-ink capitalize">{key}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {file.exists ? (
                        <>
                          <span className="text-ink-dim">{formatBytes(file.bytes || 0)}</span>
                          <span className="text-ink-mute">
                            {file.mtime ? formatDateTime(file.mtime) : 'Unknown'}
                          </span>
                        </>
                      ) : (
                        <span className="text-negative">Missing</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source Path */}
          {dataCache.sourcePaths && dataCache.sourcePaths.length > 0 && (
            <div className="pt-2 border-t border-line">
              <div className="text-xs text-ink-dim mb-1">Source:</div>
              <div className="text-xs text-ink-mute font-mono break-all">
                {dataCache.sourcePaths[0]}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
