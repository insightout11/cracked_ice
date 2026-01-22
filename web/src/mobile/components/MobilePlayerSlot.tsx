import { useState, useRef } from 'react';
import { MoreVertical, Plus, Flame, Snowflake, AlertTriangle } from 'lucide-react';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobilePlayerSlotProps {
  slotId: string;
  slotLabel: string;
  player: RosterPlayer | null;
  projection?: PlayerProjection;
  onTap?: () => void;
  onMenuTap?: () => void;
  onAddPlayer?: () => void;
  onSwipeRemove?: () => void;
}

/**
 * Get ICE score glow style based on value
 * Higher scores = brighter cyan glow (matching desktop algorithm)
 */
function getIceGlowStyle(score: number): React.CSSProperties {
  // Normalize score to 0-1 range (typical ICE scores are 0-5)
  const t = Math.min(1, Math.max(0, score / 5));

  // Glow intensity increases with score
  const glowSize = 6 + t * 16;        // 6px to 22px
  const glowOpacity = 0.2 + t * 0.6;  // 0.2 to 0.8

  return {
    boxShadow: `0 0 ${glowSize}px rgba(0, 247, 255, ${glowOpacity})`,
    background: `rgba(6, 182, 212, ${0.1 + t * 0.15})`, // cyan-500 with varying opacity
    borderColor: `rgba(34, 211, 238, ${0.3 + t * 0.4})`, // cyan-400 border
  };
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/20252026/${team}/${numericId}.png`;
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
  onMenuTap,
  onAddPlayer,
  onSwipeRemove,
}: MobilePlayerSlotProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_THRESHOLD = 100;

  // Handle touch events for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || !isSwiping) return;

    const deltaX = e.touches[0].clientX - touchStart.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStart.current.y);

    // Only swipe if horizontal movement > vertical
    if (deltaY > 30) {
      setIsSwiping(false);
      setSwipeX(0);
      return;
    }

    // Only allow swipe left (negative)
    if (deltaX < 0) {
      setSwipeX(Math.max(deltaX, -150));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX < -SWIPE_THRESHOLD && onSwipeRemove) {
      onSwipeRemove();
    }
    setSwipeX(0);
    setIsSwiping(false);
    touchStart.current = null;
  };

  // Empty slot
  if (!player) {
    return (
      <div className="mb-2">
        <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-0.5 px-1">
          {slotLabel}
        </div>
        <button
          onClick={onAddPlayer}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-600 hover:border-cyan-500/50 active:border-cyan-500 transition-colors min-h-[48px]"
        >
          <Plus className="w-4 h-4 text-slate-500" />
          <span className="text-slate-500 font-medium text-sm">Add Player</span>
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

  return (
    <div className="mb-2 relative">
      {/* Slot Label */}
      <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-0.5 px-1">
        {slotLabel}
      </div>

      {/* Swipe Background */}
      <div className="absolute inset-0 top-5 flex items-center justify-end bg-red-500/20 rounded-xl">
        <span className="text-red-400 font-semibold mr-4">Remove</span>
      </div>

      {/* Player Card */}
      <div
        className="relative bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={onTap}
          className="w-full flex items-center gap-2 p-2 text-left active:bg-slate-700/50"
        >
          {/* Headshot */}
          <div className="relative flex-shrink-0">
            <img
              src={getHeadshotUrl(player.id, player.team)}
              alt={player.full_name}
              className="w-10 h-10 rounded-full bg-slate-700 object-cover border-2 border-slate-600"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-player.png';
              }}
            />
            {/* Team Logo Overlay */}
            <img
              src={getTeamLogoUrl(player.team)}
              alt={player.team}
              className="absolute -bottom-2 -right-3 w-8 h-8 rounded-full bg-slate-900 border border-slate-600 p-0.5"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">
                {player.full_name}
              </span>
              {hasInjury && (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
            </div>
            <div className="text-sm text-slate-400">
              {player.team} • {player.positions?.join(', ') || 'N/A'}
            </div>
            {/* Stats Row */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                G:{projection?.gamesAvailable || 0} S:{projection?.starts || 0}
              </span>
              {(isHot || isCold) && (
                <span className={`text-xs flex items-center gap-0.5 ${isHot ? 'text-orange-400' : 'text-blue-400'}`}>
                  {isHot ? <Flame className="w-3 h-3" /> : <Snowflake className="w-3 h-3" />}
                  {isHot ? '+' : ''}{trendPercent}%
                </span>
              )}
            </div>
          </div>

          {/* ICE Score Badge with Cyan Glow */}
          <div
            className="flex flex-col items-center px-2 py-1 rounded-lg border"
            style={iceGlowStyle}
          >
            <span className="text-[10px] font-bold uppercase text-cyan-400">ICE</span>
            <span className="text-base font-bold text-white">{iceScore.toFixed(1)}</span>
          </div>
        </button>

        {/* Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMenuTap?.();
          }}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-700 active:bg-slate-600 transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

/**
 * MobilePlayerSlotEmpty - Simplified empty slot variant
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
      <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-0.5 px-1">
        {slotLabel}
      </div>
      <button
        onClick={onAddPlayer}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-600 hover:border-cyan-500/50 active:border-cyan-500 transition-colors min-h-[48px]"
      >
        <Plus className="w-4 h-4 text-slate-500" />
        <span className="text-slate-500 font-medium text-sm">Add Player</span>
      </button>
    </div>
  );
}
