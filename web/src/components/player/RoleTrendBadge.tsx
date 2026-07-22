import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { RoleTrend } from '../../lib/coachSchemas';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface RoleTrendBadgeProps {
  trend: RoleTrend;
  size?: 'sm' | 'md' | 'lg';
}

export const RoleTrendBadge: React.FC<RoleTrendBadgeProps> = ({ trend, size = 'md' }) => {
  if (!trend || !trend.meetsThreshold) return null;

  const isIncreased = trend.type === 'increased';
  const Icon = isIncreased ? TrendingUp : TrendingDown;

  const formatToi = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`
            inline-flex items-center justify-center rounded-full p-1.5
            ${isIncreased
              ? 'bg-positive-muted text-positive border border-positive'
              : 'bg-negative-muted text-negative border border-negative'}
            hover:bg-opacity-30 transition-all cursor-help
          `}>
            <Icon className={sizeClasses[size]} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-surface-2 border-line max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-semibold border-b border-line pb-1">
 {isIncreased ? ' Increased Role' : ' Decreased Role'}
            </div>

            <div className="space-y-1">
              <div className="font-medium text-ink-dim">Average TOI:</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-ink-dim">Season:</span>
                <span className="text-ink font-mono text-right">{formatToi(trend.season.avgToi)}</span>
                <span className="text-ink-dim">Last 7d:</span>
                <span className={`font-mono text-right ${isIncreased ? 'text-positive' : 'text-negative'}`}>
                  {formatToi(trend.last7.avgToi)}
                </span>
                <span className="text-ink-dim">Change:</span>
                <span className={`font-mono font-bold text-right ${isIncreased ? 'text-positive' : 'text-negative'}`}>
                  {trend.toiChange > 0 ? '+' : ''}{trend.toiChange.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="space-y-1 border-t border-line pt-2">
              <div className="font-medium text-ink-dim">PP Time:</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-ink-dim">Season:</span>
                <div className="text-right">
                  <div className="text-ink font-mono">{formatToi(trend.season.avgPpToi)}</div>
                  {trend.season.ppPct > 0 && (
                    <div className="text-xs text-ink-dim">({trend.season.ppPct.toFixed(1)}% of team)</div>
                  )}
                </div>

                <span className="text-ink-dim">Last 7d:</span>
                <div className="text-right">
                  <div className={`font-mono ${isIncreased ? 'text-positive' : 'text-negative'}`}>
                    {formatToi(trend.last7.avgPpToi)}
                  </div>
                  {trend.last7.ppPct > 0 && (
                    <div className={`text-xs ${isIncreased ? 'text-positive' : 'text-negative'}`}>
                      ({trend.last7.ppPct.toFixed(1)}% of team)
                    </div>
                  )}
                </div>

                <span className="text-ink-dim">Change:</span>
                <div className="text-right">
                  <div className={`font-mono font-bold ${isIncreased ? 'text-positive' : 'text-negative'}`}>
                    {trend.ppToiChange > 0 ? '+' : ''}{trend.ppToiChange.toFixed(1)}% time
                  </div>
                  {trend.ppPctChange !== 0 && (
                    <div className={`text-xs font-bold ${isIncreased ? 'text-positive' : 'text-negative'}`}>
                      {trend.ppPctChange > 0 ? '+' : ''}{trend.ppPctChange.toFixed(1)}pp share
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-ink-dim text-xs pt-1 border-t border-line">
              Based on {trend.last7Games} games in last 7 days
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
