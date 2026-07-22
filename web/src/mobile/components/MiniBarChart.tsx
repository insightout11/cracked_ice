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
          <span className="text-xs text-ink-dim">{label}</span>
        )}
        <div className="flex items-center gap-1.5">
          {showPercent && Math.abs(change) > 1 && (
            <span
              className={`text-xs font-medium ${
                isIncrease
                  ? 'text-positive'
                  : isDecrease
                  ? 'text-negative'
                  : 'text-ink-dim'
              }`}
            >
              {change > 0 ? '+' : ''}{change.toFixed(0)}%
            </span>
          )}
          {isIncrease && <TrendingUp className="w-3.5 h-3.5 text-positive" />}
          {isDecrease && <TrendingDown className="w-3.5 h-3.5 text-negative" />}
          {!isIncrease && !isDecrease && <Minus className="w-3.5 h-3.5 text-ink-dim" />}
        </div>
      </div>

      {/* Stacked bars */}
      <div className="space-y-1">
        {/* Baseline (season) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-dim w-10">Season</span>
          <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-surface-2 rounded-full transition-all"
              style={{ width: `${baselineWidth}%` }}
            />
          </div>
          <span className="text-xs text-ink-dim w-12 text-right">
            {format(baseline)}
          </span>
        </div>

        {/* Current (L7) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-dim w-10">L7</span>
          <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isIncrease
                  ? 'bg-positive'
                  : isDecrease
                  ? 'bg-negative'
                  : 'bg-accent'
              }`}
              style={{ width: `${currentWidth}%` }}
            />
          </div>
          <span
            className={`text-xs font-medium w-12 text-right ${
              isIncrease
                ? 'text-positive'
                : isDecrease
                ? 'text-negative'
                : 'text-ink'
            }`}
          >
            {format(current)}
          </span>
        </div>
      </div>
    </div>
  );
}
