import React from 'react';
import { CalendarDays, ChevronRight, Clock3, Star, Zap } from 'lucide-react';
import type { PlayerSearchResult, AvailabilityStatus, AvailabilityMark } from '../../types';
import type { PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import { AvailabilityToggle } from '../inputs/AvailabilityToggle';
import { SwapIcon } from '../icons/SwapIcon';
import { getTeamLogoUrl, getTeamColor } from '../../lib/teamLogos';
import { getIceCircleStyle } from '../../lib/iceScore';
import { RoleTrendBadge } from '../player/RoleTrendBadge';
import { TooltipLabel } from '../ui/tooltip';
import { mugshotSeason } from '../../lib/season';

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

function formatToi(seconds?: number) {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function formatStatsSeason(season?: string) {
  if (!season || season.length !== 8) return 'Season';
  return `${season.slice(0, 4)}-${season.slice(6)}`;
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-0 px-3 py-2">
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-ink-mute">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${accent ? 'text-accent' : 'text-ink'}`}>{value}</p>
      {detail && <p className="mt-0.5 truncate text-[9px] text-ink-dim">{detail}</p>}
    </div>
  );
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
  onCompareWithRoster,
}) => {
  const positions = player.pos.join('/');
  const isGoalie = player.pos.includes('G');
  // Match every other surface: prefer the projection's league-scored FPPG so search
  // results and the roster/detail views can't disagree about the same player.
  const seasonFppg = projection?.fppg ?? player.seasonFppg ?? player.blendedFppg ?? 0;
  const gamesPlayed = player.games_played ?? 0;
  const recentGameCount = (days: number) => {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return player.gameLog?.filter(game => new Date(game.gameDate).getTime() >= cutoff).length ?? 0;
  };
  const hasLast30Sample = recentGameCount(30) > 0;
  const hasLast7Sample = recentGameCount(7) > 0;
  const last30 = hasLast30Sample ? player.last30Fppg : undefined;
  const last7 = hasLast7Sample ? player.last7Fppg : undefined;
  const iceScore = projection?.iceScore;
  const iceCircleStyle = iceScore === undefined ? null : getIceCircleStyle(iceScore, 0, 10);
  const offNightGames = projection
    ? Math.round(projection.starts * projection.offNightRate)
    : undefined;
  const roleTrend = player.roleTrend;
  const avgToi = player.advancedStats?.avgToiPerGame;
  const ppToi = player.advancedStats?.ppTimeOnIcePerGame;
  const headshotSeason = player.statsSeason ?? mugshotSeason;
  const numericId = player.id.replace(/^nhl:/, '');
  const headshotUrl = `https://assets.nhle.com/mugs/nhl/${headshotSeason}/${player.team}/${numericId}.png`;
  const teamColor = getTeamColor(player.team);
  const showAvailabilityWarning = !['FA', 'WAIVER', 'UNKNOWN'].includes(availabilityStatus);

  return (
    <article
      className="rounded-xl border border-line bg-surface-1 p-3 transition-colors hover:border-accent/60"
      style={{ borderLeftColor: teamColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => onPlayerClick?.(player)}
          aria-label={`View details for ${player.name}`}
        >
          <span className="relative shrink-0">
            <img
              src={headshotUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-12 rounded-full border border-line bg-surface-0 object-cover"
              onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
            />
            <img
              src={getTeamLogoUrl(player.team)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute -bottom-1 -right-1 size-5 object-contain drop-shadow"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="truncate text-sm text-ink transition-colors hover:text-accent">{player.name}</strong>
              {roleTrend && <RoleTrendBadge trend={roleTrend} size="sm" />}
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold text-accent">{player.team} · {positions}</span>
            <span className="mt-1 block text-[10px] text-ink-dim">
              {isGoalie
                ? `${player.stats?.games_started ?? gamesPlayed} starts · ${player.stats?.wins ?? 0} wins`
                : `${player.stats?.goals ?? 0} G · ${player.stats?.assists ?? 0} A · ${player.stats?.points ?? 0} P`}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden="true" />
        </button>

        <div className="flex shrink-0 flex-col items-center">
          <div
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface-0 text-sm font-bold text-ink-dim"
            style={iceCircleStyle ? {
              background: iceCircleStyle.backgroundColor,
              border: iceCircleStyle.border,
              boxShadow: iceCircleStyle.boxShadow,
              color: iceCircleStyle.textColor,
            } : undefined}
          >
            {iceScore === undefined ? '—' : iceScore.toFixed(1)}
          </div>
          <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-accent">ICE</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Metric
          label="League FPPG"
          value={seasonFppg.toFixed(2)}
          detail={`${formatStatsSeason(player.statsSeason)} · ${gamesPlayed} GP`}
          accent
        />
        <Metric
          label={isGoalie ? 'Goalie sample' : 'NHL role'}
          value={isGoalie ? `${player.stats?.games_started ?? gamesPlayed} starts` : formatToi(avgToi)}
          detail={isGoalie
            ? `${((player.stats?.save_percentage ?? 0) * 100).toFixed(1)} SV% · ${(player.stats?.goals_against_average ?? 0).toFixed(2)} GAA`
            : `${formatToi(ppToi)} PP TOI`}
        />
        <Metric
          label="Selected window"
          value={projection ? (isGoalie ? `${projection.starts} projected starts` : `${projection.gamesAvailable} games`) : 'Schedule pending'}
          detail={offNightGames === undefined
            ? 'Choose an analysis window'
            : isGoalie
              ? `${projection?.gamesAvailable ?? 0} team games · ${offNightGames} off-night starts`
              : `${offNightGames} off-night · ${projection?.starts ?? 0} starts`}
        />
        <Metric
          label="Recent form"
          value={last7 === undefined ? 'Season baseline' : `${last7.toFixed(2)} FPPG`}
          detail={last30 === undefined ? 'No current in-season sample' : `Last 30: ${last30.toFixed(2)} FPPG`}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <div className="flex items-center gap-2 text-[10px] text-ink-dim">
          {projection && (
            <>
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3 text-accent" />{isGoalie ? `${projection.starts} starts` : `${projection.gamesAvailable} games`}</span>
              <span className="inline-flex items-center gap-1"><Zap className="size-3 text-positive" />{offNightGames} off-night</span>
            </>
          )}
          {!isGoalie && avgToi && <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{formatToi(avgToi)} TOI</span>}
          {showAvailabilityWarning && <span className="text-warning">Marked owned</span>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1">
          {showAddButton && onAddToPlanner && (
            <button
              type="button"
              onClick={() => onAddToPlanner(player)}
              className="rounded-md bg-accent px-2.5 py-1.5 text-[10px] font-bold text-accent-ink transition-opacity hover:opacity-90"
            >
              + Add to roster
            </button>
          )}
          {onCompareWithRoster && (
            <TooltipLabel label="Compare players">
              <button type="button" onClick={() => onCompareWithRoster(player)} className="rounded-md border border-line p-1.5 text-ink-dim hover:border-accent hover:text-accent">
                <SwapIcon size={14} />
              </button>
            </TooltipLabel>
          )}
          {onToggleWatch && (
            <TooltipLabel label={isWatched ? 'Remove from targets' : 'Add to targets'}>
              <button
                type="button"
                onClick={onToggleWatch}
                className={`rounded-md border p-1.5 ${isWatched ? 'border-warning text-warning' : 'border-line text-ink-dim hover:border-warning hover:text-warning'}`}
              >
                <Star className="size-3.5" fill={isWatched ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            </TooltipLabel>
          )}
          {onAvailabilityChange && (
            <TooltipLabel label={availabilityMark ? `Updated ${new Date(availabilityMark.updatedAt).toLocaleDateString()}` : 'Set league availability'}>
              <div><AvailabilityToggle value={availabilityStatus} onChange={onAvailabilityChange} size="sm" /></div>
            </TooltipLabel>
          )}
        </div>
      </div>
    </article>
  );
};
