import { Plus, Star, StarOff, Check } from 'lucide-react';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobilePlayerRowProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  isOnRoster?: boolean;
  isWatched?: boolean;
  availability?: 'fa' | 'owned' | 'waivers';
  onTap?: () => void;
  onAdd?: () => void;
  onToggleWatch?: () => void;
}

/**
 * Get ICE score color based on value
 */
function getIceScoreColor(score: number): string {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 55) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/20252026/${team}/${numericId}.png`;
}

/**
 * Get availability badge styling
 */
function getAvailabilityBadge(availability?: string): { bg: string; text: string; label: string } {
  switch (availability) {
    case 'fa':
      return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'FA' };
    case 'owned':
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Owned' };
    case 'waivers':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Waivers' };
    default:
      return { bg: 'bg-slate-700', text: 'text-slate-400', label: '—' };
  }
}

/**
 * MobilePlayerRow - Compact player display for list views
 *
 * Used in:
 * - Player search results
 * - Watchlist
 * - Free agent browser
 *
 * Features:
 * - Compact horizontal layout
 * - Headshot, name, team, positions
 * - ICE score badge
 * - Key stats (G, A, PPP)
 * - Availability status
 * - Add/Watch buttons
 */
export function MobilePlayerRow({
  player,
  projection,
  isOnRoster = false,
  isWatched = false,
  availability,
  onTap,
  onAdd,
  onToggleWatch,
}: MobilePlayerRowProps) {
  const iceScore = projection?.iceScore ?? 0;
  const availBadge = getAvailabilityBadge(availability);

  // Handle different field names between roster players and search results
  const playerName = player.full_name || (player as any).name || 'Unknown';
  const playerTeam = player.team || '';
  const playerPositions = player.positions || [(player as any).position].filter(Boolean);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden mb-3">
      <div className="flex items-center gap-3 p-3">
        {/* Tap area for player details */}
        <button
          onClick={onTap}
          className="flex-1 flex items-center gap-3 text-left active:opacity-80"
        >
          {/* Headshot */}
          <div className="relative flex-shrink-0">
            <img
              src={getHeadshotUrl(player.id, playerTeam)}
              alt={playerName}
              className="w-12 h-12 rounded-full bg-slate-700 object-cover border-2 border-slate-600"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-player.png';
              }}
            />
            {/* Team logo */}
            {playerTeam && (
              <img
                src={getTeamLogoUrl(playerTeam)}
                alt={playerTeam}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-600 p-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate text-sm">
                {playerName}
              </span>
              {/* ICE Score */}
              <span className={`text-sm font-bold ${getIceScoreColor(iceScore)}`}>
                {iceScore.toFixed(1)}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {playerTeam} • {playerPositions.join(', ') || 'N/A'}
            </div>
            {/* Stats Row */}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-slate-500">
                G:{player.stats?.goals ?? 0} A:{player.stats?.assists ?? 0} PPP:{player.stats?.power_play_points ?? 0}
              </span>
              {/* Availability Badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${availBadge.bg} ${availBadge.text}`}>
                {availBadge.label}
              </span>
            </div>
          </div>
        </button>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Watch Button */}
          {onToggleWatch && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatch();
              }}
              className={`p-2 rounded-lg transition-colors ${
                isWatched
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'hover:bg-slate-700 text-slate-400'
              }`}
              aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {isWatched ? (
                <Star className="w-5 h-5 fill-current" />
              ) : (
                <StarOff className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Add Button */}
          {onAdd && !isOnRoster && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white transition-colors"
              aria-label="Add to roster"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}

          {/* On Roster Indicator */}
          {isOnRoster && (
            <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
              <Check className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * MobilePlayerRowSkeleton - Loading placeholder
 */
export function MobilePlayerRowSkeleton() {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden mb-3 animate-pulse">
      <div className="flex items-center gap-3 p-3">
        <div className="w-12 h-12 rounded-full bg-slate-700" />
        <div className="flex-1">
          <div className="h-4 bg-slate-700 rounded w-32 mb-2" />
          <div className="h-3 bg-slate-700 rounded w-20 mb-2" />
          <div className="h-2 bg-slate-700 rounded w-40" />
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-700" />
      </div>
    </div>
  );
}
