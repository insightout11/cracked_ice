import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';

interface GoalieWinsShutoutsChartProps {
  careerHistory: Record<string, {
    gamesPlayed: number;
    wins?: number;
    losses?: number;
    overtimeLosses?: number;
    shutouts?: number;
    team?: string;
  }>;
}

export function GoalieWinsShutoutsChart({ careerHistory }: GoalieWinsShutoutsChartProps) {
  const data = useMemo(() => {
    return Object.entries(careerHistory)
      .filter(([_, stats]) => stats.gamesPlayed >= 5)
      .map(([season, stats]) => {
        const wins = stats.wins || 0;
        const losses = stats.losses || 0;
        const otLosses = stats.overtimeLosses || 0;
        const totalDecisions = wins + losses + otLosses;
        const winPct = totalDecisions > 0 ? (wins / totalDecisions) * 100 : 0;

        return {
          season: season.replace('season', '').replace(/(\d{4})(\d{4})/, '$1-$2'),
          wins,
          shutouts: stats.shutouts || 0,
          losses,
          overtimeLosses: otLosses,
          gp: stats.gamesPlayed,
          winPct,
          team: stats.team
        };
      })
      .sort((a, b) => a.season.localeCompare(b.season));
  }, [careerHistory]);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Wins & Shutouts by Season</h3>
        <p className="text-sm text-slate-500">No wins/shutouts data available (min 5 GP per season)</p>
      </div>
    );
  }

  const totalWins = data.reduce((sum, d) => sum + d.wins, 0);
  const totalShutouts = data.reduce((sum, d) => sum + d.shutouts, 0);
  const avgWinPct = data.reduce((sum, d) => sum + d.winPct, 0) / data.length;

  // Find best season by wins
  const bestSeason = data.reduce((best, current) =>
    current.wins > best.wins ? current : best
  , data[0]);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">Wins & Shutouts by Season</h3>
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Total Wins: <span className="text-green-400 font-semibold">{totalWins}</span></span>
          <span>Total SO: <span className="text-blue-400 font-semibold">{totalShutouts}</span></span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="season"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number, name: string, props: any) => {
              const payload = props.payload;
              if (name === 'wins') {
                const record = `${payload.wins}-${payload.losses}${payload.overtimeLosses > 0 ? `-${payload.overtimeLosses}` : ''}`;
                return [
                  <span key="value">
                    {value} ({record}, {payload.winPct.toFixed(1)}%)
                  </span>,
                  'Wins'
                ];
              }
              if (name === 'shutouts') {
                return [value, 'Shutouts'];
              }
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                const data = payload[0].payload;
                return data.team ? `${label} (${data.team})` : label;
              }
              return label;
            }}
          />
          <Legend />
          <Bar dataKey="wins" fill="#22c55e" name="Wins" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.season === bestSeason.season ? '#10b981' : '#22c55e'}
              />
            ))}
          </Bar>
          <Bar dataKey="shutouts" fill="#3b82f6" name="Shutouts" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Career Win %: <span className="text-slate-300">{avgWinPct.toFixed(1)}%</span></span>
        <span>Best Season: <span className="text-green-400">{bestSeason.season} ({bestSeason.wins}W)</span></span>
      </div>
    </div>
  );
}
