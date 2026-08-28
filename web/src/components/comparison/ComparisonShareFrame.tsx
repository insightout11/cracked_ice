import { forwardRef } from 'react';
import type { PlayerComparisonAnalysis } from '../../lib/playerComparisonAnalysis';
import type { DraftStrategyComparison } from '../../lib/draftStrategy';
import type { KeeperComparison } from '../../lib/keeperAnalysis';
import { mugshotSeason } from '../../lib/season';

interface ComparisonShareFrameProps {
  analysis: PlayerComparisonAnalysis;
  leagueName: string;
  scoringLabel: string;
  sourceSeason: string;
  start: string;
  end: string;
  draftAnalysis?: DraftStrategyComparison | null;
  keeperAnalysis?: KeeperComparison | null;
}

const CONTEXT_LABELS = { draft: 'DRAFT COMPARISON', pickup: 'PICKUP DECISION', roster: 'ROSTER DECISION' } as const;
const AVAILABILITY_LABELS = { owned: 'On roster', confirmed: 'Available · confirmed', stale: 'Availability stale', unknown: 'Availability unknown' } as const;

function availabilityLabel(analysis: PlayerComparisonAnalysis, availability: keyof typeof AVAILABILITY_LABELS): string {
  return analysis.context === 'draft' && availability !== 'owned' ? 'Draft candidate' : AVAILABILITY_LABELS[availability];
}

export const ComparisonShareFrame = forwardRef<HTMLDivElement, ComparisonShareFrameProps>(function ComparisonShareFrame({ analysis, leagueName, scoringLabel, sourceSeason, start, end, draftAnalysis, keeperAnalysis }, ref) {
  const options = [analysis.optionA, analysis.optionB];
  return <div ref={ref} className="h-[675px] w-[1200px] overflow-hidden bg-surface-0 px-14 py-10 text-ink">
    <header className="flex items-center justify-between border-b border-line pb-6"><div><p className="scoreboard-text text-lg text-accent">CRACKED ICE</p><p className="mt-1 text-sm text-ink-mute">PLAYER DECISION</p></div><p className="font-mono text-sm text-ink-dim">{start} — {end}</p></header>
    <div className="pt-7">
      <p className="scoreboard-text text-accent">{keeperAnalysis ? 'KEEPER COMPARISON' : CONTEXT_LABELS[analysis.context]}</p><h2 className="brand-title mt-2 text-4xl">{analysis.verdict}</h2><p className="mt-2 text-lg text-ink-dim">{analysis.explanation}</p>
      <div className="mt-7 grid grid-cols-2 gap-5">{options.map((option) => <section key={option.player.id} className={`rounded-xl border p-5 ${analysis.winnerId === option.player.id ? 'border-accent bg-accent-muted' : 'border-line bg-surface-1'}`}>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={`/api/coach/share-assets/headshot/${mugshotSeason}/${option.player.team}/${option.player.id.replace(/^nhl:/, '')}`}
              alt=""
              crossOrigin="anonymous"
              className="size-20 rounded-full border border-line bg-surface-0 object-cover"
            />
            <img src={`/api/coach/share-assets/logo/${option.player.team}`} alt="" className="absolute -bottom-1 -right-1 size-8 object-contain" />
          </div>
          <div><h3 className="text-2xl font-bold">{option.player.full_name}</h3><p className="text-sm text-ink-dim">{option.player.team} · {option.player.positions.join('/')} · {availabilityLabel(analysis, option.availability)}</p></div>
        </div>
        {keeperAnalysis ? (() => { const keeper = option.player.id.replace(/^nhl:/, '') === keeperAnalysis.optionA.playerId.replace(/^nhl:/, '') ? keeperAnalysis.optionA : keeperAnalysis.optionB; return <div className="mt-5 grid grid-cols-4 gap-3"><Metric label="FPPG" value={option.fppg.toFixed(2)} /><Metric label="Age" value={keeper.age?.toString() ?? '—'} /><Metric label="NHL GP" value={String(keeper.evidence.nhlGamesPlayed)} /><Metric label="Keeper profile" value={keeper.total.toFixed(1)} /></div>; })() : draftAnalysis ? (() => { const draft = option.player.id.replace(/^nhl:/, '') === draftAnalysis.optionA.playerId.replace(/^nhl:/, '') ? draftAnalysis.optionA : draftAnalysis.optionB; return <div className="mt-5 grid grid-cols-4 gap-3"><Metric label="FPPG" value={option.fppg.toFixed(2)} /><Metric label="Regular starts" value={String(draft.metrics.regularUsableStarts)} /><Metric label="Playoff starts" value={String(draft.metrics.playoffUsableStarts)} /><Metric label="Draft score" value={draft.total.toFixed(1)} /></div>; })() : <div className="mt-5 grid grid-cols-4 gap-3"><Metric label="FPPG" value={option.fppg.toFixed(2)} /><Metric label="Games" value={String(option.games)} /><Metric label="Usable" value={String(option.usableStarts)} /><Metric label="Usable pts" value={option.usablePoints.toFixed(1)} /></div>}
      </section>)}</div>
    </div>
    <footer className="mt-7 flex items-center justify-between gap-6 border-t border-line pt-5 text-sm text-ink-mute"><span>{leagueName} · {scoringLabel} · {keeperAnalysis ? keeperAnalysis.horizonLabel : draftAnalysis ? `${draftAnalysis.strategyLabel} draft strategy` : 'schedule-aware lineup simulation'} · {sourceSeason} stats</span><span className="shrink-0 text-accent">crackedicehockey.com</span></footer>
  </div>;
});

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-surface-0 p-3"><strong className="block font-mono text-2xl">{value}</strong><span className="text-xs text-ink-mute">{label}</span></div>;
}
