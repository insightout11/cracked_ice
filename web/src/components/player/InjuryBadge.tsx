import { TooltipLabel } from '../ui/tooltip';
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface InjuryBadgeProps {
  injuryStatus?: string;
  injuryStatusFull?: string;
  injuryNote?: string;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Use the browser's native title instead of a Radix tooltip. For long, dense
   * lists (the ranked Draft Board) where one tooltip root per row adds up.
   */
  nativeTitle?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  O: 'Out',
  NA: 'Not Active',
  DTD: 'Day-to-day',
  IR: 'Injured Reserve',
  'IR+': 'Injured Reserve (longer)',
  'IR-LT': 'Injured Reserve (long-term)',
};

export const InjuryBadge: React.FC<InjuryBadgeProps> = ({
  injuryStatus,
  injuryStatusFull,
  injuryNote,
  isActive,
  size = 'md',
  nativeTitle = false,
}) => {
  // A reported status (Yahoo, or the NHL 'INACTIVE' flag) always shows; the NHL
  // active flag alone lags behind injury news, so it never hides one.
  if (!injuryStatus && isActive !== false) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1'
  };
  const iconSizes = { sm: 10, md: 12, lg: 14 };
  const statusLabel = STATUS_LABELS[injuryStatus ?? ''] ?? injuryStatusFull ?? injuryStatus ?? 'Not Active';
  const tip = injuryNote ? `${statusLabel}: ${injuryNote}` : statusLabel;
  // Small badges sit inside dense rows (draft board): show the short Yahoo code and
  // leave the full label and injury note to the tooltip.
  const compact = size === 'sm';
  const visibleLabel = compact && injuryStatus ? injuryStatus : statusLabel;

  const badge = (
    <div
      className={`inline-flex items-center gap-1 rounded-full border font-bold bg-negative-muted text-negative border-negative ${sizeClasses[size]}`}
      {...(nativeTitle ? { title: tip, role: 'img', 'aria-label': tip } : {})}
    >
      <AlertCircle size={iconSizes[size]} aria-hidden="true" />
      <span aria-hidden={nativeTitle || undefined}>{visibleLabel}</span>
      {injuryNote && !compact ? <span className="font-normal opacity-80">({injuryNote})</span> : null}
    </div>
  );

  return nativeTitle ? badge : <TooltipLabel label={tip}>{badge}</TooltipLabel>;
};
