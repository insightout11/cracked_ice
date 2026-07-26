import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Trophy } from 'lucide-react';
import type { RankedDraftCandidate } from '../../lib/draftStrategy';
import { getTeamLogoUrl } from '../../utils/teamLogos';

interface DraftTargetListProps {
  candidates: RankedDraftCandidate[];
  strategyLabel: string;
  compareFromId?: string;
}

export function DraftTargetList({ candidates, strategyLabel, compareFromId }: DraftTargetListProps) {
  if (candidates.length === 0) return null;
  return <section className="mt-5 border-t border-line pt-4" aria-labelledby="draft-target-heading">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="scoreboard-text text-accent">Draft targets</p><h3 id="draft-target-heading" className="text-lg font-semibold text-ink">Best players for {strategyLabel}</h3></div>
      <p className="text-xs text-ink-mute">League production + regular season + your playoff dates + positional value</p>
    </div>
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      {candidates.slice(0, 3).map(({ player, score }, index) => {
        const compareUrl = compareFromId ? `/compare?mode=draft&a=${compareFromId.replace(/^nhl:/, '')}&b=${player.id.replace(/^nhl:/, '')}` : null;
        return <article key={player.id} className="rounded-lg border border-line bg-surface-0 p-3">
          <div className="flex items-center gap-3"><span className="font-mono text-xs text-ink-mute">#{index + 1}</span><img src={getTeamLogoUrl(player.team)} alt="" className="size-8 object-contain" /><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{player.name}</strong><span className="text-xs text-ink-mute">{player.pos.join('/')} · {player.team}</span></div><span className="font-mono text-xl font-bold text-accent">{score.total}</span></div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><div><strong className="block text-ink">{score.metrics.projectedFppg.toFixed(2)}</strong><span className="text-ink-mute">projected</span></div><div><strong className="flex items-center justify-center gap-1 text-ink"><CalendarDays size={12} />{score.metrics.regularUsableStarts}</strong><span className="text-ink-mute">regular</span></div><div><strong className="flex items-center justify-center gap-1 text-positive"><Trophy size={12} />{score.metrics.playoffUsableStarts}</strong><span className="text-ink-mute">playoffs</span></div><div><strong className="block text-accent">{score.metrics.playoffOffNights}</strong><span className="text-ink-mute">PO off</span></div></div>
          {compareUrl && <Link to={compareUrl} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">Compare with anchor <ArrowRight size={13} /></Link>}
        </article>;
      })}
    </div>
  </section>;
}
