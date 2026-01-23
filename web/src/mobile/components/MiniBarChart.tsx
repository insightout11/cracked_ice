import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * MiniBarChart - Horizontal progress bar showing comparison
 *
 * Shows baseline vs current value with color-coded increase/decrease.
 */
interface MiniBarChartProps {
  baseline: number;
  current: number;
  label?: string;
  showPercent?: boolean;
  formatValue?: (val: number) => string;
}

export function MiniBarChart({
  baseline,
  current,
  label,
  showPercent = true,
  formatValue,
}: MiniBarChartProps) {
  // Calculate percentage change
  const change = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
  const isIncrease = change > 2;
  const isDecrease = change < -2;

  // Calculate bar widths relative to max of both values
  const maxVal = Math.max(baseline, current, 0.01);
  const baselineWidth = (baseline / maxVal) * 100;
  const currentWidth = (current / maxVal) * 100;

  // Format display value
  const format = formatValue || ((v: number) => v.toFixed(1));

  return (
    <div className="space-y-1.5">
      {/* Label row with trend indicator */}
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-xs text-slate-400">{label}</span>
        )}
        <div className="flex items-center gap-1.5">
          {showPercent && Math.abs(change) > 1 && (
            <span
              className={`text-xs font-medium ${
                isIncrease
                  ? 'text-green-400'
                  : isDecrease
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {change > 0 ? '+' : ''}{change.toFixed(0)}%
            </span>
          )}
          {isIncrease && <TrendingUp className="w-3.5 h-3.5 text-green-400" />}
          {isDecrease && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          {!isIncrease && !isDecrease && <Minus className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>

      {/* Stacked bars */}
      <div className="space-y-1">
        {/* Baseline (season) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-10">Season</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-600 rounded-full transition-all"
              style={{ width: `${baselineWidth}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 w-12 text-right">
            {format(baseline)}
          </span>
        </div>

        {/* Current (L7) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-10">L7</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isIncrease
                  ? 'bg-green-500'
                  : isDecrease
                  ? 'bg-red-500'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${currentWidth}%` }}
            />
          </div>
          <span
            className={`text-xs font-medium w-12 text-right ${
              isIncrease
                ? 'text-green-400'
                : isDecrease
                ? 'text-red-400'
                : 'text-white'
            }`}
          >
            {format(current)}
          </span>
        </div>
      </div>
    </div>
  );
}
