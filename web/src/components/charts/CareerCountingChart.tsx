import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface CareerCountingSeason {
  gamesPlayed: number;
  shots: number;
  hits: number;
  blocks: number;
}

/**
 * Categorical slots 1-3 (blue, orange, aqua) stepped for dark surfaces; validated
 * with the dataviz palette checker against --surface-0 and --surface-1 (all checks
 * pass). Identity also carries by legend, end-of-line labels and the table view.
 */
const SERIES = [
  { key: 'shots', label: 'Shots on goal', color: '#3987e5' },
  { key: 'hits', label: 'Hits', color: '#d95926' },
  { key: 'blocks', label: 'Blocks', color: '#199e70' },
] as const;

type SeriesKey = typeof SERIES[number]['key'];
type Row = { season: string; seasonLabel: string; gamesPlayed: number } & Record<SeriesKey, number>;

const perGame = (total: number, games: number) => Math.round((total / games) * 100) / 100;
const seasonLabel = (season: string) => (season.length === 8 ? `${season.slice(2, 4)}-${season.slice(6, 8)}` : season);

export function careerCountingRows(careerCounting: Record<string, Partial<CareerCountingSeason>>): Row[] {
  return Object.entries(careerCounting)
    .filter(([, season]) => (season.gamesPlayed ?? 0) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([season, stats]) => {
      const gamesPlayed = stats.gamesPlayed ?? 0;
      return {
        season,
        seasonLabel: seasonLabel(season),
        gamesPlayed,
        shots: perGame(stats.shots ?? 0, gamesPlayed),
        hits: perGame(stats.hits ?? 0, gamesPlayed),
        blocks: perGame(stats.blocks ?? 0, gamesPlayed),
      };
    });
}

function CountingTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Row }> }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3 shadow-xl">
      <p className="mb-1 font-semibold text-ink">{row.seasonLabel} season</p>
      <p className="mb-2 text-xs text-ink-dim">{row.gamesPlayed} games played</p>
      {SERIES.map((series) => (
        <p key={series.key} className="flex items-center justify-between gap-4 text-sm text-ink">
          <span className="flex items-center gap-2"><span className="inline-block h-0.5 w-3" style={{ background: series.color }} aria-hidden="true" />{series.label}</span>
          <span className="font-medium tabular-nums">{row[series.key].toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}

const CHART_HEIGHT = 300;
const PLOT_HEIGHT = 230; // chart height minus margins, x-axis and legend, for label spacing
const LABEL_GAP_PX = 13;

/**
 * Vertical nudges (px) so end-of-line labels never overlap: labels are placed at
 * their line's last value, then pushed apart to at least LABEL_GAP_PX, keeping order.
 */
export function endLabelOffsets(lastValues: number[], yMax: number, plotHeight = PLOT_HEIGHT): number[] {
  const toPx = (value: number) => plotHeight - (value / yMax) * plotHeight;
  const order = lastValues.map((value, index) => ({ index, y: toPx(value) })).sort((a, b) => a.y - b.y);
  const placed: number[] = [];
  for (const item of order) {
    const previous = placed.length ? placed[placed.length - 1] : -Infinity;
    placed.push(Math.max(item.y, previous + LABEL_GAP_PX));
  }
  const offsets = new Array(lastValues.length).fill(0);
  order.forEach((item, i) => { offsets[item.index] = placed[i] - item.y; });
  return offsets;
}

/** Label each line once, at its last season, in text colour (identity beyond colour). */
function endLabel(label: string, lastIndex: number, dy: number) {
  return function EndLabel(props: { x?: number; y?: number; index?: number }) {
    if (props.index !== lastIndex || props.x === undefined || props.y === undefined) return null;
    return <text x={props.x + 8} y={props.y + 4 + dy} fill="var(--ink-dim)" fontSize={11}>{label}</text>;
  };
}

/** Per-game shots on goal, hits and blocks by season, on one shared per-game axis. */
export const CareerCountingChart: React.FC<{ careerCounting: Record<string, Partial<CareerCountingSeason>>; compact?: boolean }> = ({ careerCounting, compact = false }) => {
  const rows = useMemo(() => careerCountingRows(careerCounting), [careerCounting]);
  if (!rows.length) return null;
  const lastIndex = rows.length - 1;
  const recent = rows[lastIndex];
  // A fixed whole-number scale keeps seasons comparable and lets end labels be spaced.
  const yMax = Math.max(1, Math.ceil(Math.max(...rows.flatMap((row) => SERIES.map((series) => row[series.key]))) + 0.5));
  const labelOffsets = endLabelOffsets(SERIES.map((series) => recent[series.key]), yMax);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className={`mb-1 font-semibold text-ink ${compact ? 'text-sm' : 'text-lg'}`}>Shots, Hits &amp; Blocks per Game</h3>
        <p className="text-sm text-ink-dim">
          {recent.seasonLabel}: {recent.shots.toFixed(2)} shots · {recent.hits.toFixed(2)} hits · {recent.blocks.toFixed(2)} blocks per game
        </p>
      </div>

      <ResponsiveContainer width="100%" height={compact ? 220 : CHART_HEIGHT}>
        {/* End labels need room on the right; on phones the legend and table carry identity. */}
        <LineChart data={rows} margin={{ top: 5, right: compact ? 12 : 96, left: compact ? -16 : 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis dataKey="seasonLabel" stroke="var(--ink-dim)" tick={{ fill: 'var(--ink-dim)', fontSize: 12 }} />
          <YAxis
            domain={[0, yMax]}
            allowDecimals
            label={compact ? undefined : { value: 'Per game', angle: -90, position: 'insideLeft', fill: 'var(--ink-dim)' }}
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <Tooltip content={<CountingTooltip />} cursor={{ stroke: 'var(--ink-mute)', strokeDasharray: '3 3' }} />
          <Legend wrapperStyle={{ color: 'var(--ink-dim)', fontSize: 12 }} formatter={(value) => <span style={{ color: 'var(--ink-dim)' }}>{value}</span>} />
          {SERIES.map((series, seriesIndex) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)', fill: series.color }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--surface-1)' }}
              label={compact ? undefined : endLabel(series.label, lastIndex, labelOffsets[seriesIndex])}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <details className="mt-2 text-xs text-ink-dim">
        <summary className="cursor-pointer font-semibold text-ink">Show as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left tabular-nums">
            <thead className="text-ink-mute">
              <tr><th className="py-1 pr-3 font-medium">Season</th><th className="py-1 pr-3 font-medium">GP</th>{SERIES.map((series) => <th key={series.key} className="py-1 pr-3 font-medium">{series.label} / GP</th>)}</tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.season} className="border-t border-line text-ink">
                  <td className="py-1 pr-3">{row.seasonLabel}</td>
                  <td className="py-1 pr-3">{row.gamesPlayed}</td>
                  {SERIES.map((series) => <td key={series.key} className="py-1 pr-3">{row[series.key].toFixed(2)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
