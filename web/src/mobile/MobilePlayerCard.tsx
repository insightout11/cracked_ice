import { MoreVertical } from 'lucide-react';
import { mugshotSeason } from '../lib/season';
import type { RosterPlayer } from '../lib/coachSchemas';

/**
 * Get color for ICE score with opacity
 * Green (85+), Yellow (70-84), Orange (55-69), Red (<55)
 */
function getIceScoreColor(score: number, opacity: number): string {
  if (score >= 85) return `var(--positive)`; // Green
  if (score >= 70) return `var(--warning)`; // Yellow
  if (score >= 55) return `var(--negative)`; // Orange
  return `var(--negative)`; // Red
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
    return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${playerId}.png`;
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
      className='flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-line hover:border-accent transition-colors cursor-pointer min-h-[64px]'
      onClick={handleClick}>
      {/* Player Headshot */}
      <div className="flex-shrink-0">
        <img
          src={headshotUrl}
          alt={player.full_name}
          className="w-10 h-10 rounded-full object-cover border-2 border-line"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-player.png';
          }}
        />
      </div>
      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink text-sm truncate">
          {player.full_name}
        </div>
        <div className="text-xs text-accent">
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
            <div className="text-sm font-bold text-ink">
              {iceScore.toFixed(1)}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {(games !== undefined || starts !== undefined) && (
          <div className="flex flex-col items-end text-[10px] text-ink-dim">
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
          className="menu-button flex-shrink-0 p-2 hover:bg-surface-2 rounded-lg transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4 text-ink-dim" />
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
      className='flex items-center justify-center p-4 bg-surface-2 rounded-lg border-2 border-dashed border-line hover:border-accent transition-colors cursor-pointer min-h-[64px]'
      onClick={onTap}>
      <div className="text-center">
        <div className="text-sm text-ink-dim font-medium">Empty Slot</div>
        <div className="text-xs text-ink-dim">{position}</div>
      </div>
    </div>
  );
}
