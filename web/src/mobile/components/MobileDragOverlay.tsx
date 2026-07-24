import { DragOverlay } from '@dnd-kit/core';
import { mugshotSeason } from '../../lib/season';
import { Flame, Snowflake, AlertTriangle } from 'lucide-react';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobileDragOverlayProps {
  player: RosterPlayer | null;
  projection?: PlayerProjection;
}

/**
 * Get headshot URL for NHL player
 */
function getHeadshotUrl(playerId: string, team: string): string {
  const numericId = playerId.replace(/^nhl:/, '');
  return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${numericId}.png`;
}

/**
 * Get ICE score glow style based on value
 */
function getIceGlowStyle(score: number): React.CSSProperties {
  const t = Math.min(1, Math.max(0, score / 5));
  const glowSize = 8 + t * 20;
  const cyan = `var(--accent-muted)`;

  return {
    boxShadow: `0 0 ${glowSize}px ${cyan}, inset 0 0 4px ${cyan}`,
    border: `2px solid ${cyan}`,
    background: 'var(--surface-0)',
  };
}

/**
 * MobileDragOverlay - Floating drag preview component
 *
 * Shows player headshot, name, position while dragging.
 * Styled with shadow/scale to look "lifted".
 */
export function MobileDragOverlay({ player, projection }: MobileDragOverlayProps) {
  if (!player) {
    return <DragOverlay dropAnimation={null} />;
  }

  const iceScore = projection?.iceScore ?? 0;
  const iceGlowStyle = getIceGlowStyle(iceScore);
  const hasInjury = player.injuryStatus && player.injuryStatus !== 'Active';

  // Trend calculation
  const seasonFppg = projection?.fppg ?? player.seasonFppg ?? 0;
  const last7Fppg = (player as any).last7Fppg ?? seasonFppg;
  const trendPercent = seasonFppg > 0 ? Math.round(((last7Fppg - seasonFppg) / seasonFppg) * 100) : 0;
  const isHot = trendPercent > 10;
  const isCold = trendPercent < -10;

  return (
    <DragOverlay dropAnimation={null}>
      <div
        className='bg-surface-2 rounded-lg border-2 border-accent overflow-hidden shadow-2xl shadow-cyan-500/30 [transform:scale(1.05)] w-[280px] [touch-action:none]'>
        <div className="py-2 px-3">
          <div className="flex items-center gap-2">
            {/* Headshot + Team Logo */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <img
                src={getHeadshotUrl(player.id, player.team)}
                alt={player.full_name}
                className="w-10 h-10 rounded-full bg-surface-2 object-cover border-2 border-accent"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-player.png';
                }}
              />
              <img
                src={getTeamLogoUrl(player.team)}
                alt={player.team}
                className="w-6 h-6 rounded-full bg-surface-2 border border-line p-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-ink truncate">
                  {player.full_name}
                </span>
                {hasInjury && (
                  <AlertTriangle className="w-3 h-3 text-negative flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-ink-dim">
                <span>{player.team} • {player.positions?.slice(0, 2).join(',') || 'N/A'}</span>
                {(isHot || isCold) && (
                  <span className={`flex items-center gap-0.5 ${isHot ? 'text-warning' : 'text-accent'}`}>
                    {isHot ? <Flame className="w-2.5 h-2.5" /> : <Snowflake className="w-2.5 h-2.5" />}
                    {isHot ? '+' : ''}{trendPercent}%
                  </span>
                )}
              </div>
            </div>

            {/* ICE Score Circle */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={iceGlowStyle}
            >
              <span className="text-[10px] font-bold text-ink">{iceScore.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </DragOverlay>
  );
}
