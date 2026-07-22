import { useState, useMemo } from 'react';

interface CareerSeasonStats {
  gamesPlayed?: number;
  goals?: number;
  assists?: number;
  points?: number;
  fppg?: number;
  team?: string;
  // Goalie stats
  wins?: number;
  losses?: number;
  goalsAgainstAverage?: number;
  savePct?: number;
  shutouts?: number;
}

interface MobileCareerChartProps {
  careerHistory: Record<string, CareerSeasonStats>;
  currentSeason?: string;
  metric?: 'ppg' | 'points' | 'goals';
}

/**
 * Format season string from "20252026" to "'25-26"
 */
function formatSeasonShort(season: string): string {
  if (season.length === 8) {
    return `'${season.slice(2, 4)}`;
  }
  return season;
}

/**
 * MobileCareerChart - SVG-based line chart for career PPG trend
 *
 * Shows PPG over all career seasons with:
 * - Dashed career average reference line
 * - Touch-responsive tooltips
 * - Current season highlighted in cyan
 */
export function MobileCareerChart({
  careerHistory,
  currentSeason = '20252026',
  metric = 'ppg',
}: MobileCareerChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Process career data
  const chartData = useMemo(() => {
    const entries = Object.entries(careerHistory)
      .filter(([_, stats]) => (stats.gamesPlayed ?? 0) > 10) // Only seasons with meaningful games
      .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length < 2) return null;

    const data = entries.map(([season, stats]) => {
      const gp = stats.gamesPlayed ?? 0;
      let value: number;
      if (metric === 'ppg') {
        value = gp > 0 ? (stats.points ?? 0) / gp : 0;
      } else if (metric === 'points') {
        value = stats.points ?? 0;
      } else {
        value = stats.goals ?? 0;
      }

      return {
        season,
        value,
        gamesPlayed: gp,
        points: stats.points ?? 0,
        goals: stats.goals ?? 0,
        assists: stats.assists ?? 0,
        team: stats.team,
        isCurrent: season === currentSeason,
      };
    });

    // Calculate average
    const avg = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    return { data, avg };
  }, [careerHistory, currentSeason, metric]);

  if (!chartData || chartData.data.length < 2) {
    return (
      <div className="bg-surface-2 rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-2">Career Points Per Game</h3>
        <p className="text-xs text-ink-dim">Not enough career data available</p>
      </div>
    );
  }

  const { data, avg } = chartData;

  // SVG dimensions
  const width = 320;
  const height = 140;
  const padding = { top: 20, right: 20, bottom: 30, left: 20 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values, avg) * 0.9;
  const maxVal = Math.max(...values, avg) * 1.1;
  const range = maxVal - minVal || 1;

  // Generate points
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight,
    ...d,
  }));

  // Create SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Average line Y position
  const avgY = padding.top + chartHeight - ((avg - minVal) / range) * chartHeight;

  // Handle touch
  const handleTouch = (index: number) => {
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  const selectedPoint = selectedIndex !== null ? points[selectedIndex] : null;

  const metricLabel = metric === 'ppg' ? 'Points Per Game' : metric === 'points' ? 'Total Points' : 'Goals';

  return (
    <div className="bg-surface-2 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-ink">Career {metricLabel}</h3>
        <span className="text-xs text-ink-dim">
          Avg: <span className="text-accent font-medium">{avg.toFixed(2)}</span> • {data.length} seasons
        </span>
      </div>
      {/* Tooltip */}
      {selectedPoint && (
        <div className="bg-surface-2 border border-line rounded-lg px-3 py-2 mb-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-ink-dim">
              {formatSeasonShort(selectedPoint.season)}{selectedPoint.team ? ` (${selectedPoint.team})` : ''}
            </span>
            <span className="text-sm font-bold text-accent">
              {selectedPoint.value.toFixed(2)} {metric === 'ppg' ? 'PPG' : metric === 'points' ? 'P' : 'G'}
            </span>
          </div>
          <div className="text-[10px] text-ink-dim mt-1">
            {selectedPoint.gamesPlayed} GP • {selectedPoint.goals}G {selectedPoint.assists}A
          </div>
        </div>
      )}
      {/* Chart */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="touch-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Average reference line (dashed) */}
        <line
          x1={padding.left}
          y1={avgY}
          x2={width - padding.right}
          y2={avgY}
          stroke="var(--ink-mute)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={width - padding.right + 4}
          y={avgY + 3}
          className="text-[10px] fill-slate-500"
        >
          Avg
        </text>

        {/* Line path */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={p.season}>
            {/* Invisible larger touch target */}
            <circle
              cx={p.x}
              cy={p.y}
              r={20}
              fill="transparent"
              onClick={() => handleTouch(i)}
              className='cursor-pointer'
            />
            {/* Visible dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={selectedIndex === i ? 6 : p.isCurrent ? 5 : 4}
              fill={selectedIndex === i ? 'var(--ink)' : p.isCurrent ? 'var(--accent)' : 'var(--ink-mute)'}
              stroke={selectedIndex === i ? 'var(--accent)' : 'none'}
              strokeWidth={2}
            />
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => {
          // Only show every nth label to avoid crowding
          const showLabel = data.length <= 6 || i === 0 || i === data.length - 1 || i % 2 === 0;
          if (!showLabel) return null;
          return (
            <text
              key={`label-${p.season}`}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              className={`text-[10px] ${p.isCurrent ? 'fill-cyan-400 font-medium' : 'fill-slate-500'}`}
            >
              {formatSeasonShort(p.season)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
