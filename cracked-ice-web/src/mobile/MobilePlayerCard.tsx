import { MoreVertical } from 'lucide-react';
import type { RosterPlayer } from '../lib/coachSchemas';

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

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click from bubbling if clicking menu button
    if ((e.target as HTMLElement).closest('.menu-button')) {
      return;
    }
    onTap?.();
  };

  return (
    <div
      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer"
      onClick={handleClick}
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
          <div className="flex flex-col items-center px-2 py-1 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/30">
            <div className="text-[10px] text-cyan-300 uppercase font-bold">ICE</div>
            <div className="text-sm font-bold text-white">
              {iceScore.toFixed(0)}
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
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
          className="menu-button flex-shrink-0 p-2 hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4 text-slate-400" />
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
