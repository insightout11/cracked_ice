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
          ? 'bg-gradient-to-r from-warning to-negative border border-warning'
          : 'bg-gradient-to-r from-accent to-accent border border-accent'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isHot ? (
            <Flame className="w-5 h-5 text-warning" />
          ) : (
            <Snowflake className="w-5 h-5 text-accent" />
          )}
          <span className={`text-sm font-bold uppercase tracking-wide ${
            isHot ? 'text-warning' : 'text-accent'
          }`}>
            {isHot ? 'Hot Streak' : 'Cold Streak'}
          </span>
        </div>
        <span className={`text-lg font-bold ${
          isHot ? 'text-warning' : 'text-accent'
        }`}>
          {changePercent > 0 ? '+' : ''}{changePercent}%
        </span>
      </div>

      <p className="text-sm text-ink-dim">
        {isHot ? 'Outperforming' : 'Underperforming'} season avg by {absChange}%
      </p>
      <p className="text-xs text-ink-dim mt-1">
        Last 7 days: <span className="text-ink font-medium">{last7Fppg.toFixed(1)}</span> FPPG vs{' '}
        <span className="text-ink font-medium">{seasonFppg.toFixed(1)}</span> season
      </p>
    </div>
  );
}
