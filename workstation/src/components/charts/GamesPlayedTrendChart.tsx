import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  team?: string;
}

interface GamesPlayedTrendChartProps {
  careerHistory: Record<string, CareerSeasonStats>;
  currentSeason?: string;
}

export const GamesPlayedTrendChart: React.FC<GamesPlayedTrendChartProps> = ({
  careerHistory,
  currentSeason
}) => {
  // Convert career history to chart data with conditional coloring
  const chartData = useMemo(() => {
    return Object.entries(careerHistory)
      .map(([season, stats]) => {
        // Format season string for display (e.g., "20242025" -> "24-25")
        const seasonLabel = season.length === 8
          ? `${season.slice(2, 4)}-${season.slice(6, 8)}`
          : season;

        const gamesPlayed = stats.gamesPlayed;
        const pct = (gamesPlayed / 82) * 100;

        // Determine bar color based on games played
        let fillColor = '#10b981'; // emerald-500 (healthy: 70+ games)
        if (gamesPlayed < 50) fillColor = '#ef4444'; // red-500 (injury-plagued)
        else if (gamesPlayed < 70) fillColor = '#f59e0b'; // amber-500 (partial season)

        return {
          season,
          seasonLabel,
          gamesPlayed,
          team: stats.team,
          fillColor,
          pct: Math.round(pct),
          isCurrentSeason: season === currentSeason
        };
      })
      .sort((a, b) => a.season.localeCompare(b.season)); // Sort chronologically
  }, [careerHistory, currentSeason]);

  // Calculate average games played for summary
  const avgGamesPlayed = useMemo(() => {
    const total = Object.values(careerHistory)
      .reduce((sum, s) => sum + s.gamesPlayed, 0);
    return (total / Object.keys(careerHistory).length).toFixed(1);
  }, [careerHistory]);

  // Detect team changes
  const teamChangeSeasons = useMemo(() => {
    const sorted = Object.entries(careerHistory)
      .sort(([a], [b]) => a.localeCompare(b));

    const changes = new Set<string>();
    for (let i = 1; i < sorted.length; i++) {
      const [prevSeason, prevStats] = sorted[i - 1];
      const [currSeason, currStats] = sorted[i];

      if (prevStats.team && currStats.team &&
          prevStats.team !== currStats.team) {
        const currLabel = currSeason.length === 8
          ? `${currSeason.slice(2, 4)}-${currSeason.slice(6, 8)}`
          : currSeason;
        changes.add(currLabel);
      }
    }
    return changes;
  }, [careerHistory]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const isTeamChange = teamChangeSeasons.has(data.seasonLabel);

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold mb-2">{data.seasonLabel} Season</p>
        {data.team && <p className="text-slate-400 text-sm mb-2">{data.team}</p>}
        {isTeamChange && (
          <div className="mb-2 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-400">
            Team Change
          </div>
        )}
        <div className="space-y-1">
          <p className="text-white font-medium">{data.gamesPlayed} / 82 GP</p>
          <p className="text-slate-400 text-sm">{data.pct}% of season</p>
        </div>
        {data.isCurrentSeason && (
          <p className="text-xs text-cyan-400 mt-2">Current Season</p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">Games Played by Season</h3>
        <p className="text-sm text-slate-400">
          Average: {avgGamesPlayed} GP per season
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="seasonLabel"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            domain={[0, 82]}
            label={{ value: 'Games Played', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Full season reference line */}
          <ReferenceLine
            y={82}
            stroke="#64748b"
            strokeDasharray="5 5"
            label={{ value: 'Full Season', fill: '#64748b', fontSize: 11, position: 'right' }}
          />

          {/* Team change indicators */}
          {Array.from(teamChangeSeasons).map(seasonLabel => (
            <ReferenceLine
              key={seasonLabel}
              x={seasonLabel}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          ))}

          {/* Bars with conditional colors */}
          <Bar dataKey="gamesPlayed" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fillColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
