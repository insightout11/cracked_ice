import { TooltipLabel } from '../ui/tooltip';
import React from 'react';
import { Star } from 'lucide-react';
import type { PlayerSearchResult } from '../../types';
import type { PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import type { AvailabilityStatus, AvailabilityMark } from '../../types';
import { AvailabilityToggle } from '../inputs/AvailabilityToggle';
import { SwapIcon } from '../icons/SwapIcon';
import { getTeamLogoUrl, getTeamColor } from '../../lib/teamLogos';
import { getIceCircleStyle } from '../../lib/iceScore';
import { RoleTrendBadge } from '../player/RoleTrendBadge';

interface PlayerRowProps {
  player: PlayerSearchResult;
  projection?: PlayerProjection;
  availabilityStatus?: AvailabilityStatus;
  availabilityMark?: AvailabilityMark | null;
  isWatched?: boolean;
  onAddToPlanner?: (player: PlayerSearchResult) => void;
  onAvailabilityChange?: (status: AvailabilityStatus) => void;
  onToggleWatch?: () => void;
  onPlayerClick?: (player: PlayerSearchResult) => void;
  showAddButton?: boolean;
  compact?: boolean;
  onCompareWithRoster?: (freeAgent: PlayerSearchResult) => void;
  roster?: RosterPlayer[];
}

export const PlayerRow: React.FC<PlayerRowProps> = ({
  player,
  projection,
  availabilityStatus = 'UNKNOWN',
  availabilityMark,
  isWatched = false,
  onAddToPlanner,
  onAvailabilityChange,
  onToggleWatch,
  onPlayerClick,
  showAddButton = true,
  compact = false,
  onCompareWithRoster,
  roster = [],
}) => {

  const positions = Array.isArray(player.pos)
    ? player.pos.join('/')
    : 'N/A';

  const seasonFppg = player.seasonFppg ?? 0;
  const last30Fppg = player.last30Fppg ?? 0;
  const last7Fppg = player.last7Fppg ?? 0;
  const recentGameCount = (days: number) => {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return player.gameLog?.filter(game => new Date(game.gameDate).getTime() >= cutoff).length ?? 0;
  };
  const hasLast30Sample = last30Fppg > 0 || recentGameCount(30) > 0;
  const hasLast7Sample = last7Fppg > 0 || recentGameCount(7) > 0;

  // Search and roster cards must use the same personalized server rating.
  // A legacy FPPG blend is not an ICE rating, so remain neutral while loading.
  const iceScore = projection?.iceScore;

  // Determine hot/cold streak
  const isHot = hasLast7Sample && last7Fppg > seasonFppg && seasonFppg > 0;
  const isCold = hasLast7Sample && last7Fppg < seasonFppg * 0.8 && seasonFppg > 0;

  // Format SoS (Strength of Schedule) - higher is easier
  const getSosLabel = (sos?: number): { label: string; color: string; icon: string } => {
    if (sos === undefined) return { label: '', color: '', icon: '' };
 if (sos >= 7) return { label: 'Easy Schedule', color: 'text-positive', icon: '' };
 if (sos <= 3) return { label: 'Tough Schedule', color: 'text-negative', icon: '' };
 return { label: 'Moderate Schedule', color: 'text-warning', icon: '' };
  };

  const sosInfo = getSosLabel(projection?.strengthOfSchedule);

  // Show availability warning if not FA/WAIVER
  const showAvailabilityWarning = availabilityStatus !== 'FA' && availabilityStatus !== 'WAIVER' && availabilityStatus !== 'UNKNOWN';

  const teamColor = getTeamColor(player.team);
  const logoUrl = getTeamLogoUrl(player.team);

  // Generate NHL headshot URL
  const getHeadshotUrl = (playerId: string, team: string) => {
    const numericId = playerId.replace(/^nhl:/, '');
    return `https://assets.nhle.com/mugs/nhl/20242025/${team}/${numericId}.png`;
  };
  const headshotUrl = getHeadshotUrl(player.id, player.team);

  // Get ICE circle style (cyan glacial style)
  const iceCircleStyle = iceScore === undefined ? null : getIceCircleStyle(iceScore, 0, 10);

  return (
    <div className="bg-surface-1/5 rounded-lg p-2 hover:bg-surface-1/10 transition-colors border border-line">
      {/* HEADER: Logo, Name, ICE Score + FPPG Stats */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Logo + Name + Position */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Player headshot */}
          <img
            src={headshotUrl}
            alt={player.name}
            className="w-8 h-8 rounded-full bg-surface-2 object-cover flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Team logo */}
          <img
            src={logoUrl}
            alt={`${player.team} logo`}
            className='w-8 h-8 object-contain flex-shrink-0 [filter:drop-shadow(0_0_2px_var(--line))]' />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`font-bold text-ink text-sm leading-tight truncate ${
                  onPlayerClick ? 'cursor-pointer hover:text-accent transition-colors' : ''
                }`}
                onClick={() => onPlayerClick?.(player)}
              >
                {player.name}
              </h3>
              {player.roleTrend && (
                <RoleTrendBadge trend={player.roleTrend} size="sm" />
              )}
            </div>
            <p className="text-[10px] text-ink-dim">
              {player.team} • {positions}
            </p>
          </div>
        </div>

        {/* Center: FPPG Stats */}
        <div className="flex items-center gap-2 text-[10px]">
          <div className="text-center">
            <div className="text-ink-mute uppercase text-[9px]">SEASON</div>
            <div className="text-ink font-semibold">{seasonFppg.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-ink-mute uppercase text-[9px]">LAST30</div>
            <div className="text-ink font-semibold">{hasLast30Sample ? last30Fppg.toFixed(1) : '—'}</div>
          </div>
          <div className="text-center">
            <div className="text-ink-mute uppercase text-[9px]">LAST7</div>
            <div className={`font-semibold ${
              isHot ? 'text-positive' : isCold ? 'text-negative' : 'text-ink'
            }`}>
              {hasLast7Sample ? last7Fppg.toFixed(1) : '—'}
            </div>
          </div>
        </div>

        {/* Right: ICE Score Badge */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm"
            style={iceCircleStyle ? {
              background: iceCircleStyle.backgroundColor,
              border: iceCircleStyle.border,
              boxShadow: iceCircleStyle.boxShadow,
              color: iceCircleStyle.textColor,
            } : undefined}
          >
            {iceScore === undefined ? '—' : iceScore.toFixed(1)}
          </div>
          <span className="text-[8px] text-accent font-bold">ICE</span>
        </div>
      </div>
      {/* BOTTOM ROW: Streak, Projection Info, Actions */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-line">
        {/* Streak Indicator */}
        <div className="text-[10px] flex-shrink-0">
 {isHot && <span className="text-positive font-medium"> Hot</span>}
 {isCold && <span className="text-accent font-medium"> Cold</span>}
          {!isHot && !isCold && seasonFppg > 0 && <span className="text-ink-dim">Steady</span>}
        </div>

        {/* Upcoming Games or Projection Info */}
        <div className="flex items-center gap-2 text-[9px] text-ink-dim flex-1 min-w-0">
          {player.upcomingGames && player.upcomingGames.length > 0 ? (
            <div className="flex items-center gap-1 truncate">
 <span className="truncate">
                {player.upcomingGames.slice(0, 3).map(date => {
                  const month = date.substring(5, 7);
                  const day = date.substring(8, 10);
                  return `${month}/${day}`;
                }).join(', ')}
                {player.upcomingGames.length > 3 && ` +${player.upcomingGames.length - 3}`}
              </span>
            </div>
          ) : projection ? (
            <>
 <span> {projection.gamesAvailable}G</span>
              <span className="text-accent">{projection.starts}S</span>
              <span className="text-accent">SoS: {projection.strengthOfSchedule?.toFixed(1) ?? 'N/A'}</span>
              {projection.offNightRate !== undefined && (
                <span className="text-warning">{(projection.offNightRate * 100).toFixed(0)}% OFF</span>
              )}
            </>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Add Button */}
          {showAddButton && onAddToPlanner && (
            <TooltipLabel label='Add to your roster planner'><button
                onClick={() => onAddToPlanner(player)}
                className="px-2 py-1 bg-accent-muted text-accent rounded text-[10px] font-semibold hover:bg-accent-muted transition-colors">+ Add to Roster
                            </button></TooltipLabel>
          )}

          {/* Compare Button */}
          {onCompareWithRoster && (
            <TooltipLabel label='Compare players'><button
                onClick={() => {
                  onCompareWithRoster(player);
                }}
                className="px-2 py-1 text-ink-dim hover:text-accent rounded text-sm transition-colors">
                <SwapIcon size={14} />
              </button></TooltipLabel>
          )}

          {/* Availability Toggle */}
          {onAvailabilityChange && (
            <TooltipLabel
              label={availabilityMark
                ? `Source: ${availabilityMark.source}, Updated: ${new Date(availabilityMark.updatedAt).toLocaleDateString()}`
                : 'Set player availability'}><div>
                <AvailabilityToggle
                  value={availabilityStatus}
                  onChange={onAvailabilityChange}
                  size="sm"
                />
              </div></TooltipLabel>
          )}

          {/* Watchlist Star */}
          {onToggleWatch && (
            <TooltipLabel label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}><button
                onClick={onToggleWatch}
                className={`px-2 py-1 rounded text-sm transition-colors ${
                  isWatched
                    ? 'bg-warning-muted text-warning hover:bg-warning-muted'
                    : 'bg-surface-1/10 text-ink-dim hover:bg-surface-1/20 hover:text-warning'
                }`}>
                <Star size={16} fill={isWatched ? 'currentColor' : 'none'} aria-hidden="true" />
              </button></TooltipLabel>
          )}
        </div>
      </div>
      {/* Availability Warning (Compact) */}
      {showAvailabilityWarning && (
        <div className="text-[9px] text-warning mt-1 pt-1 border-t border-line">
 Not FA
        </div>
      )}
    </div>
  );
};
