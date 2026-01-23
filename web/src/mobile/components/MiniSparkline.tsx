/**
 * MiniSparkline - A small inline sparkline chart
 *
 * Shows trend direction with a simple SVG line chart.
 * ~60px wide, 20px tall by default.
 */
interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
}

export function MiniSparkline({
  data,
  width = 60,
  height = 20,
  color = '#22d3ee', // cyan-400
  showDots = false,
}: MiniSparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className="bg-slate-700/30 rounded"
        style={{ width, height }}
      />
    );
  }

  // Calculate min/max for scaling
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  // Add padding so line doesn't touch edges
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Generate points
  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - minVal) / range) * chartHeight;
    return { x, y };
  });

  // Create SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Optional dots at start and end */}
      {showDots && (
        <>
          <circle
            cx={points[0].x}
            cy={points[0].y}
            r={2}
            fill={color}
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={2}
            fill={color}
          />
        </>
      )}
    </svg>
  );
}
