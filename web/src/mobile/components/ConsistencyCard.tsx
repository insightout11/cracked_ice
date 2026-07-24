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
      bar: 'bg-positive',
      text: 'text-positive',
      bg: 'bg-positive-muted',
    },
    steady: {
      bar: 'bg-accent',
      text: 'text-accent',
      bg: 'bg-accent-muted',
    },
    variable: {
      bar: 'bg-warning',
      text: 'text-warning',
      bg: 'bg-warning-muted',
    },
    volatile: {
      bar: 'bg-negative',
      text: 'text-negative',
      bg: 'bg-negative-muted',
    },
  };

  const color = colors[rating];

  return (
    <div className="bg-surface-2 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-ink">Consistency</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
          {label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-surface-2 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${color.bar} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-dim">{description}</span>
        <span className={`font-medium ${color.text}`}>
          {stdDev.toFixed(2)} σ
        </span>
      </div>

      {/* Scale reference */}
      <div className="flex justify-between mt-3 px-1">
        <span className="text-[9px] text-ink-dim">Volatile</span>
        <span className="text-[9px] text-ink-dim">Variable</span>
        <span className="text-[9px] text-ink-dim">Steady</span>
        <span className="text-[9px] text-ink-dim">Elite</span>
      </div>
    </div>
  );
}
