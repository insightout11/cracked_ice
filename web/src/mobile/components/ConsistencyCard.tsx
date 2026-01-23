import { useMemo } from 'react';

interface CareerSeasonStats {
  gamesPlayed?: number;
  points?: number;
  goals?: number;
  assists?: number;
}

interface ConsistencyCardProps {
  careerHistory: Record<string, CareerSeasonStats>;
}

type ConsistencyRating = 'elite' | 'steady' | 'variable' | 'volatile';

interface ConsistencyResult {
  rating: ConsistencyRating;
  stdDev: number;
  label: string;
  description: string;
  percentage: number; // 0-100 for progress bar
}

/**
 * Calculate standard deviation of PPG across seasons
 */
function calculateConsistency(careerHistory: Record<string, CareerSeasonStats>): ConsistencyResult | null {
  const ppgValues = Object.values(careerHistory)
    .filter((stats) => (stats.gamesPlayed ?? 0) >= 20) // Only full seasons
    .map((stats) => (stats.points ?? 0) / (stats.gamesPlayed ?? 1));

  if (ppgValues.length < 2) return null;

  // Calculate mean
  const mean = ppgValues.reduce((sum, v) => sum + v, 0) / ppgValues.length;

  // Calculate variance
  const variance = ppgValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / ppgValues.length;

  // Standard deviation
  const stdDev = Math.sqrt(variance);

  // Normalize std dev relative to mean (coefficient of variation)
  const cv = mean > 0 ? stdDev / mean : stdDev;

  // Map to rating
  let rating: ConsistencyRating;
  let label: string;
  let description: string;
  let percentage: number;

  if (cv < 0.15) {
    rating = 'elite';
    label = 'Elite';
    description = 'Extremely consistent producer year over year';
    percentage = 95;
  } else if (cv < 0.30) {
    rating = 'steady';
    label = 'Steady';
    description = 'Reliable production with minor variance';
    percentage = 75;
  } else if (cv < 0.50) {
    rating = 'variable';
    label = 'Variable';
    description = 'Production varies significantly by season';
    percentage = 45;
  } else {
    rating = 'volatile';
    label = 'Volatile';
    description = 'Highly inconsistent across seasons';
    percentage = 20;
  }

  return { rating, stdDev, label, description, percentage };
}

/**
 * ConsistencyCard - Visual consistency indicator
 *
 * Shows a progress bar with rating (Elite/Steady/Variable/Volatile)
 * based on standard deviation of PPG across career seasons.
 */
export function ConsistencyCard({ careerHistory }: ConsistencyCardProps) {
  const consistency = useMemo(
    () => calculateConsistency(careerHistory),
    [careerHistory]
  );

  if (!consistency) {
    return null;
  }

  const { rating, stdDev, label, description, percentage } = consistency;

  // Color based on rating
  const colors = {
    elite: {
      bar: 'bg-green-500',
      text: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    steady: {
      bar: 'bg-cyan-500',
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    variable: {
      bar: 'bg-yellow-500',
      text: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    volatile: {
      bar: 'bg-red-500',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  };

  const color = colors[rating];

  return (
    <div className="bg-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Consistency</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
          {label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-slate-900/50 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${color.bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{description}</span>
        <span className={`font-medium ${color.text}`}>
          {stdDev.toFixed(2)} σ
        </span>
      </div>

      {/* Scale reference */}
      <div className="flex justify-between mt-3 px-1">
        <span className="text-[9px] text-slate-600">Volatile</span>
        <span className="text-[9px] text-slate-600">Variable</span>
        <span className="text-[9px] text-slate-600">Steady</span>
        <span className="text-[9px] text-slate-600">Elite</span>
      </div>
    </div>
  );
}
