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
              ? 'bg-green-500/20 text-green-400 border border-green-500/40'
              : 'bg-red-500/20 text-red-400 border border-red-500/40'}
            hover:bg-opacity-30 transition-all cursor-help
          `}>
            <Icon className={sizeClasses[size]} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-900 border-slate-700 max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="font-semibold border-b border-slate-600 pb-1">
              {isIncreased ? '↗ Increased Role' : '↘ Decreased Role'}
            </div>

            <div className="space-y-1">
              <div className="font-medium text-slate-300">Average TOI:</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-400">Season:</span>
                <span className="text-white font-mono text-right">{formatToi(trend.season.avgToi)}</span>
                <span className="text-slate-400">Last 7d:</span>
                <span className={`font-mono text-right ${isIncreased ? 'text-green-400' : 'text-red-400'}`}>
                  {formatToi(trend.last7.avgToi)}
                </span>
                <span className="text-slate-400">Change:</span>
                <span className={`font-mono font-bold text-right ${isIncreased ? 'text-green-400' : 'text-red-400'}`}>
                  {trend.toiChange > 0 ? '+' : ''}{trend.toiChange.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="space-y-1 border-t border-slate-600 pt-2">
              <div className="font-medium text-slate-300">PP Time:</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-400">Season:</span>
                <div className="text-right">
                  <div className="text-white font-mono">{formatToi(trend.season.avgPpToi)}</div>
                  {trend.season.ppPct > 0 && (
                    <div className="text-xs text-slate-400">({trend.season.ppPct.toFixed(1)}% of team)</div>
                  )}
                </div>

                <span className="text-slate-400">Last 7d:</span>
                <div className="text-right">
                  <div className={`font-mono ${isIncreased ? 'text-green-400' : 'text-red-400'}`}>
                    {formatToi(trend.last7.avgPpToi)}
                  </div>
                  {trend.last7.ppPct > 0 && (
                    <div className={`text-xs ${isIncreased ? 'text-green-400' : 'text-red-400'}`}>
                      ({trend.last7.ppPct.toFixed(1)}% of team)
                    </div>
                  )}
                </div>

                <span className="text-slate-400">Change:</span>
                <div className="text-right">
                  <div className={`font-mono font-bold ${isIncreased ? 'text-green-400' : 'text-red-400'}`}>
                    {trend.ppToiChange > 0 ? '+' : ''}{trend.ppToiChange.toFixed(1)}% time
                  </div>
                  {trend.ppPctChange !== 0 && (
                    <div className={`text-xs font-bold ${isIncreased ? 'text-green-400' : 'text-red-400'}`}>
                      {trend.ppPctChange > 0 ? '+' : ''}{trend.ppPctChange.toFixed(1)}pp share
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-slate-400 text-xs pt-1 border-t border-slate-600">
              Based on {trend.last7Games} games in last 7 days
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
