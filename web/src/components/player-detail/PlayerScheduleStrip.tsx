import { CalendarDays, Moon, TriangleAlert } from 'lucide-react';
import type { PlayerProjection } from '../../lib/coachSchemas';

interface PlayerScheduleStripProps {
  projection?: PlayerProjection;
}

export function PlayerScheduleStrip({ projection }: PlayerScheduleStripProps) {
  const games = Object.entries(projection?.gamesByDate ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 14);

  if (!projection || games.length === 0) {
    return <div className="rounded-xl border border-line bg-surface-0 p-5 text-sm text-ink-dim">No NHL games fall inside the selected window.</div>;
  }

  return (
    <figure className="rounded-xl border border-line bg-surface-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="scoreboard-text text-accent">Selected window</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">Lineup-fit schedule</h3>
          <p className="mt-1 text-xs text-ink-mute">Games are classified by whether this roster can use the start.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-ink-dim">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" />Usable</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />Blocked</span>
          <span className="flex items-center gap-1.5"><Moon size={12} className="text-accent" />Off-night</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-14">
        {games.map(([date, game]) => {
          const usable = (projection.startsByDate?.[date] ?? 0) > 0;
          return (
            <div key={date} className={`relative rounded-lg border p-2 text-center ${usable ? 'border-positive/40 bg-positive-muted' : 'border-warning/40 bg-warning-muted'}`}>
              {game.isOffNight && <Moon size={12} className="absolute right-1.5 top-1.5 text-accent" aria-label="Off-night" />}
              <span className="block text-[10px] uppercase text-ink-mute">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <strong className="scoreboard-number mt-1 block text-sm text-ink">{new Date(`${date}T12:00:00`).getDate()}</strong>
              <span className="mt-1 block truncate text-[10px] text-ink-dim">{game.isHome ? 'vs' : '@'} {game.opponent}</span>
              <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${usable ? 'text-positive' : 'text-warning'}`}>
                {usable ? <CalendarDays size={10} /> : <TriangleAlert size={10} />}{usable ? 'Start' : 'Blocked'}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 text-xs text-ink-mute">{projection.starts} usable starts from {projection.gamesAvailable} scheduled games · {Math.max(0, projection.gamesAvailable - projection.starts)} blocked by lineup capacity.</figcaption>
    </figure>
  );
}
