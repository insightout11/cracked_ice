import { useState, useRef } from 'react';
import { mugshotSeason } from '../../lib/season';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobilePlayerSlotProps {
  slotId: string;
  slotLabel: string;
  player: RosterPlayer | null;
  projection?: PlayerProjection;
  onTap?: () => void;
  onAddPlayer?: () => void;
  onSwipeRemove?: () => void;
  // Drag state props
  isDragging?: boolean;
  isBeingDragged?: boolean;
  isOver?: boolean;
  isValidTarget?: boolean;
}

/**
 * Get ICE score glow style based on value
 * Enhanced glowing ring effect - brighter = higher score
 */
function getIceGlowStyle(score: number): React.CSSProperties {
  // Normalize the current 0-10 ICE scale.
  const t = Math.min(1, Math.max(0, score / 10));

  // Stronger glow on the ring itself
  const glowSize = 8 + t * 20;        // 8px to 28px
  const glowOpacity = 0.4 + t * 0.6;  // 0.4 to 1.0

  // Cyan color with score-based brightness
  const cyan = `var(--accent-muted)`; // 0.6-1.0 opacity

  return {
    boxShadow: `0 0 ${glowSize}px ${cyan}, inset 0 0 4px ${cyan}`,
    border: `2px solid ${cyan}`,
    background: 'var(--surface-0)', // Dark background for contrast
  };
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${numericId}.png`;
}

/**
 * MobilePlayerSlot - Player card for lineup view
 *
 * Features:
 * - Player headshot, name, team, positions
 * - Color-coded ICE score badge
 * - Games/Starts stats
 * - Hot/Cold trend indicator
 * - Injury status warning
 * - Swipe-to-remove gesture
 * - Menu button for more actions
 */
export function MobilePlayerSlot({
  slotId,
  slotLabel,
  player,
  projection,
  onTap,
  onAddPlayer,
  onSwipeRemove,
  isDragging = false,
  isBeingDragged = false,
  isOver = false,
  isValidTarget = false,
}: MobilePlayerSlotProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 100;

  // Droppable - all slots can be drop targets
  const {
    setNodeRef: setDroppableRef,
    isOver: isOverDroppable,
  } = useDroppable({
    id: slotId,
  });

  // Draggable - only for filled slots
  const {
    listeners,
    setNodeRef: setDraggableRef,
    isDragging: isCurrentlyDragging,
  } = useDraggable({
    id: player?.id || `empty-${slotId}`,
    disabled: !player,
  });

  // Combine refs for filled slots
  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    if (player) {
      setDraggableRef(node);
    }
  };

  // Track if this is a horizontal swipe (vs scroll)
  const isHorizontalSwipe = useRef(false);

  // Handle touch events for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isHorizontalSwipe.current = false;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const deltaX = e.touches[0].clientX - touchStart.current.x;
    const deltaY = e.touches[0].clientY - touchStart.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // If we haven't determined direction yet and have moved enough
    if (!isSwiping && !isHorizontalSwipe.current && (absDeltaX > 10 || absDeltaY > 10)) {
      // Determine if this is a horizontal swipe (left) or vertical scroll
      if (absDeltaX > absDeltaY && deltaX < -10) {
        // Horizontal swipe left - prevent scrolling and enable swipe mode
        isHorizontalSwipe.current = true;
        setIsSwiping(true);
      } else {
        // Vertical scroll or swipe right - let it scroll
        touchStart.current = null;
        return;
      }
    }

    // If we're in swipe mode, track the position
    if (isHorizontalSwipe.current && deltaX < 0) {
      e.preventDefault(); // Prevent scroll only when swiping
      setSwipeX(Math.max(deltaX, -150));
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalSwipe.current && swipeX < -SWIPE_THRESHOLD && onSwipeRemove) {
      onSwipeRemove();
    }
    setSwipeX(0);
    setIsSwiping(false);
    isHorizontalSwipe.current = false;
    touchStart.current = null;
  };

  // Determine visual state for empty slots during drag
  const emptySlotDragClasses = isDragging
    ? isValidTarget
      ? isOverDroppable
        ? 'ring-2 ring-accent scale-[1.02] border-accent'
        : 'ring-2 ring-accent border-accent animate-pulse'
      : 'opacity-40'
    : '';

  // Empty slot - compact with inline label
  if (!player) {
    return (
      <div ref={setDroppableRef} className="mb-2">
        <button
          onClick={onAddPlayer}
          className={`flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-line bg-surface-1/40 px-3 py-2.5 text-left transition-all hover:border-accent active:border-accent ${emptySlotDragClasses}`}
        >
          <span className="min-w-9 rounded-md bg-accent-muted px-1.5 py-1 text-center text-[10px] font-bold uppercase text-accent">
            {slotLabel}
          </span>
          <Plus className="w-3.5 h-3.5 text-ink-dim" />
          <span className="text-sm font-medium text-ink-dim">Add player</span>
        </button>
      </div>
    );
  }

  // Get ICE score and glow styling
  const iceScore = projection?.iceScore ?? 0;
  const iceGlowStyle = getIceGlowStyle(iceScore);

  // Injury check
  const hasInjury = player.injuryStatus && player.injuryStatus !== 'Active';

  // Role trend (for trending up/down icon)
  const roleTrend = player.roleTrend;
  const hasRoleTrend = roleTrend?.meetsThreshold;
  const isRoleIncreased = roleTrend?.type === 'increased';
  const ppToi = roleTrend?.season.avgPpToi ?? player.advancedStats?.ppTimeOnIcePerGame;
  const formattedPpToi = ppToi === undefined
    ? null
    : `${Math.floor(ppToi / 60)}:${Math.floor(ppToi % 60).toString().padStart(2, '0')}`;
  const hasScheduledGames = Boolean(projection && projection.gamesAvailable > 0);

  // Determine visual state for filled slots during drag
  const filledSlotDragClasses = isCurrentlyDragging
    ? 'opacity-30'
    : isDragging
      ? isValidTarget
        ? isOverDroppable
          ? 'ring-2 ring-accent scale-[1.02]'
          : 'ring-2 ring-accent'
        : 'opacity-40'
      : '';

  return (
    <div ref={setNodeRef} className="relative mb-2">
      {/* Swipe Background - only visible when actively swiping */}
      {swipeX < -10 && !isCurrentlyDragging && (
        <div className="absolute inset-0 flex items-center justify-end bg-negative-muted rounded-lg">
          <span className="text-negative font-semibold text-xs mr-3">Remove</span>
        </div>
      )}

      {/* Player Card - Compact Two-Row Layout */}
      <div
        className={`relative overflow-hidden rounded-xl border border-line bg-surface-2 shadow-sm transition-all ${filledSlotDragClasses}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          // Allow vertical pan (scrolling) by default, only block when actively swiping
          touchAction: isSwiping ? 'none' : 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...listeners}
      >
        <button
          onClick={onTap}
          className="w-full px-3 py-2.5 text-left active:bg-surface-1"
        >
          <div className="flex items-center gap-2">
            {/* Slot Label - Inline Left */}
            <span className="min-w-9 flex-shrink-0 rounded-md bg-accent-muted px-1.5 py-1 text-center text-[10px] font-bold uppercase text-accent">
              {slotLabel}
            </span>

            {/* Headshot + Team Logo Side by Side */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <img
                src={getHeadshotUrl(player.id, player.team)}
                alt={player.full_name}
                className="h-10 w-10 rounded-full border border-line bg-surface-1 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-player.png';
                }}
              />
              <img
                src={getTeamLogoUrl(player.team)}
                alt={player.team}
                className="h-5 w-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* Player Info - Two Rows */}
            <div className="flex-1 min-w-0">
              {/* Row 1: Name + Injury */}
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold text-ink">
                  {player.full_name}
                </span>
                {hasInjury && (
                  <AlertTriangle className="w-3 h-3 text-negative flex-shrink-0" />
                )}
              </div>
              {/* Row 2: Team, Position, Stats, Trend, Role */}
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-ink-dim">
                <span>{player.team} • {player.positions?.slice(0, 2).join(',') || 'N/A'}</span>
                {hasScheduledGames ? (
                  <>
                    <span>{projection?.gamesAvailable} games</span>
                    <span className="text-accent">{projection?.starts} starts</span>
                  </>
                ) : (
                  <span className="text-ink-mute">No games</span>
                )}
                {formattedPpToi && (
                  <span className="flex items-center gap-0.5 text-ink-dim">
                    <Zap className="w-2.5 h-2.5 text-accent" />
                    PP {formattedPpToi}
                  </span>
                )}
                {hasRoleTrend && (
                  <span className={`flex items-center gap-0.5 font-semibold ${isRoleIncreased ? 'text-positive' : 'text-negative'}`}>
                    {isRoleIncreased ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    Role {isRoleIncreased ? 'up' : 'down'}
                  </span>
                )}
              </div>
            </div>

            {/* ICE Score Circle - Glowing */}
            <div
              className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-full"
              style={iceGlowStyle}
            >
              <span className="font-mono text-[11px] font-bold leading-none text-ink">{iceScore.toFixed(1)}</span>
              <span className="mt-0.5 text-[7px] font-bold uppercase text-ink-mute">ICE</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

/**
 * MobilePlayerSlotEmpty - Compact empty slot variant with inline label
 */
export function MobilePlayerSlotEmpty({
  slotLabel,
  onAddPlayer,
}: {
  slotLabel: string;
  onAddPlayer?: () => void;
}) {
  return (
    <div className="mb-2">
      <button
        onClick={onAddPlayer}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-line bg-surface-1/40 px-3 py-2.5 text-left hover:border-accent active:border-accent"
      >
        <span className="text-[10px] font-bold text-accent uppercase w-6 flex-shrink-0 text-center">
          {slotLabel}
        </span>
        <Plus className="w-3.5 h-3.5 text-ink-dim" />
        <span className="text-sm font-medium text-ink-dim">Add player</span>
      </button>
    </div>
  );
}
