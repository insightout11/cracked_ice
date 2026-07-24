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
      <div className="rounded-lg border border-line bg-surface-2 p-6">
        <h3 className="text-sm font-medium text-ink-dim mb-4">Wins & Shutouts by Season</h3>
        <p className="text-sm text-ink-dim">No wins/shutouts data available (min 5 GP per season)</p>
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
    <div className="rounded-lg border border-line bg-surface-2 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ink-dim">Wins & Shutouts by Season</h3>
        <div className="flex gap-4 text-xs text-ink-dim">
          <span>Total Wins: <span className="text-positive font-semibold">{totalWins}</span></span>
          <span>Total SO: <span className="text-accent font-semibold">{totalShutouts}</span></span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="season"
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <YAxis
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--line-strong)',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'var(--ink)' }}
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
          <Bar dataKey="wins" fill="var(--positive)" name="Wins" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.season === bestSeason.season ? 'var(--positive)' : 'var(--positive)'}
              />
            ))}
          </Bar>
          <Bar dataKey="shutouts" fill="var(--accent)" name="Shutouts" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-between text-xs text-ink-dim">
        <span>Career Win %: <span className="text-ink-dim">{avgWinPct.toFixed(1)}%</span></span>
        <span>Best Season: <span className="text-positive">{bestSeason.season} ({bestSeason.wins}W)</span></span>
      </div>
    </div>
  );
}
