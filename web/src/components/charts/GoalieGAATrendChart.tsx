import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';

interface GoalieGAATrendChartProps {
  careerHistory: Record<string, {
    gamesPlayed: number;
    goalsAgainstAverage?: number;
    savePct?: number;
    team?: string;
  }>;
}

export function GoalieGAATrendChart({ careerHistory }: GoalieGAATrendChartProps) {
  const data = useMemo(() => {
    return Object.entries(careerHistory)
      .filter(([_, stats]) => stats.gamesPlayed >= 10 && stats.goalsAgainstAverage !== undefined)
      .map(([season, stats]) => ({
        season: season.replace('season', '').replace(/(\d{4})(\d{4})/, '$1-$2'),
        gaa: stats.goalsAgainstAverage || 0,
        savePct: stats.savePct ? (stats.savePct * 100) : 0,
        gp: stats.gamesPlayed,
        team: stats.team
      }))
      .sort((a, b) => a.season.localeCompare(b.season));
  }, [careerHistory]);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface-2 p-6">
        <h3 className="text-sm font-medium text-ink-dim mb-4">Goals Against Average Trend</h3>
        <p className="text-sm text-ink-dim">No GAA data available (min 10 GP per season)</p>
      </div>
    );
  }

  const avgGAA = data.reduce((sum, d) => sum + d.gaa, 0) / data.length;

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-6">
      <h3 className="text-sm font-medium text-ink-dim mb-4">Goals Against Average Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="season"
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <YAxis
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
            domain={[
              (dataMin: number) => Math.max(0, Math.floor((dataMin - 0.5) * 2) / 2),
              (dataMax: number) => Math.ceil((dataMax + 0.5) * 2) / 2
            ]}
            tickFormatter={(value) => value.toFixed(2)}
            reversed={true}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--line-strong)',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'var(--ink)' }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'gaa') {
                return [
                  <span key="value">
                    {value.toFixed(2)} ({props.payload.gp} GP)
                  </span>,
                  'GAA'
                ];
              }
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                const team = payload[0].payload.team;
                return team ? `${label} (${team})` : label;
              }
              return label;
            }}
          />
          <Legend />
          <ReferenceLine
            y={avgGAA}
            stroke="var(--ink-mute)"
            strokeDasharray="5 5"
            label={{
              value: `Career Avg: ${avgGAA.toFixed(2)}`,
              position: 'insideTopRight',
              fill: 'var(--ink-mute)',
              fontSize: 11
            }}
          />
          <Line
            type="monotone"
            dataKey="gaa"
            stroke="var(--negative)"
            strokeWidth={2}
            dot={{ fill: 'var(--negative)', r: 4 }}
            activeDot={{ r: 6 }}
            name="GAA"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-ink-dim mt-2 text-center">Lower is better</p>
    </div>
  );
}
