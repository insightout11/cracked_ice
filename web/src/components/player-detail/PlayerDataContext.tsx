import { CalendarClock } from 'lucide-react';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { SEASON_LABEL } from '../../lib/season';

interface PlayerDataContextProps {
  player: RosterPlayer;
  compact?: boolean;
}

function seasonLabel(seasonId?: string): string {
  if (!seasonId || !/^\d{8}$/.test(seasonId)) return 'Prior-season';
  return `${seasonId.slice(0, 4)}–${seasonId.slice(6)}`;
}

export function PlayerDataContext({ player, compact = false }: PlayerDataContextProps) {
  const performanceSeason = seasonLabel(player.statsSeason);
  const updated = player.statsGeneratedAt
    ? new Date(player.statsGeneratedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-0 text-ink-dim ${compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-xs'}`}>
      <CalendarClock className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <span><strong className="text-ink">Performance:</strong> {performanceSeason}</span>
      <span aria-hidden="true" className="text-ink-mute">•</span>
      <span><strong className="text-ink">Schedule:</strong> {SEASON_LABEL}</span>
      {updated && <><span aria-hidden="true" className="text-ink-mute">•</span><span>Stats updated {updated}</span></>}
    </div>
  );
}
