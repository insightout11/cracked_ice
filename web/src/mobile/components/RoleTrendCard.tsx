import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { RoleTrend } from '../../lib/coachSchemas';

interface RoleTrendCardProps {
  roleTrend: RoleTrend;
}

/**
 * Format time on ice from seconds to MM:SS
 */
function formatToi(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds === 0) {
    return '-';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * RoleTrendCard - Ice time changes visualization
 *
 * Shows horizontal bars comparing season vs L7 for TOI and PP TOI
 * with clear indicators of role changes.
 */
export function RoleTrendCard({ roleTrend }: RoleTrendCardProps) {
  if (!roleTrend || roleTrend.last7Games < 3) return null;

  // Calculate percentage change from actual values (not pre-calculated field)
  const seasonToi = roleTrend.season.avgToi;
  const l7Toi = roleTrend.last7.avgToi;
  const toiChangePercent = seasonToi > 0 ? Math.round(((l7Toi - seasonToi) / seasonToi) * 100) : 0;

  const seasonPpToi = roleTrend.season.avgPpToi;
  const l7PpToi = roleTrend.last7.avgPpToi;
  const ppToiChangePercent = seasonPpToi > 0 ? Math.round(((l7PpToi - seasonPpToi) / seasonPpToi) * 100) : 0;

  const isToiUp = toiChangePercent > 5;
  const isToiDown = toiChangePercent < -5;
  const isPpUp = ppToiChangePercent > 5;
  const isPpDown = ppToiChangePercent < -5;

  // Overall role trend
  const overallTrend = isToiUp || isPpUp ? 'increased' : isToiDown || isPpDown ? 'decreased' : 'stable';

  return (
    <div className="bg-slate-800/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Role Trend</h3>
        <div className="flex items-center gap-1.5">
          {overallTrend === 'increased' && (
            <>
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">Increased</span>
            </>
          )}
          {overallTrend === 'decreased' && (
            <>
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-red-400">Decreased</span>
            </>
          )}
          {overallTrend === 'stable' && (
            <>
              <Minus className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-400">Stable</span>
            </>
          )}
        </div>
      </div>

      {/* TOI Bar */}
      <div className="space-y-4">
        <RoleBar
          label="TOI"
          seasonValue={roleTrend.season.avgToi}
          l7Value={roleTrend.last7.avgToi}
          changePercent={toiChangePercent}
          formatValue={formatToi}
        />

        {/* PP TOI Bar - only show if player has PP time */}
        {(roleTrend.season.avgPpToi > 0 || roleTrend.last7.avgPpToi > 0) && (
          <RoleBar
            label="PP TOI"
            seasonValue={roleTrend.season.avgPpToi}
            l7Value={roleTrend.last7.avgPpToi}
            changePercent={ppToiChangePercent}
            formatValue={formatToi}
          />
        )}
      </div>

      <p className="text-[10px] text-slate-500 mt-3">
        Based on last {roleTrend.last7Games} games
      </p>
    </div>
  );
}

interface RoleBarProps {
  label: string;
  seasonValue: number;
  l7Value: number;
  changePercent: number;
  formatValue: (val: number) => string;
}

function RoleBar({ label, seasonValue, l7Value, changePercent, formatValue }: RoleBarProps) {
  const isUp = changePercent > 5;
  const isDown = changePercent < -5;

  // Calculate bar widths relative to the max
  const maxVal = Math.max(seasonValue, l7Value, 1);
  const seasonWidth = (seasonValue / maxVal) * 100;
  const l7Width = (l7Value / maxVal) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Season: <span className="text-slate-300">{formatValue(seasonValue)}</span></span>
          <span className="text-slate-500">→</span>
          <span className={isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}>
            L7: <span className="font-medium">{formatValue(l7Value)}</span>
          </span>
        </div>
      </div>

      {/* Comparison bars */}
      <div className="relative h-5 bg-slate-900/50 rounded-lg overflow-hidden">
        {/* Season bar (background) */}
        <div
          className="absolute top-0 left-0 h-full bg-slate-600/50 rounded-lg transition-all"
          style={{ width: `${seasonWidth}%` }}
        />
        {/* L7 bar (foreground) */}
        <div
          className={`absolute top-0 left-0 h-full rounded-lg transition-all ${
            isUp ? 'bg-green-500/70' : isDown ? 'bg-red-500/70' : 'bg-cyan-500/70'
          }`}
          style={{ width: `${l7Width}%` }}
        />
        {/* Change indicator */}
        {Math.abs(changePercent) > 1 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className={`text-xs font-bold ${
              isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-slate-400'
            }`}>
              {changePercent > 0 ? '+' : ''}{changePercent}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
