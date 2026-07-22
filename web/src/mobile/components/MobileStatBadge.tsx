interface MobileStatBadgeProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'ice' | 'games' | 'trend';
  iceScore?: number; // For ICE variant color coding
  trendPercent?: number; // For trend variant
  size?: 'sm' | 'md';
}

/**
 * Get ICE score color based on value
 * Green (85+), Yellow (70-84), Orange (55-69), Red (<55)
 */
function getIceScoreColor(score: number): { bg: string; border: string; text: string } {
  if (score >= 85) return { bg: 'bg-positive-muted', border: 'border-positive', text: 'text-positive' };
  if (score >= 70) return { bg: 'bg-warning-muted', border: 'border-warning', text: 'text-warning' };
  if (score >= 55) return { bg: 'bg-warning-muted', border: 'border-warning', text: 'text-warning' };
  return { bg: 'bg-negative-muted', border: 'border-negative', text: 'text-negative' };
}

/**
 * MobileStatBadge - Compact stat display badge
 *
 * Used throughout mobile UI to display:
 * - ICE scores (color coded)
 * - Games count
 * - Starts count
 * - Trend indicators (hot/cold)
 */
export function MobileStatBadge({
  label,
  value,
  variant = 'default',
  iceScore,
  trendPercent,
  size = 'md',
}: MobileStatBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  // ICE score variant with color coding
  if (variant === 'ice' && iceScore !== undefined) {
    const colors = getIceScoreColor(iceScore);
    return (
      <div className={`flex flex-col items-center ${sizeClasses} rounded-lg border ${colors.bg} ${colors.border}`}>
        <span className={`font-bold ${colors.text} text-[10px] uppercase`}>{label}</span>
        <span className={`font-bold text-ink ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
      </div>
    );
  }

  // Trend variant (hot/cold streak)
  if (variant === 'trend' && trendPercent !== undefined) {
    const isHot = trendPercent > 0;
    const isCold = trendPercent < -10;
    const isNeutral = !isHot && !isCold;

    if (isNeutral) return null;

    return (
      <div
        className={`
          flex items-center gap-1 ${sizeClasses} rounded-full border
          ${isHot ? 'bg-warning-muted border-warning text-warning' : ''}
          ${isCold ? 'bg-accent-muted border-accent text-accent' : ''}
        `}
      >
 <span>{isHot ? '' : ''}</span>
        <span className="font-semibold">
          {isHot ? '+' : ''}{trendPercent}%
        </span>
      </div>
    );
  }

  // Games variant
  if (variant === 'games') {
    return (
      <div className={`flex items-center gap-1 ${sizeClasses} rounded-lg bg-surface-2 border border-line`}>
        <span className="text-ink-dim font-medium">{label}:</span>
        <span className="text-ink font-semibold">{value}</span>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`flex items-center gap-1 ${sizeClasses} rounded-lg bg-surface-2 border border-line`}>
      <span className="text-ink-dim font-medium">{label}:</span>
      <span className="text-ink font-semibold">{value}</span>
    </div>
  );
}

/**
 * Compact ICE score badge for inline use
 */
export function MobileIceBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const colors = getIceScoreColor(score);
  const sizeClasses = size === 'sm'
    ? 'w-10 h-10 text-sm'
    : 'w-12 h-12 text-base';

  return (
    <div
      className={`
        ${sizeClasses} rounded-full flex flex-col items-center justify-center
        border-2 ${colors.bg} ${colors.border}
      `}
    >
      <span className={`font-bold ${colors.text}`}>{score.toFixed(1)}</span>
      <span className="text-[8px] text-ink-dim uppercase">ICE</span>
    </div>
  );
}
