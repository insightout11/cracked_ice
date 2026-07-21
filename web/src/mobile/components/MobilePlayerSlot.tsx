import { useState, useRef } from 'react';
import { mugshotSeason } from '../../lib/season';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, Flame, Snowflake, AlertTriangle, Calendar, Rocket, TrendingUp, TrendingDown } from 'lucide-react';
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
  // Normalize score to 0-1 range (typical ICE scores are 0-5)
  const t = Math.min(1, Math.max(0, score / 5));

  // Stronger glow on the ring itself
  const glowSize = 8 + t * 20;        // 8px to 28px
  const glowOpacity = 0.4 + t * 0.6;  // 0.4 to 1.0

  // Cyan color with score-based brightness
  const cyan = `rgba(0, 247, 255, ${0.6 + t * 0.4})`; // 0.6-1.0 opacity

  return {
    boxShadow: `0 0 ${glowSize}px ${cyan}, inset 0 0 4px ${cyan}`,
    border: `2px solid ${cyan}`,
    background: 'rgba(0, 20, 40, 0.9)', // Dark background for contrast
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
        ? 'ring-2 ring-cyan-400 scale-[1.02] border-cyan-400'
        : 'ring-2 ring-cyan-400/50 border-cyan-400/50 animate-pulse'
      : 'opacity-40'
    : '';

  // Empty slot - compact with inline label
  if (!player) {
    return (
      <div ref={setDroppableRef} className="mb-1">
        <button
          onClick={onAddPlayer}
          className={`w-full flex items-center gap-2 py-2 px-2 bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 active:border-cyan-500 transition-all h-[36px] ${emptySlotDragClasses}`}
        >
          <span className="text-[10px] font-bold text-cyan-400 uppercase w-6 flex-shrink-0">
            {slotLabel}
          </span>
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-500 font-medium text-xs">Add Player</span>
        </button>
      </div>
    );
  }

  // Calculate trend
  const seasonFppg = (player as any).seasonFppg ?? projection?.fppg ?? 0;
  const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
  const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;
  const isHot = trendPercent > 10;
  const isCold = trendPercent < -10;

  // Get ICE score and glow styling
  const iceScore = projection?.iceScore ?? 0;
  const iceGlowStyle = getIceGlowStyle(iceScore);

  // Injury check
  const hasInjury = player.injuryStatus && player.injuryStatus !== 'Active';

  // Role trend (for trending up/down icon)
  const roleTrend = player.roleTrend;
  const hasRoleTrend = roleTrend?.meetsThreshold;
  const isRoleIncreased = roleTrend?.type === 'increased';

  // Determine visual state for filled slots during drag
  const filledSlotDragClasses = isCurrentlyDragging
    ? 'opacity-30'
    : isDragging
      ? isValidTarget
        ? isOverDroppable
          ? 'ring-2 ring-cyan-400 scale-[1.02]'
          : 'ring-2 ring-cyan-400/50'
        : 'opacity-40'
      : '';

  return (
    <div ref={setNodeRef} className="mb-1 relative">
      {/* Swipe Background - only visible when actively swiping */}
      {swipeX < -10 && !isCurrentlyDragging && (
        <div className="absolute inset-0 flex items-center justify-end bg-red-500/20 rounded-lg">
          <span className="text-red-400 font-semibold text-xs mr-3">Remove</span>
        </div>
      )}

      {/* Player Card - Compact Two-Row Layout */}
      <div
        className={`relative bg-slate-800/80 rounded-lg border border-slate-700 overflow-hidden transition-all ${filledSlotDragClasses}`}
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
          className="w-full py-1.5 px-2 text-left active:bg-slate-700/50"
        >
          <div className="flex items-center gap-2">
            {/* Slot Label - Inline Left */}
            <span className="text-[10px] font-bold text-cyan-400 uppercase w-6 flex-shrink-0 text-center">
              {slotLabel}
            </span>

            {/* Headshot + Team Logo Side by Side */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <img
                src={getHeadshotUrl(player.id, player.team)}
                alt={player.full_name}
                className="w-8 h-8 rounded-full bg-slate-700 object-cover border border-slate-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-player.png';
                }}
              />
              <img
                src={getTeamLogoUrl(player.team)}
                alt={player.team}
                className="w-5 h-5 rounded-full bg-slate-900 border border-slate-600 p-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* Player Info - Two Rows */}
            <div className="flex-1 min-w-0">
              {/* Row 1: Name + Injury */}
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-white truncate">
                  {player.full_name}
                </span>
                {hasInjury && (
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                )}
              </div>
              {/* Row 2: Team, Position, Stats, Trend, Role */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span>{player.team} • {player.positions?.slice(0, 2).join(',') || 'N/A'}</span>
                <span className="flex items-center gap-0.5 text-slate-400">
                  <Calendar className="w-2.5 h-2.5" />
                  {projection?.gamesAvailable || 0}
                </span>
                <span className="flex items-center gap-0.5 text-cyan-400">
                  <Rocket className="w-2.5 h-2.5" />
                  {projection?.starts || 0}
                </span>
                {(isHot || isCold) && (
                  <span className={`flex items-center gap-0.5 ${isHot ? 'text-orange-400' : 'text-blue-400'}`}>
                    {isHot ? <Flame className="w-2.5 h-2.5" /> : <Snowflake className="w-2.5 h-2.5" />}
                    {isHot ? '+' : ''}{trendPercent}%
                  </span>
                )}
                {hasRoleTrend && (
                  <span className={`flex items-center ${isRoleIncreased ? 'text-green-400' : 'text-red-400'}`}>
                    {isRoleIncreased ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  </span>
                )}
              </div>
            </div>

            {/* ICE Score Circle - Glowing */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={iceGlowStyle}
            >
              <span className="text-[10px] font-bold text-white">{iceScore.toFixed(1)}</span>
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
    <div className="mb-1">
      <button
        onClick={onAddPlayer}
        className="w-full flex items-center gap-2 py-2 px-2 bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 active:border-cyan-500 transition-colors h-[36px]"
      >
        <span className="text-[10px] font-bold text-cyan-400 uppercase w-6 flex-shrink-0 text-center">
          {slotLabel}
        </span>
        <Plus className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-500 font-medium text-xs">Add Player</span>
      </button>
    </div>
  );
}
