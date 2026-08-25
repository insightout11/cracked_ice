import { useEffect } from 'react';
import { ArrowLeftRight, CalendarDays, ChartNoAxesCombined, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DraftCandidateContext, DraftMarketContext } from '../../lib/draftRoom';
import type { RankedDraftCandidate } from '../../lib/draftStrategy';
import { DRAFT_PROJECTION_MODEL } from '../../lib/draftProjection';
import { mugshotSeason } from '../../lib/season';
import { getTeamLogoUrl } from '../../lib/teamLogos';

interface DraftPlayerProfileModalProps {
  candidate: RankedDraftCandidate;
  context?: DraftCandidateContext;
  market?: DraftMarketContext;
  statsSeason?: string;
  onClose: () => void;
}

function formatValue(value: number | null | undefined, digits = 1) {
  return value == null ? '—' : value.toFixed(digits);
}

export function DraftPlayerProfileModal({ candidate, context, market, statsSeason = 'Prior-season', onClose }: DraftPlayerProfileModalProps) {
  const { player, score } = candidate;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const components = [
    ['Projected value', score.components.production],
    ['Regular-season fit', score.components.regularSeason],
    ['Playoff fit', score.components.playoffs],
    ['Position value', score.components.positionValue],
  ] as const;
  const valueLabel = market?.valueVsAdp == null
    ? 'Yahoo market value unavailable'
    : market.valueVsAdp > 0
      ? `${market.valueVsAdp.toFixed(1)} picks later than our rank`
      : market.valueVsAdp < 0
        ? `${Math.abs(market.valueVsAdp).toFixed(1)} picks earlier than our rank`
        : 'Yahoo ADP matches our rank';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-glass/95 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="draft-player-profile-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-1 shadow-2xl">
      <header className="relative flex items-start gap-4 border-b border-line bg-surface-2 p-4 sm:p-6">
        <div className="relative shrink-0">
          <img src={`https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${player.team}/${player.id.replace(/^nhl:/, '')}.png`} alt="" className="size-16 rounded-full border border-line bg-surface-0 object-cover sm:size-20" />
          <img src={getTeamLogoUrl(player.team)} alt="" className="absolute -bottom-1 -right-1 size-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="scoreboard-text text-accent">FULL DRAFT PROFILE</p>
          <h2 id="draft-player-profile-title" className="mt-1 truncate text-2xl font-bold text-ink sm:text-3xl">{player.name}</h2>
          <p className="mt-1 text-sm text-ink-dim">{player.pos.join('/')} · {player.team} · {score.metrics.projectionTrajectory} outlook · {score.metrics.projectionConfidence} confidence</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
            <span className="rounded-full border border-accent bg-accent-muted px-2.5 py-1 text-accent">Cracked Ice #{market?.crackedIceRank ?? '—'}</span>
            <span className="rounded-full border border-line bg-surface-0 px-2.5 py-1 text-ink-dim">{DRAFT_PROJECTION_MODEL.label}</span>
            <span className="rounded-full border border-line bg-surface-0 px-2.5 py-1 text-ink-dim">Yahoo ADP {formatValue(player.yahooAdp)}</span>
            <span className={`rounded-full border px-2.5 py-1 ${market?.valueVsAdp != null && market.valueVsAdp > 0 ? 'border-positive bg-positive-muted text-positive' : 'border-line bg-surface-0 text-ink-dim'}`}>{valueLabel}</span>
          </div>
        </div>
        <button type="button" aria-label="Close full player profile" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink-dim hover:border-accent hover:text-accent"><X size={18} /></button>
      </header>

      <div className="overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ProfileMetric label="Draft score" value={score.total.toFixed(1)} accent />
          <ProfileMetric label="CI projected FPPG" value={score.metrics.projectedFppg.toFixed(2)} />
          <ProfileMetric label={`${statsSeason} FPPG`} value={score.metrics.fppg.toFixed(2)} />
          <ProfileMetric label="Projected points" value={score.metrics.projectedFantasyPoints.toFixed(1)} />
          <ProfileMetric label="Playoff starts" value={String(score.metrics.playoffUsableStarts)} positive />
          <ProfileMetric label="Final-week starts" value={String(score.metrics.championshipWeek.usableStarts)} positive />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-surface-0 p-4">
            <div className="flex items-center gap-2"><ChartNoAxesCombined size={16} className="text-accent" /><h3 className="font-semibold text-ink">Why the score looks like this</h3></div>
            <div className="mt-3 rounded-lg border border-line bg-surface-1 p-3 text-xs text-ink-dim"><strong className="text-ink">Projection source:</strong> {DRAFT_PROJECTION_MODEL.label}. {DRAFT_PROJECTION_MODEL.methodology}.<p className="mt-1 text-ink-mute">{DRAFT_PROJECTION_MODEL.limitations}</p></div>
            <div className="mt-4 space-y-3">{components.map(([label, value]) => <div key={label}><div className="flex justify-between text-xs text-ink-dim"><span>{label}</span><strong className="font-mono text-ink">{value.toFixed(0)}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, value)}%` }} /></div></div>)}</div>
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-ink-dim">{score.metrics.projectionReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
          </section>

          <section className="rounded-xl border border-line bg-surface-0 p-4">
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-positive" /><h3 className="font-semibold text-ink">Draft decision</h3></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <ProfileDetail label="Tier" value={context ? `${context.position} Tier ${context.tier}` : '—'} />
              <ProfileDetail label="Next positional drop" value={context ? `${context.dropToNextAtPosition} points` : '—'} />
              <ProfileDetail label="Comparable options" value={String(context?.similarAtPosition ?? '—')} />
              <ProfileDetail label="Value over replacement" value={score.metrics.valueOverReplacement.toFixed(2)} />
              <ProfileDetail label="Projected games" value={String(score.metrics.projectedGames)} />
              <ProfileDetail label="Projection volatility" value={score.metrics.projectionVolatility} />
            </dl>
            <p className={`mt-4 rounded-lg border p-3 text-sm ${context?.advice === 'take-now' ? 'border-warning bg-warning-muted text-warning' : context?.advice === 'can-wait' ? 'border-positive bg-positive-muted text-positive' : 'border-line bg-surface-1 text-ink-dim'}`}>{context?.advice === 'take-now' ? `The next ${context.position} tier drop is meaningful. Waiting is relatively expensive.` : context?.advice === 'can-wait' ? `Comparable ${context.position} options remain. You may be able to wait.` : 'This is a close decision. Use roster construction and market timing as the tiebreakers.'}</p>
          </section>

          <section className="rounded-xl border border-line bg-surface-0 p-4 lg:col-span-2">
            <div className="flex items-center gap-2"><CalendarDays size={16} className="text-positive" /><h3 className="font-semibold text-ink">Fantasy-playoff schedule</h3></div>
            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, score.metrics.playoffWeeks.length)}, minmax(0, 1fr))` }}>{score.metrics.playoffWeeks.map((week) => <div key={week.start} className={`rounded-lg border p-3 text-center ${week.isChampionship ? 'border-positive bg-positive-muted' : 'border-line bg-surface-1'}`}><span className="block text-[10px] uppercase tracking-wide text-ink-mute">{week.isChampionship ? 'Final' : `Week ${week.index}`}</span><strong className={`mt-1 block font-mono text-lg ${week.isChampionship ? 'text-positive' : 'text-ink'}`}>{week.usableStarts}/{week.games}</strong><span className="text-[9px] text-ink-mute">usable / games</span></div>)}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><ProfileDetail label="Regular-season usable starts" value={String(score.metrics.regularUsableStarts)} /><ProfileDetail label="Fantasy-season usable starts" value={String(score.metrics.fantasySeasonUsableStarts)} /><ProfileDetail label="Playoff off-nights" value={String(score.metrics.playoffOffNights)} /></div>
          </section>

          {player.scoringBreakdown?.contributions?.length ? <section className="rounded-xl border border-line bg-surface-0 p-4 lg:col-span-2"><h3 className="font-semibold text-ink">League scoring contribution</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...player.scoringBreakdown.contributions].filter((item) => item.fantasyPoints !== 0).sort((a, b) => Math.abs(b.fantasyPoints) - Math.abs(a.fantasyPoints)).slice(0, 9).map((item) => <div key={item.key} className="flex items-center justify-between rounded-lg border border-line bg-surface-1 px-3 py-2 text-xs"><span className="uppercase text-ink-dim">{item.key.replace(/_/g, ' ')}</span><strong className="font-mono text-ink">{item.fantasyPoints.toFixed(1)}</strong></div>)}</div></section> : null}

          {player.recentSeasons?.length ? <section className="rounded-xl border border-line bg-surface-0 p-4 lg:col-span-2"><h3 className="font-semibold text-ink">Recent NHL seasons</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-xs"><thead className="text-ink-mute"><tr><th className="pb-2">Season</th><th className="pb-2">Games</th><th className="pb-2">Points/game</th><th className="pb-2">Save %</th></tr></thead><tbody className="divide-y divide-line">{player.recentSeasons.map((season) => <tr key={season.season}><td className="py-2 font-semibold text-ink">{season.season}</td><td className="py-2 font-mono text-ink-dim">{season.gamesPlayed}</td><td className="py-2 font-mono text-ink-dim">{formatValue(season.pointsPerGame, 2)}</td><td className="py-2 font-mono text-ink-dim">{formatValue(season.savePct, 3)}</td></tr>)}</tbody></table></div></section> : null}
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-mute">Cracked Ice rank uses your league scoring, roster shape, strategy, and fantasy-playoff dates.</p>
        <Link to={`/compare?mode=draft&a=${player.id.replace(/^nhl:/, '')}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-accent px-4 text-xs font-bold text-accent hover:bg-accent-muted"><ArrowLeftRight size={15} />Compare this player</Link>
      </footer>
    </div>
  </div>;
}

function ProfileMetric({ label, value, accent = false, positive = false }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return <div className="rounded-lg border border-line bg-surface-0 p-3"><strong className={`block font-mono text-xl ${accent ? 'text-accent' : positive ? 'text-positive' : 'text-ink'}`}>{value}</strong><span className="mt-1 block text-[10px] text-ink-mute">{label}</span></div>;
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-surface-1 p-3"><span className="block text-[10px] text-ink-mute">{label}</span><strong className="mt-1 block font-semibold capitalize text-ink">{value}</strong></div>;
}
