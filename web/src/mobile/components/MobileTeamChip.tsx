import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobileTeamChipProps {
  team: string;
  gapsFilled: number;
  totalGaps?: number;
  playersAvailable?: number;
  onClick?: () => void;
}

/**
 * MobileTeamChip - Team recommendation chip for gaps view
 *
 * Shows:
 * - Team logo
 * - Team abbreviation
 * - Number of gaps this team can fill
 * - Optional: players available from this team
 */
export function MobileTeamChip({
  team,
  gapsFilled,
  totalGaps,
  playersAvailable,
  onClick,
}: MobileTeamChipProps) {
  // Calculate fill percentage for visual indicator
  const fillPercentage = totalGaps && totalGaps > 0
    ? Math.min(100, Math.round((gapsFilled / totalGaps) * 100))
    : 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center p-3 bg-surface-2 rounded-xl border border-line hover:border-accent active:bg-surface-2 transition-colors min-w-[80px]"
    >
      {/* Team Logo */}
      <div className="relative mb-2">
        <img
          src={getTeamLogoUrl(team)}
          alt={team}
          className="w-10 h-10 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = '0.3';
          }}
        />
        {/* Fill indicator ring */}
        {fillPercentage > 0 && (
          <svg
            className="absolute inset-0 w-10 h-10 -rotate-90"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-ink-dim"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${fillPercentage} 100`}
              className="text-accent"
            />
          </svg>
        )}
      </div>

      {/* Team Name */}
      <span className="text-xs font-bold text-ink mb-1">{team}</span>

      {/* Gaps Filled */}
      <div className="flex items-center gap-1">
        <span className="text-sm font-bold text-accent">{gapsFilled}</span>
        <span className="text-[10px] text-ink-dim">gaps</span>
      </div>

      {/* Players Available (optional) */}
      {playersAvailable !== undefined && (
        <span className="text-[10px] text-ink-dim mt-0.5">
          {playersAvailable} FA{playersAvailable !== 1 ? 's' : ''}
        </span>
      )}
    </button>
  );
}

/**
 * MobileTeamChipCompact - Smaller inline version
 */
export function MobileTeamChipCompact({
  team,
  gapsFilled,
  onClick,
}: {
  team: string;
  gapsFilled: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-lg border border-line hover:border-accent active:bg-surface-2 transition-colors"
    >
      <img
        src={getTeamLogoUrl(team)}
        alt={team}
        className="w-6 h-6 object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.opacity = '0.3';
        }}
      />
      <span className="text-xs font-bold text-ink">{team}</span>
      <span className="px-1.5 py-0.5 bg-accent-muted rounded text-[10px] font-bold text-accent">
        +{gapsFilled}
      </span>
    </button>
  );
}

/**
 * MobileTeamChipSkeleton - Loading placeholder
 */
export function MobileTeamChipSkeleton() {
  return (
    <div className="flex flex-col items-center p-3 bg-surface-2 rounded-xl border border-line min-w-[80px] animate-pulse">
      <div className="w-10 h-10 rounded-full bg-surface-2 mb-2" />
      <div className="w-8 h-3 bg-surface-2 rounded mb-1" />
      <div className="w-12 h-4 bg-surface-2 rounded" />
    </div>
  );
}
