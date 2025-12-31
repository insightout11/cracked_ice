import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  team?: string;
}

interface GoalsAssistsSplitChartProps {
  careerHistory: Record<string, CareerSeasonStats>;
  currentSeason?: string;
}

export const GoalsAssistsSplitChart: React.FC<GoalsAssistsSplitChartProps> = ({
  careerHistory,
  currentSeason
}) => {
  // Convert career history to chart data
  const chartData = useMemo(() => {
    return Object.entries(careerHistory)
      .map(([season, stats]) => {
        // Format season string for display (e.g., "20242025" -> "24-25")
        const seasonLabel = season.length === 8
          ? `${season.slice(2, 4)}-${season.slice(6, 8)}`
          : season;

        return {
          season,
          seasonLabel,
          goals: stats.goals,
          assists: stats.assists,
          points: stats.points,
          team: stats.team,
          gamesPlayed: stats.gamesPlayed,
          isCurrentSeason: season === currentSeason
        };
      })
      .sort((a, b) => a.season.localeCompare(b.season)); // Sort chronologically
  }, [careerHistory, currentSeason]);

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
          <p className="text-blue-400 font-medium">{data.goals} Goals</p>
          <p className="text-purple-400 font-medium">{data.assists} Assists</p>
          <p className="text-emerald-400 font-medium">{data.points} Points</p>
          <p className="text-slate-400 text-sm">{data.gamesPlayed} GP</p>
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
        <h3 className="text-lg font-semibold text-white mb-1">Career Goals & Assists Breakdown</h3>
        <p className="text-sm text-slate-400">
          Stacked view of goal and assist production by season
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="seasonLabel"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Goals / Assists', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Team change indicators */}
          {Array.from(teamChangeSeasons).map(seasonLabel => (
            <ReferenceLine
              key={seasonLabel}
              x={seasonLabel}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: "▼",
                fill: "#f59e0b",
                fontSize: 14,
                position: "top"
              }}
            />
          ))}

          {/* Stacked areas */}
          <Area
            type="monotone"
            dataKey="goals"
            stackId="stats"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="assists"
            stackId="stats"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
