import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface CareerSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  team?: string;
}

interface ConsistencyMetricChartProps {
  careerHistory: Record<string, CareerSeasonStats>;
  currentSeason?: string;
}

export const ConsistencyMetricChart: React.FC<ConsistencyMetricChartProps> = ({
  careerHistory,
  currentSeason
}) => {
  // Calculate career average PPG, variance, and consistency score
  const { chartData, careerAvgPPG, consistencyScore } = useMemo(() => {
    // Calculate career average PPG
    const totalGames = Object.values(careerHistory)
      .reduce((sum, s) => sum + s.gamesPlayed, 0);
    const totalPoints = Object.values(careerHistory)
      .reduce((sum, s) => sum + s.points, 0);
    const avgPPG = totalGames > 0 ? totalPoints / totalGames : 0;

    // Transform data with variance calculations
    const data = Object.entries(careerHistory)
      .map(([season, stats]) => {
        const seasonLabel = season.length === 8
          ? `${season.slice(2, 4)}-${season.slice(6, 8)}`
          : season;

        const seasonPPG = stats.gamesPlayed > 0
          ? stats.points / stats.gamesPlayed
          : 0;
        const variance = seasonPPG - avgPPG;
        const variancePct = avgPPG > 0
          ? ((variance / avgPPG) * 100).toFixed(1)
          : '0.0';

        return {
          season,
          seasonLabel,
          seasonPPG: Number(seasonPPG.toFixed(2)),
          variance: Number(variance.toFixed(2)),
          variancePct,
          team: stats.team,
          gamesPlayed: stats.gamesPlayed,
          isAboveAverage: variance >= 0,
          fillColor: variance >= 0 ? 'var(--positive)' : 'var(--negative)',
          isCurrentSeason: season === currentSeason
        };
      })
      .sort((a, b) => a.season.localeCompare(b.season));

    // Calculate consistency score (standard deviation)
    const consistencyScore = Math.sqrt(
      data.reduce((sum, d) => sum + (d.variance ** 2), 0) / data.length
    );

    return { chartData: data, careerAvgPPG: avgPPG, consistencyScore };
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

  // Consistency rating interpretation
  const getConsistencyRating = (score: number): { label: string; color: string } => {
    if (score < 0.15) return { label: 'Elite Consistency', color: 'text-positive' };
    if (score < 0.30) return { label: 'Steady Producer', color: 'text-accent' };
    if (score < 0.50) return { label: 'Variable Performance', color: 'text-warning' };
    return { label: 'High Volatility', color: 'text-negative' };
  };

  const consistencyRating = getConsistencyRating(consistencyScore);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const isTeamChange = teamChangeSeasons.has(data.seasonLabel);

    return (
      <div className="bg-surface-2 border border-line rounded-lg p-3 shadow-xl">
        <p className="text-ink font-semibold mb-2">{data.seasonLabel} Season</p>
        {data.team && <p className="text-ink-dim text-sm mb-2">{data.team}</p>}
        {isTeamChange && (
          <div className="mb-2 px-2 py-1 bg-warning-muted border border-warning rounded text-xs text-warning">
            Team Change
          </div>
        )}
        <div className="space-y-1">
          <p className="text-ink font-medium">{data.seasonPPG} PPG</p>
          <p className="text-ink-dim text-sm">
            Career Avg: {careerAvgPPG.toFixed(2)} PPG
          </p>
          <p className={`font-medium text-sm ${data.isAboveAverage ? 'text-positive' : 'text-negative'}`}>
            {data.isAboveAverage ? '+' : ''}{data.variance} PPG ({data.isAboveAverage ? '+' : ''}{data.variancePct}%)
          </p>
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
        <h3 className="text-lg font-semibold text-ink mb-1">Career Consistency Analysis</h3>
        <p className="text-sm text-ink-dim">
          Variance from career average ({careerAvgPPG.toFixed(2)} PPG) •{' '}
          <span className={consistencyRating.color}>{consistencyRating.label}</span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="seasonLabel"
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'PPG Variance', angle: -90, position: 'insideLeft', fill: 'var(--ink-dim)' }}
            stroke="var(--ink-dim)"
            tick={{ fill: 'var(--ink-dim)', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Career average baseline */}
          <ReferenceLine
            y={0}
            stroke="var(--ink-mute)"
            strokeWidth={2}
            label={{ value: 'Career Avg', fill: 'var(--ink-mute)', fontSize: 11, position: 'right' }}
          />

          {/* Team change indicators */}
          {Array.from(teamChangeSeasons).map(seasonLabel => (
            <ReferenceLine
              key={seasonLabel}
              x={seasonLabel}
              stroke="var(--warning)"
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          ))}

          {/* Variance bars */}
          <Bar dataKey="variance" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fillColor}
                fillOpacity={0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
