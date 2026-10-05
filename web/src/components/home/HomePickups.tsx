import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { finderDays } from '../../lib/pickupFinder';
import { usePickupFinder } from '../../hooks/usePickupFinder';
import { AddAdviceSummary } from '../team/PickupFinder';
import type { PlayerSearchResult } from '../../types';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

/** Home: this week's add advice and the top three pickups, from the same finder as My Team. */
export function HomePickups({ workspace, directory }: { workspace: LeagueWorkspace; directory: PlayerSearchResult[] | undefined }) {
  const days = finderDays(workspace, 'week');
  const result = usePickupFinder({ workspace, directory, days });
  return (
    <section className="rounded-2xl border border-line-strong bg-surface-1 p-5 sm:p-6" aria-labelledby="home-pickups-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-pickups-title" className="text-xl font-semibold text-ink">This week's pickups</h2>
        <Link to="/team#pickup-board" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">See all pickups<ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      {result.status !== 'ready' && <p className="mt-3 text-sm text-ink-dim" aria-live="polite">{result.status === 'error' ? "The NHL schedule couldn't be loaded. Try again shortly." : 'Working out who fits your lineup this week…'}</p>}
      {result.advice && <div className="mt-3"><AddAdviceSummary advice={result.advice} compact /></div>}
      {result.status === 'ready' && (
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {result.pickups.slice(0, 3).map((pickup) => (
            <li key={pickup.player.id} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="truncate text-sm font-semibold text-ink">{pickup.player.name} <span className="text-[11px] font-normal text-ink-mute">{pickup.player.team} · {pickup.player.pos.join('/')}</span></p>
              <p className="scoreboard-number mt-1 text-lg font-bold text-positive">{signed(pickup.gain)} <span className="text-xs font-normal text-ink-mute">pts</span></p>
              <p className="text-xs text-ink-dim">fills {Number.isInteger(pickup.fills) ? pickup.fills : pickup.fills.toFixed(1)} of {pickup.games} games · {pickup.drop ? `drop ${pickup.drop.full_name}` : 'no drop needed'}</p>
            </li>
          ))}
          {result.pickups.length === 0 && <li className="text-sm text-ink-dim sm:col-span-3">Nobody available improves your lineup this week.</li>}
        </ol>
      )}
    </section>
  );
}
