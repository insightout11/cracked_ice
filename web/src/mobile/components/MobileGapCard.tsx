import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface GapDate {
  date: string;
  unusedSlots: Record<string, number>;
}

interface MobileGapCardProps {
  gapDate: GapDate;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const POSITION_ORDER = ['C', 'LW', 'RW', 'D', 'G', 'F', 'UTIL', 'BN'];

/**
 * MobileGapCard - Displays gaps for a single date
 *
 * Shows:
 * - Formatted date (e.g., "Mon, Jan 20")
 * - Position badges with gap counts
 * - Total unused slots
 * - Expandable for more detail
 */
export function MobileGapCard({ gapDate, isExpanded, onToggle }: MobileGapCardProps) {
  // Parse date and format
  const dateObj = parseISO(gapDate.date);
  const formattedDate = format(dateObj, 'EEE, MMM d');
  const dayOfWeek = format(dateObj, 'EEEE');

  // Filter and sort positions with gaps
  const positionsWithGaps = Object.entries(gapDate.unusedSlots)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => {
      const aIndex = POSITION_ORDER.indexOf(a[0]);
      const bIndex = POSITION_ORDER.indexOf(b[0]);
      return aIndex - bIndex;
    });

  // Total unused slots
  const totalSlots = positionsWithGaps.reduce((sum, [_, count]) => sum + count, 0);

  if (totalSlots === 0) return null;

  return (
    <div className="bg-surface-2 rounded-xl border border-line overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left active:bg-surface-2"
      >
        <div className="flex-1">
          {/* Date */}
          <div className="font-semibold text-ink text-sm">
            {formattedDate}
          </div>

          {/* Position Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {positionsWithGaps.map(([position, count]) => (
              <span
                key={position}
                className="px-2 py-0.5 bg-warning-muted border border-warning rounded text-xs font-semibold text-warning"
              >
                {position}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Total & Chevron */}
        <div className="flex items-center gap-2 ml-4">
          <div className="text-right">
            <div className="text-lg font-bold text-warning">{totalSlots}</div>
            <div className="text-[10px] text-ink-dim uppercase">slots</div>
          </div>
          {onToggle && (
            isExpanded ? (
              <ChevronUp className="w-5 h-5 text-ink-dim" />
            ) : (
              <ChevronDown className="w-5 h-5 text-ink-dim" />
            )
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-line pt-3">
          <p className="text-xs text-ink-dim mb-2">
            {dayOfWeek} - Your roster has {totalSlots} unfilled position{totalSlots !== 1 ? 's' : ''}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {positionsWithGaps.map(([position, count]) => (
              <div
                key={position}
                className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2"
              >
                <span className="text-sm text-ink-dim">{position}</span>
                <span className="text-sm font-bold text-warning">{count} empty</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MobileGapCardCompact - Ultra-compact version for summary view
 */
export function MobileGapCardCompact({ gapDate }: { gapDate: GapDate }) {
  const dateObj = parseISO(gapDate.date);
  const formattedDate = format(dateObj, 'M/d');
  const dayAbbr = format(dateObj, 'EEE');

  const totalSlots = Object.values(gapDate.unusedSlots).reduce((sum, count) => sum + count, 0);

  if (totalSlots === 0) return null;

  return (
    <div className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2 border border-line">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-dim">{dayAbbr}</span>
        <span className="text-sm font-medium text-ink">{formattedDate}</span>
      </div>
      <span className="px-2 py-0.5 bg-warning-muted rounded text-xs font-bold text-warning">
        {totalSlots}
      </span>
    </div>
  );
}
