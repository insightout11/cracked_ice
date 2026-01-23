import { Flame, Snowflake } from 'lucide-react';

interface StreakBannerProps {
  seasonFppg: number;
  last7Fppg: number;
  threshold?: number; // % variance threshold to show banner (default 10%)
}

/**
 * StreakBanner - Prominent hot/cold status banner
 *
 * Shows when a player is significantly outperforming or underperforming
 * their season average. Orange gradient for hot, blue for cold.
 */
export function StreakBanner({
  seasonFppg,
  last7Fppg,
  threshold = 10,
}: StreakBannerProps) {
  // Don't show if no season data
  if (seasonFppg <= 0 || last7Fppg <= 0) return null;

  const changePercent = Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100);
  const absChange = Math.abs(changePercent);

  // Don't show if within threshold
  if (absChange < threshold) return null;

  const isHot = changePercent > 0;

  return (
    <div
      className={`rounded-xl p-4 ${
        isHot
          ? 'bg-gradient-to-r from-orange-600/30 to-red-600/20 border border-orange-500/30'
          : 'bg-gradient-to-r from-blue-600/30 to-cyan-600/20 border border-blue-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isHot ? (
            <Flame className="w-5 h-5 text-orange-400" />
          ) : (
            <Snowflake className="w-5 h-5 text-blue-400" />
          )}
          <span className={`text-sm font-bold uppercase tracking-wide ${
            isHot ? 'text-orange-400' : 'text-blue-400'
          }`}>
            {isHot ? 'Hot Streak' : 'Cold Streak'}
          </span>
        </div>
        <span className={`text-lg font-bold ${
          isHot ? 'text-orange-400' : 'text-blue-400'
        }`}>
          {changePercent > 0 ? '+' : ''}{changePercent}%
        </span>
      </div>

      <p className="text-sm text-slate-300">
        {isHot ? 'Outperforming' : 'Underperforming'} season avg by {absChange}%
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Last 7 days: <span className="text-white font-medium">{last7Fppg.toFixed(1)}</span> FPPG vs{' '}
        <span className="text-white font-medium">{seasonFppg.toFixed(1)}</span> season
      </p>
    </div>
  );
}
