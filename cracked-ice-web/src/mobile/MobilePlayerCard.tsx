import { useRef } from 'react';
import { MoreVertical } from 'lucide-react';
import type { RosterPlayer } from '../lib/coachSchemas';

/**
 * Get color for ICE score with opacity
 * Green (85+), Yellow (70-84), Orange (55-69), Red (<55)
 */
function getIceScoreColor(score: number, opacity: number): string {
  if (score >= 85) return `rgba(34, 197, 94, ${opacity})`; // Green
  if (score >= 70) return `rgba(234, 179, 8, ${opacity})`; // Yellow
  if (score >= 55) return `rgba(249, 115, 22, ${opacity})`; // Orange
  return `rgba(239, 68, 68, ${opacity})`; // Red
}

interface MobilePlayerCardProps {
  player: RosterPlayer;
  onTap?: () => void;
  onMenu?: () => void;
  showIceScore?: boolean;
  iceScore?: number;
  games?: number;
  starts?: number;
}

/**
 * Mobile Player Card - Compact horizontal layout
 *
 * 64px height optimized for mobile touch targets
 * Layout: [Headshot] [Name + Team] [Stats] [Menu]
 */
export function MobilePlayerCard({
  player,
  onTap,
  onMenu,
  showIceScore = true,
  iceScore,
  games,
  starts
}: MobilePlayerCardProps) {
  // Generate NHL headshot URL
  const getHeadshotUrl = (playerId: string, team: string) => {
    return `https://assets.nhle.com/mugs/nhl/20252026/${team}/${playerId}.png`;
  };

  const headshotUrl = getHeadshotUrl(player.id, player.team);
  const touchedRef = useRef(false);

  const isMenuButton = (target: EventTarget | null): boolean => {
    return !!(target as HTMLElement)?.closest?.('.menu-button');
  };

  const handleClick = (e: React.MouseEvent) => {
    // Skip if this click came from a touch (already handled)
    if (touchedRef.current) {
      touchedRef.current = false;
      return;
    }
    if (isMenuButton(e.target)) return;
    onTap?.();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchedRef.current = true;
    if (isMenuButton(e.target)) return;
    onTap?.();
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (touchedRef.current) {
      touchedRef.current = false;
      return;
    }
    onMenu?.();
  };

  const handleMenuTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchedRef.current = true;
    onMenu?.();
  };

  return (
    <div
      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer"
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: '64px' }}
    >
      {/* Player Headshot */}
      <div className="flex-shrink-0">
        <img
          src={headshotUrl}
          alt={player.full_name}
          className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-player.png';
          }}
        />
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm truncate">
          {player.full_name}
        </div>
        <div className="text-xs text-cyan-400">
          {player.team} • {player.positions?.join(', ') || 'N/A'}
        </div>
      </div>

      {/* Stats Section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* ICE Score Badge */}
        {showIceScore && iceScore !== undefined && (
          <div
            className="flex flex-col items-center px-2 py-1 rounded-lg border"
            style={{
              backgroundColor: getIceScoreColor(iceScore, 0.2),
              borderColor: getIceScoreColor(iceScore, 0.4)
            }}
          >
            <div className="text-[10px] uppercase font-bold" style={{ color: getIceScoreColor(iceScore, 1) }}>
              ICE
            </div>
            <div className="text-sm font-bold text-white">
              {iceScore.toFixed(1)}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {(games !== undefined || starts !== undefined) && (
          <div className="flex flex-col items-end text-[10px] text-slate-400">
            {games !== undefined && <div>G: {games}</div>}
            {starts !== undefined && <div>S: {starts}</div>}
          </div>
        )}
      </div>

      {/* Menu Button */}
      {onMenu && (
        <button
          onClick={handleMenuClick}
          onTouchEnd={handleMenuTouch}
          className="menu-button flex-shrink-0 p-3 -m-1 hover:bg-slate-700 rounded-lg transition-colors active:bg-slate-600"
          aria-label="More options"
        >
          <MoreVertical className="w-5 h-5 text-slate-400" />
        </button>
      )}
    </div>
  );
}

/**
 * Empty Player Card - Placeholder for empty slots
 */
export function MobilePlayerCardEmpty({
  position,
  onTap
}: {
  position: string;
  onTap?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-center p-4 bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 transition-colors cursor-pointer"
      onClick={onTap}
      style={{ minHeight: '64px' }}
    >
      <div className="text-center">
        <div className="text-sm text-slate-500 font-medium">Empty Slot</div>
        <div className="text-xs text-slate-600">{position}</div>
      </div>
    </div>
  );
}
