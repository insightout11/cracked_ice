import { Minus, Plus } from 'lucide-react';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { acquisitionPeriodStart, movesUsedThisPeriod } from '../../lib/leagueWorkspace';

/**
 * Adds used this period, adjustable right where pickups are decided. Saves the count
 * with a timestamp so it resets on its own when the league's next week starts.
 */
export function AddsUsedControl() {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const { limit, period } = activeLeague.acquisitions;
  if (limit === null) return <span className="text-xs text-ink-mute">No add limit set in League settings</span>;

  const used = movesUsedThisPeriod(activeLeague);
  const periodLabel = period === 'season' ? 'season' : 'week';
  const setUsed = (value: number) => {
    const now = new Date().toISOString();
    updateLeague({
      ...activeLeague,
      acquisitions: { ...activeLeague.acquisitions, movesUsed: Math.min(limit, Math.max(0, value)), observedAt: now },
      updatedAt: now,
    });
  };
  const resets = period === 'season' ? null : new Date(`${acquisitionPeriodStart(activeLeague)}T12:00:00Z`);
  if (resets) resets.setUTCDate(resets.getUTCDate() + 7);

  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1" role="group" aria-label={`Adds used this ${periodLabel}`}>
      <span className="text-xs text-ink-dim">Adds used this {periodLabel}</span>
      <button type="button" className="rounded p-1 text-ink-dim hover:bg-surface-1 hover:text-accent disabled:opacity-40" onClick={() => setUsed(used - 1)} disabled={used <= 0} aria-label="One fewer add used"><Minus size={14} /></button>
      <span className="scoreboard-number min-w-[3ch] text-center text-sm text-ink" aria-live="polite">{used}/{limit}</span>
      <button type="button" className="rounded p-1 text-ink-dim hover:bg-surface-1 hover:text-accent disabled:opacity-40" onClick={() => setUsed(used + 1)} disabled={used >= limit} aria-label="One more add used"><Plus size={14} /></button>
      {resets && <span className="hidden text-[10px] text-ink-mute sm:inline">resets {resets.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>}
    </div>
  );
}
