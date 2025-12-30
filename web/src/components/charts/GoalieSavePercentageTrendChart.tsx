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

interface GoalieSavePercentageTrendChartProps {
  careerHistory: Record<string, {
    gamesPlayed: number;
    savePct?: number;
    goalsAgainstAverage?: number;
    team?: string;
  }>;
}

export function GoalieSavePercentageTrendChart({ careerHistory }: GoalieSavePercentageTrendChartProps) {
  const data = useMemo(() => {
    return Object.entries(careerHistory)
      .filter(([_, stats]) => stats.gamesPlayed >= 10 && stats.savePct !== undefined)
      .map(([season, stats]) => ({
        season: season.replace('season', '').replace(/(\d{4})(\d{4})/, '$1-$2'),
        savePct: stats.savePct ? (stats.savePct * 100) : 0,
        gaa: stats.goalsAgainstAverage || 0,
        gp: stats.gamesPlayed,
        team: stats.team
      }))
      .sort((a, b) => a.season.localeCompare(b.season));
  }, [careerHistory]);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Save Percentage Trend</h3>
        <p className="text-sm text-slate-500">No save percentage data available (min 10 GP per season)</p>
      </div>
    );
  }

  const avgSavePct = data.reduce((sum, d) => sum + d.savePct, 0) / data.length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Save Percentage Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="season"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            domain={[
              (dataMin: number) => Math.floor((dataMin - 2) / 5) * 5,
              (dataMax: number) => Math.ceil((dataMax + 2) / 5) * 5
            ]}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'savePct') {
                return [
                  <span key="value">
                    {value.toFixed(2)}% ({props.payload.gp} GP)
                  </span>,
                  'Save %'
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
            y={avgSavePct}
            stroke="#64748b"
            strokeDasharray="5 5"
            label={{
              value: `Career Avg: ${avgSavePct.toFixed(2)}%`,
              position: 'insideTopRight',
              fill: '#64748b',
              fontSize: 11
            }}
          />
          <Line
            type="monotone"
            dataKey="savePct"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Save %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
