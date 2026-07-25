import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  team?: string;
}

interface CareerSummary {
  totalSeasons: number;
  totalGames: number;
  careerAvgPPG: number;
  bestSeason: string;
  bestSeasonPPG: number;
}

interface CareerTrendChartProps {
  careerHistory: Record<string, CareerSeasonStats>;
  careerSummary: CareerSummary;
  currentSeason?: string;
}

export const CareerTrendChart: React.FC<CareerTrendChartProps> = ({
  careerHistory,
  careerSummary,
  currentSeason
}) => {
  // Convert career history to chart data
  const chartData = Object.entries(careerHistory)
    .map(([season, stats]) => {
      const ppg = stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0;

      // Format season string for display (e.g., "20242025" -> "24-25")
      const seasonLabel = season.length === 8
        ? `${season.slice(2, 4)}-${season.slice(6, 8)}`
        : season;

      return {
        season,
        seasonLabel,
        points: stats.points,
        ppg: Number(ppg.toFixed(2)),
        gamesPlayed: stats.gamesPlayed,
        goals: stats.goals,
        assists: stats.assists,
        team: stats.team,
        isCurrentSeason: season === currentSeason
      };
    })
    .sort((a, b) => a.season.localeCompare(b.season)); // Sort chronologically

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-surface-2 border border-line rounded-lg p-3 shadow-xl">
        <p className="text-ink font-semibold mb-2">{data.seasonLabel} Season</p>
        {data.team && <p className="text-ink-dim text-sm mb-2">{data.team}</p>}
        <div className="space-y-1">
          <p className="text-positive font-medium">{data.ppg} PPG</p>
          <p className="text-ink-dim text-sm">{data.points} points in {data.gamesPlayed} GP</p>
          <p className="text-ink-dim text-sm">{data.goals}G, {data.assists}A</p>
        </div>
        {data.isCurrentSeason && (
          <p className="text-xs text-accent mt-2">Current Season</p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-ink mb-1">Career Points Per Game Trend</h3>
        <p className="text-sm text-ink-dim">
          Career Average: {careerSummary.careerAvgPPG.toFixed(2)} PPG over {careerSummary.totalSeasons} seasons
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="seasonLabel"
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Points per Game', angle: -90, position: 'insideLeft', fill: 'var(--ink-dim)' }}
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Career average reference line */}
          <ReferenceLine
            y={careerSummary.careerAvgPPG}
            stroke="var(--ink-mute)"
            strokeDasharray="5 5"
            label={{
              value: 'Career Avg',
              fill: 'var(--ink-mute)',
              fontSize: 11,
              position: 'right'
            }}
          />

          {/* Main PPG line */}
          <Line
            type="monotone"
            dataKey="ppg"
            stroke="var(--positive)"
            strokeWidth={3}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={payload.isCurrentSeason ? 6 : 4}
                  fill={payload.isCurrentSeason ? 'var(--accent)' : 'var(--positive)'}
                  stroke={payload.isCurrentSeason ? 'var(--accent)' : 'var(--positive)'}
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 8, fill: 'var(--positive)', stroke: 'var(--positive)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
