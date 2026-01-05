import React from 'react';
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
  console.log('[PlayerRow] Compare button check:', {
    hasCallback: !!onCompareWithRoster,
    rosterLength: roster.length,
    willShow: !!onCompareWithRoster
  });

  const positions = Array.isArray(player.pos)
    ? player.pos.join('/')
    : 'N/A';

  // Use backend-provided ICE Score (with SoS adjustment) when available
  // Fall back to frontend calculation for backwards compatibility
  const seasonFppg = player.seasonFppg ?? 0;
  const last30Fppg = player.last30Fppg ?? seasonFppg;
  const last7Fppg = player.last7Fppg ?? seasonFppg;

  const calculatedIce = (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);
  const iceScore = projection?.iceScore ?? calculatedIce;

  // Determine hot/cold streak
  const isHot = last7Fppg > seasonFppg && seasonFppg > 0;
  const isCold = last7Fppg < seasonFppg * 0.8 && seasonFppg > 0;

  // Format SoS (Strength of Schedule) - higher is easier
  const getSosLabel = (sos?: number): { label: string; color: string; icon: string } => {
    if (sos === undefined) return { label: '', color: '', icon: '' };
    if (sos >= 7) return { label: 'Easy Schedule', color: 'text-green-400', icon: '🟢' };
    if (sos <= 3) return { label: 'Tough Schedule', color: 'text-red-400', icon: '🔴' };
    return { label: 'Moderate Schedule', color: 'text-yellow-400', icon: '🟡' };
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
  const iceCircleStyle = getIceCircleStyle(iceScore, 0, 4);

  return (
    <div className="bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-colors border border-white/10">
      {/* HEADER: Logo, Name, ICE Score + FPPG Stats */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Logo + Name + Position */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Player headshot */}
          <img
            src={headshotUrl}
            alt={player.name}
            className="w-8 h-8 rounded-full bg-slate-900/80 object-cover flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Team logo */}
          <img
            src={logoUrl}
            alt={`${player.team} logo`}
            className="w-8 h-8 object-contain flex-shrink-0"
            style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.1))' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`font-bold text-white text-sm leading-tight truncate ${
                  onPlayerClick ? 'cursor-pointer hover:text-cyan-400 transition-colors' : ''
                }`}
                onClick={() => onPlayerClick?.(player)}
              >
                {player.name}
              </h3>
              {player.roleTrend && (
                <RoleTrendBadge trend={player.roleTrend} size="sm" />
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              {player.team} • {positions}
            </p>
          </div>
        </div>

        {/* Center: FPPG Stats */}
        <div className="flex items-center gap-2 text-[10px]">
          <div className="text-center">
            <div className="text-gray-500 uppercase text-[9px]">SEASON</div>
            <div className="text-white font-semibold">{seasonFppg.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 uppercase text-[9px]">LAST30</div>
            <div className="text-white font-semibold">{last30Fppg.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 uppercase text-[9px]">LAST7</div>
            <div className={`font-semibold ${
              isHot ? 'text-green-400' : isCold ? 'text-red-400' : 'text-white'
            }`}>
              {last7Fppg.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Right: ICE Score Badge */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm"
            style={{
              background: iceCircleStyle.backgroundColor,
              border: iceCircleStyle.border,
              boxShadow: iceCircleStyle.boxShadow,
              color: iceCircleStyle.textColor,
            }}
          >
            {iceScore.toFixed(1)}
          </div>
          <span className="text-[8px] text-cyan-400 font-bold">ICE</span>
        </div>
      </div>

      {/* BOTTOM ROW: Streak, Projection Info, Actions */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
        {/* Streak Indicator */}
        <div className="text-[10px] flex-shrink-0">
          {isHot && <span className="text-green-400 font-medium">🔥 Hot</span>}
          {isCold && <span className="text-blue-300 font-medium">🧊 Cold</span>}
          {!isHot && !isCold && seasonFppg > 0 && <span className="text-gray-400">Steady</span>}
        </div>

        {/* Upcoming Games or Projection Info */}
        <div className="flex items-center gap-2 text-[9px] text-gray-400 flex-1 min-w-0">
          {player.upcomingGames && player.upcomingGames.length > 0 ? (
            <div className="flex items-center gap-1 truncate">
              <span className="text-[8px]">📅</span>
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
              <span>📅 {projection.gamesAvailable}G</span>
              <span className="text-cyan-400">{projection.starts}S</span>
              <span className="text-purple-400">SoS: {projection.strengthOfSchedule?.toFixed(1) ?? 'N/A'}</span>
              {projection.offNightRate !== undefined && (
                <span className="text-yellow-400">{(projection.offNightRate * 100).toFixed(0)}% OFF</span>
              )}
            </>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Add Button */}
          {showAddButton && onAddToPlanner && (
            <button
              onClick={() => onAddToPlanner(player)}
              className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-semibold hover:bg-cyan-500/30 transition-colors"
              title="Add to your roster planner"
            >
              + Add to Roster
            </button>
          )}

          {/* Compare Button */}
          {onCompareWithRoster && (
            <button
              onClick={() => {
                console.log('[PlayerRow] Compare button clicked for', player.name);
                onCompareWithRoster(player);
              }}
              className="px-2 py-1 text-slate-400 hover:text-cyan-400 rounded text-sm transition-colors"
              title="Compare players"
            >
              <SwapIcon size={14} />
            </button>
          )}

          {/* Availability Toggle */}
          {onAvailabilityChange && (
            <div
              title={
                availabilityMark
                  ? `Source: ${availabilityMark.source}, Updated: ${new Date(availabilityMark.updatedAt).toLocaleDateString()}`
                  : 'Set player availability'
              }
            >
              <AvailabilityToggle
                value={availabilityStatus}
                onChange={onAvailabilityChange}
                size="sm"
              />
            </div>
          )}

          {/* Watchlist Star */}
          {onToggleWatch && (
            <button
              onClick={onToggleWatch}
              className={`px-2 py-1 rounded text-sm transition-colors ${
                isWatched
                  ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-yellow-400'
              }`}
              title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              ⭐
            </button>
          )}
        </div>
      </div>

      {/* Availability Warning (Compact) */}
      {showAvailabilityWarning && (
        <div className="text-[9px] text-orange-400 mt-1 pt-1 border-t border-white/5">
          ⚠️ Not FA
        </div>
      )}
    </div>
  );
};
