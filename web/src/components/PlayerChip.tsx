import React, { useState } from 'react';
import { Calendar, Rocket, Moon, Flame, Snowflake, TrendingUp, Edit2 } from 'lucide-react';
import { SwapIcon } from './icons/SwapIcon';
import type { RosterPlayer, PlayerProjection } from '../lib/coachSchemas';
import { getTeamLogoUrl, getTeamColor } from '../lib/teamLogos';
import type { TeamTierData } from '../types/teamTiers';
import { TeamColorDisplay } from './TeamTier/TeamColorDisplay';
import { getIceCircleStyle, shouldPulse } from '../lib/iceScore';
import { mugshotSeason } from '../lib/season';
import { PlayerPositionEditModal } from './PlayerPositionEditModal';
import { InjuryBadge } from './player/InjuryBadge';
import { RoleTrendBadge } from './player/RoleTrendBadge';
import { apiService } from '../services/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
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
}

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
}) => {
  const isCompact = variant === 'compact';
  const positions = Array.isArray(player.positions) ? player.positions.join('/') : 'N/A';
  const teamColor = getTeamColor(player.team);
  const teamLogo = getTeamLogoUrl(player.team);

  // Position editing state
  const [isEditPositionOpen, setIsEditPositionOpen] = useState(false);

  // Handle position save
  const handleSavePosition = async (positions: string[], notes?: string) => {
    try {

      const result = await apiService.addPositionOverride(player.id, positions, notes);


      // Refresh the page to reload roster with updated positions
      window.location.reload();
    } catch (error) {
      console.error('[PlayerChip] API call failed:', error);
      console.error('[PlayerChip] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw so the modal shows the error
    }
  };

  // Extract numeric player ID from string like "nhl:8473986"
  const getHeadshotUrl = (playerId: string, team: string) => {
    const numericId = playerId.replace(/^nhl:/, '');
    return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${numericId}.png`;
  };
  const headshotUrl = getHeadshotUrl(player.id, player.team);

  // Use backend-provided ICE Score (with SoS adjustment) when available
  // Fall back to frontend calculation for backwards compatibility
  const seasonFppg = (player as any).seasonFppg ?? projection?.fppg ?? 0;
  const last30Fppg = (player as any).last30Fppg ?? seasonFppg;
  const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
  const calculatedIce = (seasonFppg * 0.5) + (last30Fppg * 0.3) + (last7Fppg * 0.2);
  const iceScore = projection?.iceScore ?? calculatedIce;

  // Get glacial brightness style for ICE Score circle
  const iceCircleStyle = iceScoreRange
    ? getIceCircleStyle(iceScore, iceScoreRange.min, iceScoreRange.max)
    : getIceCircleStyle(iceScore, 0, 4);

  const isPulseEnabled = iceScoreRange
    ? shouldPulse(iceScore, iceScoreRange.min, iceScoreRange.max)
    : false;

  // Determine hot/cold streak
  const isHot = last7Fppg > seasonFppg && seasonFppg > 0;
  const isCold = last7Fppg < seasonFppg * 0.8 && seasonFppg > 0;
  const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;

  // Format SoS
  const getSosInfo = (sos?: number): { label: string; color: string; dotColor: string } => {
    if (sos === undefined) return { label: '', color: '', dotColor: '' };
    if (sos >= 7) return { label: 'Easy', color: 'text-positive', dotColor: 'bg-positive' };
    if (sos <= 3) return { label: 'Tough', color: 'text-negative', dotColor: 'bg-negative' };
    return { label: 'Moderate', color: 'text-ink-dim', dotColor: 'bg-surface-2' };
  };

  const sosInfo = getSosInfo(projection?.strengthOfSchedule);

  // Compact variant - horizontal line strip
  if (isCompact) {
    return (
      <TooltipProvider>
        <div
          className={`
            player-chip relative
            ${isDragging ? 'opacity-50' : ''}
            ${isLoading ? 'animate-pulse' : ''}
            flex items-center gap-2.5 px-3 py-2 rounded-lg
            bg-surface-2 border
            ${isSelectedForComparison
              ? 'border-warning ring-2 ring-warning shadow-lg shadow-yellow-500/30'
              : 'border-line hover:border-accent'}
            ${onCompare ? 'cursor-pointer' : ''}
            transition-all duration-150
            h-[64px]
          `}
          onClick={onCompare}
        >
          {/* Thin team color accent at top */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ backgroundColor: teamColor }}
          />

          {/* Team logo + name block */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* Player headshot */}
                <img
                  src={headshotUrl}
                  alt={player.full_name}
                  className="h-8 w-8 rounded-full bg-surface-2 object-cover flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {/* Team logo */}
                <img
                  src={teamLogo}
                  alt={player.team}
                  className="h-8 w-8 rounded-full bg-surface-2 p-0.5 object-contain flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div
                  className={`min-w-0 flex-1 ${onDetails ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  onClick={(e) => {
                    if (onDetails) {
                      e.stopPropagation();
                      onDetails();
                    }
                  }}
                >
                  <div className="text-xs font-semibold text-ink-dim truncate leading-tight">
                    {player.full_name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-[10px] text-ink-dim leading-tight mt-0.5">
                      {player.team} • {positions}
                    </div>
                    <InjuryBadge
                      injuryStatus={player.injuryStatus}
                      isActive={player.isActive}
                      size="sm"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditPositionOpen(true);
                          }}
                          className="text-ink-dim hover:text-accent hover:bg-surface-2 transition-colors p-0.5 rounded"
                          data-edit-button="true"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit position eligibility</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Player headshot and team logo for quick visual ID. Click name for details.</p>
            </TooltipContent>
          </Tooltip>

          {/* Stats cluster */}
          {projection && (
            <div className="flex items-center gap-2.5 text-[10px] text-ink-dim">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5 text-ink-dim" />
                    {projection.gamesAvailable}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of NHL games this player is scheduled to play</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5">
                    <Rocket className="h-2.5 w-2.5 text-accent" />
                    {projection.starts}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Projected fantasy starts you'll actually use in this slot</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5">
                    <Moon className="h-2.5 w-2.5 text-accent" />
                    {Math.round((projection.offNightRate ?? 0) * projection.gamesAvailable)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Off-nights: games on lighter NHL nights when it's easier to fit this player into your lineup</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* SoS badge */}
          {projection?.strengthOfSchedule !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-[10px] text-ink-dim">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      projection.strengthOfSchedule >= 7
                        ? 'bg-positive'
                        : projection.strengthOfSchedule <= 3
                        ? 'bg-negative'
                        : 'bg-warning'
                    }`}
                  />
                  <span>{projection.strengthOfSchedule}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Schedule difficulty for this window (1–10). Higher = easier.</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* ICE puck - smaller */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isPulseEnabled ? 'animate-ice-pulse' : ''
                  }`}
                  style={{
                    background: iceCircleStyle.backgroundColor,
                    border: iceCircleStyle.border,
                    boxShadow: iceCircleStyle.boxShadow,
                    color: iceCircleStyle.textColor,
                  }}
                >
                  {iceScore.toFixed(1)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>ICE Score – Impact • Context • Expectation. A league-weighted rating of how strong this player is for this window.</p>
            </TooltipContent>
          </Tooltip>

          {/* Compare button */}
          {onCompareWithFreeAgents && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompareWithFreeAgents();
                  }}
                  className="text-ink-dim hover:text-accent transition-colors text-sm leading-none flex-shrink-0"
                >
                  <SwapIcon size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Compare with free agents</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Remove button */}
          {onRemove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="text-ink-dim hover:text-negative transition-colors text-base leading-none flex-shrink-0"
                >
                  ×
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove this player from the roster slot</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Position Edit Modal */}
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

  // Full variant (original)
  return (
    <TooltipProvider>
      <div
        className={`
          player-chip relative group
          ${isDragging ? 'opacity-50' : ''}
          ${isLoading ? 'animate-pulse' : ''}
          w-full max-w-[500px]
          bg-gradient-to-br from-[var(--surface-0)] via-[var(--surface-1)] to-[var(--surface-2)]
          rounded-lg
          border
          ${isSelectedForComparison
            ? 'border-warning ring-2 ring-warning shadow-xl shadow-yellow-500/30'
            : 'border-accent hover:border-accent shadow-lg shadow-black/50 hover:shadow-xl hover:shadow-cyan-500/20'}
          ${onCompare ? 'cursor-pointer' : ''}
          transition-all duration-200 ease-out
          overflow-hidden
        `}
        onClick={onCompare}
      >
      {/* Team color accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: teamColor }}
      />

      {/* Cyan glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            boxShadow: `inset 0 0 20px ${teamColor || 'var(--accent)'}40`
          }}
        />
      </div>

      {/* White beam sweep on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none overflow-hidden rounded-lg">
        <div
          className='absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-[500px] transition-transform duration-700 ease-out [transform:skewX(-20deg)]' />
      </div>

      {/* Rink reflection gloss on bottom 20% */}
      <div
        className='absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-lg h-[20%] [background:linear-gradient(to_top,_var(--line),_transparent)] opacity-[0.6]' />

      <div className="relative px-8 py-4 flex flex-col gap-2">
        {/* ROW 1: Header - Logo + Name + Positions + ICE Score */}
        <div
          className='flex items-center justify-between -mx-8 -mt-4 px-8 pt-4 pb-3 [background:linear-gradient(to_bottom,_var(--line),_transparent)]'>
          <div className="flex items-center gap-3">
            {/* Player headshot */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className='w-14 h-14 bg-surface-2/70 rounded-full flex items-center justify-center overflow-hidden border border-accent flex-shrink-0 [box-shadow:inset_0_2px_8px_var(--surface-0),_inset_0_0_12px_var(--accent-muted),_0_0_16px_var(--accent-muted)]'>
                  <img
                    src={headshotUrl}
                    alt={player.full_name}
                    className="w-14 h-14 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Player headshot for quick visual ID</p>
              </TooltipContent>
            </Tooltip>
            {/* Team logo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className='w-14 h-14 bg-surface-2/70 rounded-full flex items-center justify-center overflow-hidden border border-accent flex-shrink-0 [box-shadow:inset_0_2px_8px_var(--surface-0),_inset_0_0_12px_var(--accent-muted),_0_0_16px_var(--accent-muted)]'>
                  <img
                    src={teamLogo}
                    alt={player.team}
                    className="w-11 h-11 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Team logo for quick visual ID</p>
              </TooltipContent>
            </Tooltip>
            <div
              className={`${onDetails ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={(e) => {
                if (onDetails) {
                  e.stopPropagation();
                  onDetails();
                }
              }}
            >
              <div className="font-bold text-base text-ink">
                {player.full_name}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <TeamColorDisplay
                  teamCode={player.team}
                  teamTier={teamTier}
                  className="font-semibold text-ink-dim"
                  showTooltip={true}
                >
                  {player.team}
                </TeamColorDisplay>
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2/60 border border-accent">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                        <span className="text-accent font-semibold text-[11px]">{positions}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Eligible fantasy positions for this player. Determines which roster slots they can occupy.</p>
                    </TooltipContent>
                  </Tooltip>

                  <InjuryBadge
                    injuryStatus={player.injuryStatus}
                    isActive={player.isActive}
                    size="md"
                  />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditPositionOpen(true);
                        }}
                        className="text-ink-dim hover:text-accent transition-colors p-1 rounded hover:bg-surface-2"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit position eligibility</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center">
                  <div
                    className={`ice-score-bubble flex items-center justify-center w-14 h-14 rounded-full font-bold text-lg transition-all duration-300 ${
                      isPulseEnabled ? 'animate-ice-pulse' : ''
                    }`}
                    style={{
                      background: iceCircleStyle.backgroundColor,
                      border: iceCircleStyle.border,
                      boxShadow: `${iceCircleStyle.boxShadow}, 0 0 20px ${teamColor || 'var(--accent)'}40`,
                      color: iceCircleStyle.textColor,
                    }}
                  >
                    {iceScore.toFixed(1)}
                  </div>
                  <span className="text-[9px] text-accent font-bold tracking-wider mt-0.5 group-hover:text-accent transition-colors">ICE</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>ICE Score – Impact • Context • Expectation. A league-weighted rating of how strong this player is for this window, based on role, schedule, and recent performance.</p>
              </TooltipContent>
            </Tooltip>
            {onCompareWithFreeAgents && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompareWithFreeAgents();
                    }}
                    className="text-ink-dim hover:text-accent transition-colors text-xl leading-none"
                  >
                    <SwapIcon size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Compare with free agents</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onRemove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                    className="text-ink-mute hover:text-negative transition-colors text-xl leading-none"
                  >
                    ×
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove this player from the roster slot</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ROW 2: Games/Starts/Off-nights */}
        {projection && (
          <div className="flex items-center gap-4 text-xs border-t border-line pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-ink-dim" />
                  <span className="text-ink font-semibold">{projection.gamesAvailable} games</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of NHL games this player is scheduled to play in the selected window</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Rocket className="w-4 h-4 text-accent" />
                  <span className="text-ink font-semibold">{projection.starts} starts</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Projected fantasy starts you'll actually use in this slot for the selected window</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-accent" />
                  <span className="text-ink font-semibold">{Math.round((projection.offNightRate ?? 0) * projection.gamesAvailable)} off-night</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Off-nights: games on lighter NHL nights (fewer teams playing) when it's easier to fit this player into your lineup</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ROW 3: SEASON/LAST30/LAST7 Stats */}
        <div className="flex items-center gap-4 border-t border-line pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1 text-center">
                <div className="text-[10px] text-ink-mute uppercase font-bold mb-1">Season</div>
                <div className="text-lg font-bold text-ink">{seasonFppg.toFixed(1)}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Average fantasy points per game for the full season in your league's scoring</p>
            </TooltipContent>
          </Tooltip>
          <div className="w-px h-10 bg-surface-2/30"></div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1 text-center">
                <div className="text-[10px] text-ink-mute uppercase font-bold mb-1">Last 30</div>
                <div className="text-lg font-bold text-ink">{last30Fppg.toFixed(1)}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Average fantasy points per game over the last 30 days</p>
            </TooltipContent>
          </Tooltip>
          <div className="w-px h-10 bg-surface-2/30"></div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1 text-center">
                <div className="text-[10px] text-ink-mute uppercase font-bold mb-1">Last 7</div>
                <div className={`text-lg font-bold ${
                  isHot ? 'text-warning' : isCold ? 'text-accent' : 'text-ink'
                }`}>
                  {last7Fppg.toFixed(1)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Average fantasy points per game over the last 7 days. A quick view of how hot or cold the player is right now.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ROW 4: Trend + Role + SoS */}
        <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
          {/* Left: Hot/Cold indicator */}
          <div className="flex items-center gap-1.5 flex-1">
            {isHot && seasonFppg > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-warning" />
                    <span className="text-warning font-bold">Hot +{trendPercent}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Performance vs season baseline. Hot +{trendPercent}% = this player's recent window is ~{trendPercent}% better than their season-long average in your scoring.</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isCold && seasonFppg > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Snowflake className="w-4 h-4 text-accent" />
                    <span className="text-accent font-bold">Cold {trendPercent}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Performance vs season baseline. Cold {trendPercent}% = player's recent window is ~{Math.abs(trendPercent)}% below their season average.</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!isHot && !isCold && seasonFppg > 0 && (
              <span className="text-ink-dim font-semibold">Steady</span>
            )}
          </div>

          {/* Center: Role badge */}
          {player.roleTrend && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-ink-dim text-[10px] font-semibold uppercase cursor-help">Role</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-surface-2 border-line">
                  <div className="text-xs space-y-1">
                    <div className="font-semibold border-b border-line pb-1">Ice Time Stats</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span className="text-ink-dim">Season TOI:</span>
                      <span className="text-ink font-mono text-right">
                        {Math.floor(player.roleTrend.season.avgToi / 60)}:{(Math.floor(player.roleTrend.season.avgToi % 60)).toString().padStart(2, '0')}
                      </span>

                      <span className="text-ink-dim">Season PP:</span>
                      <span className="text-ink font-mono text-right">
                        {Math.floor(player.roleTrend.season.avgPpToi / 60)}:{(Math.floor(player.roleTrend.season.avgPpToi % 60)).toString().padStart(2, '0')}
                        <span className="text-xs text-ink-dim ml-1">({player.roleTrend.season.ppPct.toFixed(1)}%)</span>
                      </span>

                      <span className="text-ink-dim">Last 7d TOI:</span>
                      <span className="text-ink font-mono text-right">
                        {Math.floor(player.roleTrend.last7.avgToi / 60)}:{(Math.floor(player.roleTrend.last7.avgToi % 60)).toString().padStart(2, '0')}
                      </span>

                      <span className="text-ink-dim">Last 7d PP:</span>
                      <span className="text-ink font-mono text-right">
                        {Math.floor(player.roleTrend.last7.avgPpToi / 60)}:{(Math.floor(player.roleTrend.last7.avgPpToi % 60)).toString().padStart(2, '0')}
                        <span className="text-xs text-ink-dim ml-1">({player.roleTrend.last7.ppPct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <RoleTrendBadge trend={player.roleTrend} size="sm" />
            </div>
          )}

          {/* Right: SoS */}
          <div className="flex items-center justify-end flex-1">
            {sosInfo.label && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-ink-dim" />
                  <div className={`w-2 h-2 rounded-full ${sosInfo.dotColor}`}></div>
                  <span className={`font-bold ${sosInfo.color}`}>{sosInfo.label} (SoS {projection?.strengthOfSchedule})</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Strength of Schedule (SoS) for this window. 1 = brutal, 5 = neutral, 10 = dream schedule. Based on opponent defense, home/away, and rest-day edges across all upcoming games.</p>
              </TooltipContent>
            </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Position Edit Modal */}
      <PlayerPositionEditModal
        isOpen={isEditPositionOpen}
        onClose={() => setIsEditPositionOpen(false)}
        player={player}
        onSave={handleSavePosition}
      />
    </div>
    </TooltipProvider>
  );
};
