import { useMemo } from 'react';
import { MiniSparkline } from './MiniSparkline';
import type { GameLogEntry } from '../../lib/coachSchemas';

interface FppgTrendCardProps {
  seasonFppg: number;
  last30Fppg: number;
  last7Fppg: number;
  gameLog?: GameLogEntry[];
}

/**
 * FppgTrendCard - Desktop-style FPPG display with sparkline header
 *
 * Shows three large values (Season, L30, L7) with % change indicators
 * and a subtle sparkline in the header for trend visualization.
 */
export function FppgTrendCard({
  seasonFppg,
  last30Fppg,
  last7Fppg,
  gameLog,
}: FppgTrendCardProps) {
  // Calculate % changes from season baseline
  const l30Change = seasonFppg > 0 ? Math.round(((last30Fppg - seasonFppg) / seasonFppg) * 100) : 0;
  const l7Change = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;

  // Build trend data for sparkline from game log
  const trendData = useMemo(() => {
    if (gameLog && gameLog.length >= 3) {
      // Calculate approximate FPPG from game log (last 10 games)
      const recentGames = gameLog.slice(0, 10);
      return recentGames.map((g) => {
        const goals = g.goals || 0;
        const assists = g.assists || 0;
        const shots = g.shots || 0;
        const blocks = g.blocks || 0;
        const hits = g.hits || 0;
        return goals * 3 + assists * 2 + shots * 0.5 + blocks * 0.5 + hits * 0.5;
      }).reverse();
    }
    // Fallback to the three data points
    return [seasonFppg, last30Fppg, last7Fppg];
  }, [gameLog, seasonFppg, last30Fppg, last7Fppg]);

  return (
    <div className="bg-surface-2 rounded-xl p-4">
      {/* Header with sparkline */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ink">FPPG Trend</h3>
        <MiniSparkline
          data={trendData}
          width={80}
          height={24}
          showDots
        />
      </div>

      {/* Three large values */}
      <div className="grid grid-cols-3 gap-3">
        {/* Season */}
        <div className="text-center">
          <div className="text-2xl font-bold text-ink">
            {seasonFppg > 0 ? seasonFppg.toFixed(2) : '-'}
          </div>
          <div className="text-[10px] text-ink-dim uppercase tracking-wide mt-1">
            Season
          </div>
        </div>

        {/* L30 */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            last30Fppg > seasonFppg ? 'text-positive' :
            last30Fppg < seasonFppg * 0.9 ? 'text-negative' : 'text-ink'
          }`}>
            {last30Fppg > 0 ? last30Fppg.toFixed(2) : '-'}
          </div>
          <div className="text-[10px] text-ink-dim uppercase tracking-wide mt-1">
            L30
          </div>
          {l30Change !== 0 && (
            <div className={`text-xs font-medium mt-0.5 ${
              l30Change > 0 ? 'text-positive' : 'text-negative'
            }`}>
              {l30Change > 0 ? '↑' : '↓'} {l30Change > 0 ? '+' : ''}{l30Change}%
            </div>
          )}
        </div>

        {/* L7 */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            last7Fppg > seasonFppg ? 'text-positive' :
            last7Fppg < seasonFppg * 0.9 ? 'text-negative' : 'text-ink'
          }`}>
            {last7Fppg > 0 ? last7Fppg.toFixed(2) : '-'}
          </div>
          <div className="text-[10px] text-ink-dim uppercase tracking-wide mt-1">
            L7
          </div>
          {l7Change !== 0 && (
            <div className={`text-xs font-medium mt-0.5 ${
              l7Change > 0 ? 'text-positive' : 'text-negative'
            }`}>
              {l7Change > 0 ? '↑' : '↓'} {l7Change > 0 ? '+' : ''}{l7Change}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
