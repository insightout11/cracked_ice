import React, { useState } from 'react';
import { ArrowLeftRight, Calendar, Clock3, Edit2, Moon, Rocket, ShieldCheck, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { SwapIcon } from './icons/SwapIcon';
import type { RosterPlayer, PlayerProjection } from '../lib/coachSchemas';
import type { LeagueWorkspace, LeagueWorkspaceRosterEntry } from '../lib/leagueWorkspace';
import { getTeamLogoUrl, getTeamColor } from '../lib/teamLogos';
import type { TeamTierData } from '../types/teamTiers';
import { TeamColorDisplay } from './TeamTier/TeamColorDisplay';
import { getIceCircleStyle, shouldPulse, ICE_RATING_MIN, ICE_RATING_MAX } from '../lib/iceScore';
import { buildFallbackIceRating } from '../lib/iceRating';
import { getLeagueFppg } from '../lib/playerProjection';
import { mugshotSeason } from '../lib/season';
import { PlayerPositionEditModal } from './PlayerPositionEditModal';
import { InjuryBadge } from './player/InjuryBadge';
import { PuckRating } from './player/PuckRating';
import { apiService } from '../services/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export interface IceScoreRange {
  min: number;
  max: number;
  allScores: number[];
}

interface PlayerChipProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  isLoading?: boolean;
  onCompare?: () => void;
  onDetails?: () => void;
  onRemove?: () => void;
  isDragging?: boolean;
  teamTier?: TeamTierData;
  iceScoreRange?: IceScoreRange;
  variant?: 'full' | 'compact';
  isSelectedForComparison?: boolean;
  onCompareWithFreeAgents?: () => void;
  keeperEntry?: LeagueWorkspaceRosterEntry;
  keeperRules?: LeagueWorkspace['keeperRules'];
  onToggleKeeper?: () => void;
  onKeeperCostChange?: (cost: LeagueWorkspaceRosterEntry['keeperCost']) => void;
  onCompareKeeper?: () => void;
}

const formatToi = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

/** Team hex to rgba, for the team-light wash across the card. */
const teamRgba = (hex: string | undefined, alpha: number) => {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return `rgba(99, 230, 255, ${alpha})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** Section rule carrying the brand fracture: a hairline with one break in it. */
const CrackRule: React.FC<{ className?: string; bias?: number }> = ({ className = '', bias = 0.55 }) => (
  <div className={`flex items-center ${className}`} aria-hidden="true">
    <span className="h-px flex-1 bg-line" />
    <svg width="48" height="16" viewBox="0 0 48 16" fill="none" className="-my-2 flex-shrink-0">
      <path d="M0 8 H14 L20 3.5 L26 12.5 L32 8 H48" stroke="var(--line)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M14 8 L20 3.5 L26 12.5 L32 8" stroke="var(--accent)" strokeWidth="1.2" strokeOpacity="0.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <span className="h-px bg-line" style={{ flex: `${bias} 1 0%` }} />
  </div>
);

interface RoleMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  recentValue?: string;
  change?: number;
  changeSuffix?: string;
  /** 0-1. Renders a fill bar under the value, for share-style metrics. */
  meter?: number;
}

const RoleMetric: React.FC<RoleMetricProps> = ({
  icon,
  label,
  value,
  recentValue,
  change,
  changeSuffix = '%',
  meter,
}) => (
  <div className="min-w-0 rounded-lg bg-surface-0 px-2.5 py-2">
    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-ink-mute">
      <span className="text-accent">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-base font-bold tabular-nums text-ink">{value}</span>
      {recentValue && <span className="text-[10px] text-ink-dim">now {recentValue}</span>}
    </div>
    {meter !== undefined && Number.isFinite(meter) && (
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2fd3c9] to-accent"
          style={{ width: `${Math.min(Math.max(meter, 0), 1) * 100}%` }}
        />
      </div>
    )}
    {change !== undefined && Number.isFinite(change) && (
      <div
        className={`mt-0.5 text-[10px] font-semibold ${
          change > 0 ? 'text-positive' : change < 0 ? 'text-negative' : 'text-ink-mute'
        }`}
      >
        {change > 0 ? '+' : ''}{change.toFixed(1)}{changeSuffix}
      </div>
    )}
  </div>
);

interface LineupMetricProps {
  icon?: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
  warning?: boolean;
}

const LineupMetric: React.FC<LineupMetricProps> = ({ icon, value, label, accent, warning }) => (
  <div className="flex items-center gap-1.5 text-ink-dim">
    {icon && <span className={accent ? 'text-accent' : 'text-ink-mute'}>{icon}</span>}
    <span className={`font-bold ${warning ? 'text-warning' : accent ? 'text-accent' : 'text-ink'}`}>
      {value}
    </span>
    <span>{label}</span>
  </div>
);

export const PlayerChip: React.FC<PlayerChipProps> = ({
  player,
  projection,
  isLoading,
  onCompare,
  onDetails,
  onRemove,
  isDragging,
  teamTier,
  iceScoreRange,
  variant = 'full',
  isSelectedForComparison,
  onCompareWithFreeAgents,
  keeperEntry,
  keeperRules,
  onToggleKeeper,
  onKeeperCostChange,
  onCompareKeeper,
}) => {
  const [isEditPositionOpen, setIsEditPositionOpen] = useState(false);
  const positions = Array.isArray(player.positions) ? player.positions.join('/') : 'N/A';
  const teamColor = getTeamColor(player.team);
  const teamLogo = getTeamLogoUrl(player.team);
  const numericId = player.id.replace(/^nhl:/, '');
  const headshotUrl = `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${player.team}/${numericId}.png`;

  // Projection FPPG is recalculated from the currently saved league scoring.
  // The hydrated player split may predate an in-session settings change.
  const seasonFppg = getLeagueFppg(player, projection);
  const last30Fppg = player.last30Fppg ?? null;
  const last7Fppg = player.last7Fppg ?? null;
  const isGoalie = Array.isArray(player.positions) && player.positions.includes('G');
  // Guard on the client too: a cached payload from before the server-side fix can
  // still carry a skater role trend for a goalie, which renders a bogus PP share.
  const roleTrend = isGoalie ? undefined : player.roleTrend;
  const goalieStats = player.stats as Record<string, number | undefined> | undefined;
  const goalieStarts = isGoalie ? goalieStats?.games_started ?? player.games_played : undefined;
  const goalieGamesPlayed = player.games_played ?? 0;
  const savePct = isGoalie ? goalieStats?.save_percentage : undefined;
  const gaa = isGoalie ? goalieStats?.goals_against_average : undefined;
  const countRecentGames = (days: number) => {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return player.gameLog?.filter((game) => {
      const timestamp = new Date(game.gameDate).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    }).length ?? 0;
  };
  const hasLast30Sample = last30Fppg !== null && (last30Fppg > 0 || countRecentGames(30) > 0);
  const hasLast7ProductionSample = last7Fppg !== null
    && (last7Fppg > 0 || (roleTrend?.last7Games ?? countRecentGames(7)) > 0);
  // ICE rating is always the 0-10 blend. Without a projection we fall back to the
  // shared builder rather than raw weighted FPPG, which is a different unit entirely.
  const iceScore = projection?.iceScore ?? buildFallbackIceRating(player, projection).total;
  const iceCircleStyle = getIceCircleStyle(iceScore, ICE_RATING_MIN, ICE_RATING_MAX);
  const isPulseEnabled = shouldPulse(iceScore, ICE_RATING_MIN, ICE_RATING_MAX);

  const seasonToi = roleTrend?.season.avgToi ?? player.advancedStats?.avgToiPerGame;
  const seasonPpToi = roleTrend?.season.avgPpToi ?? player.advancedStats?.ppTimeOnIcePerGame;
  const last7Games = roleTrend?.last7Games;
  const hasRecentRoleSample = Boolean(roleTrend && roleTrend.last7Games > 0);
  const hasSignificantRoleTrend = Boolean(roleTrend?.meetsThreshold && hasRecentRoleSample);
  const isRoleRising = roleTrend?.type === 'increased';
  const iceRatingDescription = projection?.iceScore !== undefined
    ? 'ICE rating blends 50% season, 30% last-30 and 20% last-7 FPPG, then adjusts up to 15% for schedule difficulty. Missing recent samples use season FPPG.'
    : 'ICE rating fallback blends 50% season, 30% last-30 and 20% last-7 FPPG. Missing recent samples use season FPPG; schedule adjustment is unavailable.';
  const hasScheduledGames = Boolean(projection && projection.gamesAvailable > 0);
  const offNightStarts = hasScheduledGames
    ? Math.round((projection?.offNightRate ?? 0) * (projection?.gamesAvailable ?? 0))
    : 0;
  const lineupConflicts = hasScheduledGames
    ? Math.max((projection?.gamesAvailable ?? 0) - (projection?.starts ?? 0), 0)
    : 0;

  const getSosInfo = (sos?: number) => {
    if (sos === undefined) return { label: '', color: '' };
    if (sos >= 7) return { label: 'Easy', color: 'text-positive' };
    if (sos <= 3) return { label: 'Tough', color: 'text-negative' };
    return { label: 'Moderate', color: 'text-ink-dim' };
  };
  const sosInfo = getSosInfo(projection?.strengthOfSchedule);

  const handleSavePosition = async (updatedPositions: string[], notes?: string) => {
    await apiService.addPositionOverride(player.id, updatedPositions, notes);
    window.location.reload();
  };

  const openDetails = (event: React.MouseEvent) => {
    if (!onDetails) return;
    event.stopPropagation();
    onDetails();
  };

  const handleCardClick = () => {
    if (onCompare) {
      onCompare();
      return;
    }
    onDetails?.();
  };

  const hasCardAction = Boolean(onCompare || onDetails);

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <div
          className={`player-chip relative flex h-16 items-center gap-2.5 overflow-hidden rounded-lg border bg-surface-2 px-3 py-2 transition-colors ${
            isSelectedForComparison ? 'border-warning ring-2 ring-warning' : 'border-line hover:border-accent'
          } ${isDragging ? 'opacity-50' : ''} ${isLoading ? 'animate-pulse' : ''} ${hasCardAction ? 'cursor-pointer' : ''}`}
          onClick={handleCardClick}
        >
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: teamColor }} />
          <img
            src={headshotUrl}
            alt={player.full_name}
            className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-1 object-cover"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
          <img
            src={teamLogo}
            alt={`${player.team} logo`}
            className="h-7 w-7 flex-shrink-0 object-contain"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
          <button type="button" className="min-w-0 flex-1 text-left" onClick={openDetails}>
            <span className="block truncate text-xs font-semibold text-ink">{player.full_name}</span>
            <span className="block truncate text-[10px] text-ink-dim">{player.team} · {positions}</span>
          </button>
          {hasScheduledGames && projection ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] font-semibold text-ink-dim">
                  {projection.starts}/{projection.gamesAvailable} starts
                </span>
              </TooltipTrigger>
              <TooltipContent>Usable starts out of scheduled games in the selected window.</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-[10px] text-ink-mute">No games</span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-shrink-0">
                <PuckRating
                  value={iceScore}
                  min={ICE_RATING_MIN}
                  max={ICE_RATING_MAX}
                  size={38}
                  pulse={isPulseEnabled}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{iceRatingDescription}</TooltipContent>
          </Tooltip>
          <button
            type="button"
            aria-label={`Edit ${player.full_name}'s position eligibility`}
            className="text-ink-mute hover:text-accent"
            onClick={(event) => {
              event.stopPropagation();
              setIsEditPositionOpen(true);
            }}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {onCompareWithFreeAgents && (
            <button
              type="button"
              aria-label={`Compare ${player.full_name} with free agents`}
              className="text-ink-dim hover:text-accent"
              onClick={(event) => {
                event.stopPropagation();
                onCompareWithFreeAgents();
              }}
            >
              <SwapIcon size={14} />
            </button>
          )}
          {onToggleKeeper && (
            <button
              type="button"
              aria-label={`${keeperEntry?.keeper ? 'Unmark' : 'Mark'} ${player.full_name} as a keeper`}
              aria-pressed={keeperEntry?.keeper ?? false}
              className={keeperEntry?.keeper ? 'text-positive' : 'text-ink-mute hover:text-positive'}
              onClick={(event) => { event.stopPropagation(); onToggleKeeper(); }}
            >
              <ShieldCheck size={14} />
            </button>
          )}
          {onCompareKeeper && (
            <button type="button" aria-label={`Compare ${player.full_name} as a keeper`} className="text-ink-mute hover:text-accent" onClick={(event) => { event.stopPropagation(); onCompareKeeper(); }}>
              <ArrowLeftRight size={14} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${player.full_name}`}
              className="text-ink-mute hover:text-negative"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              ×
            </button>
          )}
          <PlayerPositionEditModal
            isOpen={isEditPositionOpen}
            onClose={() => setIsEditPositionOpen(false)}
            player={player}
            onSave={handleSavePosition}
          />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <article
        className={`player-chip relative w-full max-w-[500px] overflow-hidden rounded-xl border bg-surface-1 shadow-lg shadow-black/30 transition-colors ${
          isSelectedForComparison ? 'border-warning ring-2 ring-warning' : 'border-line hover:border-accent'
        } ${isDragging ? 'opacity-50' : ''} ${isLoading ? 'animate-pulse' : ''} ${hasCardAction ? 'cursor-pointer' : ''}`}
        onClick={handleCardClick}
      >
        {/* Team light: the club's color raked across the glass, brightest at the crest. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(115deg, ${teamRgba(teamColor, 0.34)} 0%, ${teamRgba(teamColor, 0.09)} 34%, transparent 56%)`,
          }}
        />
        <div className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: teamColor }} />
        <div className="relative p-4 pl-5">
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0">
                <img
                  src={headshotUrl}
                  alt={player.full_name}
                  className="h-12 w-12 rounded-full border border-line bg-surface-2 object-cover"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
                <img
                  src={teamLogo}
                  alt={`${player.team} logo`}
                  className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-surface-1 p-0.5 object-contain"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  className={`block max-w-full truncate text-left text-base font-bold text-ink ${onDetails ? 'hover:text-accent' : ''}`}
                  onClick={openDetails}
                >
                  {player.full_name}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-dim">
                  <TeamColorDisplay teamCode={player.team} teamTier={teamTier} showTooltip>
                    {player.team}
                  </TeamColorDisplay>
                  <span aria-hidden="true">·</span>
                  <span>{positions}</span>
                  <InjuryBadge injuryStatus={player.injuryStatus} isActive={player.isActive} size="sm" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Edit ${player.full_name}'s position eligibility`}
                        className="rounded p-1 text-ink-mute hover:bg-surface-2 hover:text-accent"
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsEditPositionOpen(true);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Edit position eligibility</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-start gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center">
                    <PuckRating
                      value={iceScore}
                      min={ICE_RATING_MIN}
                      max={ICE_RATING_MAX}
                      size={62}
                      pulse={isPulseEnabled}
                    />
                    <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-ink-mute">ICE</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{iceRatingDescription}</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <CrackRule className="mt-4" bias={0.55} />
          <section className="mt-3" aria-label={isGoalie ? 'Goalie workload' : 'NHL role'}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent">
                {isGoalie ? 'Goalie workload' : 'NHL role'}
              </h3>
              <div className="flex items-center gap-2">
                {!isGoalie && hasSignificantRoleTrend && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                      isRoleRising ? 'bg-positive-muted text-positive' : 'bg-negative-muted text-negative'
                    }`}
                  >
                    {isRoleRising
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
                    Role {isRoleRising ? 'rising' : 'falling'}
                  </span>
                )}
                {!isGoalie && hasRecentRoleSample && (
                  <span className="text-[10px] text-ink-mute">Last 7 · {last7Games} GP</span>
                )}
                {isGoalie && goalieGamesPlayed > 0 && (
                  <span className="text-[10px] text-ink-mute">{goalieGamesPlayed} GP</span>
                )}
              </div>
            </div>
            {isGoalie ? (
              <div className="grid grid-cols-3 gap-2">
                <RoleMetric
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="Starts"
                  value={goalieStarts === undefined ? '—' : `${goalieStarts}`}
                />
                <RoleMetric
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="SV%"
                  value={savePct === undefined ? '—' : savePct.toFixed(3).replace(/^0/, '')}
                  meter={savePct === undefined ? undefined : (savePct - 0.86) / 0.08}
                />
                <RoleMetric
                  icon={<Clock3 className="h-3.5 w-3.5" />}
                  label="GAA"
                  value={gaa === undefined ? '—' : gaa.toFixed(2)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <RoleMetric
                  icon={<Clock3 className="h-3.5 w-3.5" />}
                  label="Avg TOI"
                  value={formatToi(seasonToi)}
                  recentValue={hasRecentRoleSample ? formatToi(roleTrend?.last7.avgToi) : undefined}
                  change={hasRecentRoleSample ? roleTrend?.toiChange : undefined}
                />
                <RoleMetric
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label="PP TOI"
                  value={formatToi(seasonPpToi)}
                  recentValue={hasRecentRoleSample ? formatToi(roleTrend?.last7.avgPpToi) : undefined}
                  change={hasRecentRoleSample ? roleTrend?.ppToiChange : undefined}
                />
                <RoleMetric
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label={roleTrend?.ppShareSource?.last7 === 'estimated' ? 'PP share (est.)' : 'PP share'}
                  value={roleTrend ? `${roleTrend.season.ppPct.toFixed(0)}%` : '—'}
                  recentValue={hasRecentRoleSample ? `${roleTrend?.last7.ppPct.toFixed(0)}%` : undefined}
                  change={hasRecentRoleSample ? roleTrend?.ppPctChange : undefined}
                  changeSuffix=" pts"
                  meter={roleTrend ? roleTrend.season.ppPct / 100 : undefined}
                />
              </div>
            )}
          </section>

          <CrackRule className="mt-3" bias={2.1} />
          <section className="mt-3" aria-label="Fantasy lineup opportunity">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent">Your lineup</h3>
              {hasScheduledGames && projection && (
                <span className="text-xs font-semibold text-ink">~{projection.projectedPoints.toFixed(1)} projected pts</span>
              )}
            </div>

            {hasScheduledGames && projection ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                <LineupMetric icon={<Calendar className="h-3.5 w-3.5" />} value={projection.gamesAvailable} label="games" />
                <LineupMetric icon={<Rocket className="h-3.5 w-3.5" />} value={projection.starts} label="usable starts" accent />
                <LineupMetric icon={<Moon className="h-3.5 w-3.5" />} value={offNightStarts} label="off-night" />
                <LineupMetric value={lineupConflicts} label={lineupConflicts === 1 ? 'conflict' : 'conflicts'} warning={lineupConflicts > 0} />
              </div>
            ) : (
              <p className="text-xs text-ink-dim">No NHL games in the selected window.</p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
              <div className="flex items-center gap-3 text-ink-dim">
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">FPPG</span>
                <span>Season <strong className="tabular-nums text-ink">{seasonFppg.toFixed(1)}</strong></span>
                <span>Last 30 <strong className="tabular-nums text-ink">{hasLast30Sample ? last30Fppg.toFixed(1) : '—'}</strong></span>
                <span>Last 7 <strong className="tabular-nums text-ink">{hasLast7ProductionSample ? last7Fppg.toFixed(1) : '—'}</strong></span>
              </div>
              {hasScheduledGames && sosInfo.label && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={sosInfo.color}>{sosInfo.label} schedule · {projection?.strengthOfSchedule}/10</span>
                  </TooltipTrigger>
                  <TooltipContent>Strength of schedule for the selected window. Higher is easier.</TooltipContent>
                </Tooltip>
              )}
            </div>
          </section>

          {(onCompareWithFreeAgents || onRemove || onToggleKeeper || onCompareKeeper) && (
            <footer className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-line pt-3" onPointerDown={(event) => event.stopPropagation()}>
              <div className="flex flex-wrap items-end gap-2">
                {onToggleKeeper && (
                  <button
                    type="button"
                    aria-pressed={keeperEntry?.keeper ?? false}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold ${keeperEntry?.keeper ? 'border-positive bg-positive-muted text-positive' : 'border-line text-ink-dim hover:border-positive hover:text-positive'}`}
                    onClick={(event) => { event.stopPropagation(); onToggleKeeper(); }}
                  >
                    <ShieldCheck size={14} />{keeperEntry?.keeper ? 'Keeper' : 'Mark keeper'}
                  </button>
                )}
                {keeperEntry?.keeper && keeperRules?.costSystem === 'draft-round' && onKeeperCostChange && (
                  <label className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                    Round
                    <input
                      type="number" min="1" max="50" inputMode="numeric"
                      value={keeperEntry.keeperCost?.type === 'draft-round' ? keeperEntry.keeperCost.round : ''}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onKeeperCostChange(event.target.value ? { type: 'draft-round', round: Number(event.target.value) } : undefined)}
                      className="ml-1 h-8 w-16 rounded-md border border-line bg-surface-0 px-2 text-xs text-ink outline-none focus:border-accent"
                    />
                  </label>
                )}
                {keeperEntry?.keeper && keeperRules?.costSystem === 'salary' && onKeeperCostChange && (
                  <label className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                    Salary
                    <input
                      type="number" min="0" step="0.1" inputMode="decimal"
                      value={keeperEntry.keeperCost?.type === 'salary' ? keeperEntry.keeperCost.amount : ''}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onKeeperCostChange(event.target.value ? { type: 'salary', amount: Number(event.target.value), currency: keeperEntry.keeperCost?.type === 'salary' ? keeperEntry.keeperCost.currency : 'USD' } : undefined)}
                      className="ml-1 h-8 w-20 rounded-md border border-line bg-surface-0 px-2 text-xs text-ink outline-none focus:border-accent"
                    />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
              {onCompareKeeper && (
                <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent" onClick={(event) => { event.stopPropagation(); onCompareKeeper(); }}>
                  <ArrowLeftRight size={14} /> Compare keeper
                </button>
              )}
              {onCompareWithFreeAgents && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCompareWithFreeAgents();
                  }}
                >
                  <SwapIcon size={14} /> Compare free agents
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink-mute hover:bg-negative-muted hover:text-negative"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                >
                  Remove
                </button>
              )}
              </div>
            </footer>
          )}
        </div>

        <PlayerPositionEditModal
          isOpen={isEditPositionOpen}
          onClose={() => setIsEditPositionOpen(false)}
          player={player}
          onSave={handleSavePosition}
        />
      </article>
    </TooltipProvider>
  );
};
