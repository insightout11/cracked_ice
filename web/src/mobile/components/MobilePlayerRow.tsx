import { Check, ChevronRight, Plus, ShieldCheck, Star } from 'lucide-react';
import { mugshotSeason } from '../../lib/season';
import type { RosterPlayer, PlayerProjection } from '../../lib/coachSchemas';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface MobilePlayerRowProps {
  player: RosterPlayer;
  projection?: PlayerProjection;
  isOnRoster?: boolean;
  isWatched?: boolean;
  availability?: 'fa' | 'owned' | 'waivers' | 'unknown';
  onTap?: () => void;
  onAdd?: () => void;
  onToggleWatch?: () => void;
  onConfirmAvailable?: () => void;
}

function iceTone(score?: number): string {
  if (score === undefined) return 'text-ink-mute';
  if (score >= 8) return 'text-positive';
  if (score >= 7) return 'text-accent';
  if (score >= 6) return 'text-warning';
  return 'text-negative';
}

function headshotUrl(playerId: string, team: string): string {
  return `https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${team}/${playerId.replace(/^nhl:/, '')}.png`;
}

function availabilityBadge(availability?: string) {
  switch (availability) {
    case 'fa': return { tone: 'bg-positive-muted text-positive', label: 'Free agent' };
    case 'owned': return { tone: 'bg-accent-muted text-accent', label: 'My team' };
    case 'waivers': return { tone: 'bg-warning-muted text-warning', label: 'Waivers' };
    default: return { tone: 'bg-surface-1 text-ink-mute', label: 'Unconfirmed' };
  }
}

export function MobilePlayerRow({
  player,
  projection,
  isOnRoster = false,
  isWatched = false,
  availability,
  onTap,
  onAdd,
  onToggleWatch,
  onConfirmAvailable,
}: MobilePlayerRowProps) {
  const name = player.full_name || (player as { name?: string }).name || 'Unknown player';
  const positions = player.positions || [(player as { position?: string }).position].filter(Boolean) as string[];
  const badge = availabilityBadge(availability);
  const iceScore = projection?.iceScore;
  const hasScheduleContext = Boolean(projection && projection.gamesAvailable > 0);
  const headlineValue = hasScheduleContext ? iceScore?.toFixed(1) : (projection?.fppg ?? player.seasonFppg)?.toFixed(2);

  return (
    <article className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={onTap} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-80">
          <div className="relative shrink-0">
            <img
              src={headshotUrl(player.id, player.team)}
              alt={name}
              className="h-12 w-12 rounded-full border border-line bg-surface-1 object-cover"
              onError={(event) => { event.currentTarget.src = '/player-placeholder.png'; }}
            />
            {player.team && <img src={getTeamLogoUrl(player.team)} alt="" className="absolute -bottom-1 -right-1 h-5 w-5 object-contain" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <p className="text-xs text-ink-dim">{player.team} · {positions.join('/') || 'N/A'}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.tone}`}>{badge.label}</span>
              <span className="text-[10px] text-ink-mute">Full profile</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="text-right">
              <strong className={`block font-mono text-xl leading-none ${hasScheduleContext ? iceTone(iceScore) : 'text-accent'}`}>{headlineValue ?? '—'}</strong>
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">{hasScheduleContext ? 'ICE' : 'FPPG'}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-mute" />
          </div>
        </button>

        <div className="flex shrink-0 flex-col gap-1">
          {onToggleWatch && (
            <button type="button" onClick={onToggleWatch} className={`rounded-lg p-2 ${isWatched ? 'bg-warning-muted text-warning' : 'text-ink-dim'}`} aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}>
              <Star className={`h-4 w-4 ${isWatched ? 'fill-current' : ''}`} />
            </button>
          )}
          {onAdd && !isOnRoster && <button type="button" onClick={onAdd} className="rounded-lg bg-accent p-2 text-surface-0" aria-label="Add to roster"><Plus className="h-4 w-4" /></button>}
          {onConfirmAvailable && !isOnRoster && <button type="button" onClick={onConfirmAvailable} className="rounded-lg p-2 text-ink-dim" aria-label={`Confirm ${name} is available`}><ShieldCheck className="h-4 w-4" /></button>}
          {isOnRoster && <span className="rounded-lg bg-positive-muted p-2 text-positive" aria-label="On roster"><Check className="h-4 w-4" /></span>}
        </div>
      </div>
      {hasScheduleContext ? (
        <div className="grid grid-cols-3 border-t border-line bg-surface-1/40">
          <Metric label="FPPG" value={(projection?.fppg ?? player.seasonFppg)?.toFixed(2) ?? '—'} />
          <Metric label="Games" value={projection?.gamesAvailable.toString() ?? '—'} />
          <Metric label="Starts" value={projection?.starts.toString() ?? '—'} />
        </div>
      ) : (
        <div className="grid grid-cols-3 border-t border-line bg-surface-1/40" aria-label="Prior-season statistics">
          <Metric label="Goals · prior" value={String(player.stats?.goals ?? '—')} />
          <Metric label="Assists · prior" value={String(player.stats?.assists ?? '—')} />
          <Metric label="PPP · prior" value={String(player.stats?.power_play_points ?? '—')} />
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-line px-2 py-2 text-center last:border-r-0"><strong className="block font-mono text-sm text-ink">{value}</strong><span className="text-[9px] font-semibold uppercase tracking-wide text-ink-mute">{label}</span></div>;
}

export function MobilePlayerRowSkeleton() {
  return <div className="mb-3 animate-pulse rounded-2xl border border-line bg-surface-2 p-3"><div className="flex items-center gap-3"><div className="h-12 w-12 rounded-full bg-surface-1" /><div className="flex-1"><div className="mb-2 h-4 w-32 rounded bg-surface-1" /><div className="h-3 w-24 rounded bg-surface-1" /></div></div></div>;
}
