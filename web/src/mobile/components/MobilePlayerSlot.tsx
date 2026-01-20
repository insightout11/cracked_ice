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
 * Get ICE score color based on value
 */
function getIceScoreColor(score: number): { bg: string; border: string; text: string } {
  if (score >= 85) return { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-400' };
  if (score >= 70) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' };
  if (score >= 55) return { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' };
  return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' };
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
      <div className="mb-3">
        <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-1 px-1">
          {slotLabel}
        </div>
        <button
          onClick={onAddPlayer}
          className="w-full flex items-center justify-center gap-2 p-4 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-600 hover:border-cyan-500/50 active:border-cyan-500 transition-colors min-h-[80px]"
        >
          <Plus className="w-5 h-5 text-slate-500" />
          <span className="text-slate-500 font-medium">Add Player</span>
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

  // Get ICE score
  const iceScore = projection?.iceScore ?? 0;
  const iceColors = getIceScoreColor(iceScore);

  // Injury check
  const hasInjury = player.injuryStatus && player.injuryStatus !== 'Active';

  return (
    <div className="mb-3 relative">
      {/* Slot Label */}
      <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-1 px-1">
        {slotLabel}
      </div>

      {/* Swipe Background */}
      <div className="absolute inset-0 top-6 flex items-center justify-end bg-red-500/20 rounded-xl">
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
          className="w-full flex items-center gap-3 p-3 text-left active:bg-slate-700/50"
        >
          {/* Headshot */}
          <div className="relative flex-shrink-0">
            <img
              src={getHeadshotUrl(player.id, player.team)}
              alt={player.full_name}
              className="w-14 h-14 rounded-full bg-slate-700 object-cover border-2 border-slate-600"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-player.png';
              }}
            />
            {/* Team Logo Overlay */}
            <img
              src={getTeamLogoUrl(player.team)}
              alt={player.team}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-600 p-0.5"
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

          {/* ICE Score Badge */}
          <div className={`flex flex-col items-center px-2 py-1 rounded-lg border ${iceColors.bg} ${iceColors.border}`}>
            <span className={`text-[10px] font-bold uppercase ${iceColors.text}`}>ICE</span>
            <span className="text-lg font-bold text-white">{iceScore.toFixed(1)}</span>
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
    <div className="mb-3">
      <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-1 px-1">
        {slotLabel}
      </div>
      <button
        onClick={onAddPlayer}
        className="w-full flex items-center justify-center gap-2 p-4 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-600 hover:border-cyan-500/50 active:border-cyan-500 transition-colors min-h-[80px]"
      >
        <Plus className="w-5 h-5 text-slate-500" />
        <span className="text-slate-500 font-medium">Add Player</span>
      </button>
    </div>
  );
}
