import React, { useState } from 'react';
import type { HealthResponse } from '../lib/coachSchemas';
import { getFreshnessStatus, formatBytes, formatDateTime, getOverallFreshness } from '../lib/dataFreshness';

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
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-lg">⚠</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-red-400">Data Cache Not Loaded</div>
            <div className="text-xs text-red-400/70">The application may not function correctly</div>
          </div>
        </div>
      </div>
    );
  }

  const { dataCache } = health;
  const fileEntries = Object.entries(dataCache.files || {});

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg ${overallStatus.color}`}>{overallStatus.icon}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-white">Data Cache Status</div>
            <div className={`text-xs ${overallStatus.color}`}>{overallStatus.message}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataCache.generatedAt && (
            <div className="text-xs text-gray-400">
              Updated {formatDateTime(dataCache.generatedAt)}
            </div>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10">
          {/* Cache Version */}
          {dataCache.version && (
            <div className="pt-3 flex items-center justify-between text-xs">
              <span className="text-gray-400">Cache Version:</span>
              <span className="text-gray-300 font-mono">{dataCache.version}</span>
            </div>
          )}

          {/* File Details */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">
              Cache Files ({fileEntries.length})
            </div>
            <div className="space-y-1.5">
              {fileEntries.map(([key, file]) => {
                const status = getFreshnessStatus(file.mtime);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1.5 px-2 bg-white/5 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`${status.color} text-sm`}>{status.icon}</span>
                      <span className="text-xs font-medium text-white capitalize">{key}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {file.exists ? (
                        <>
                          <span className="text-gray-400">{formatBytes(file.bytes || 0)}</span>
                          <span className="text-gray-500">
                            {file.mtime ? formatDateTime(file.mtime) : 'Unknown'}
                          </span>
                        </>
                      ) : (
                        <span className="text-red-400">Missing</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source Path */}
          {dataCache.sourcePaths && dataCache.sourcePaths.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <div className="text-xs text-gray-400 mb-1">Source:</div>
              <div className="text-xs text-gray-500 font-mono break-all">
                {dataCache.sourcePaths[0]}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
