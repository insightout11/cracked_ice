import type { DraftCandidateScore, DraftStrategyComparison, DraftScoreKey } from '../../lib/draftStrategy';
import type { DraftPlayer } from '../../lib/playerSearch';
import { PlayoffWeekComparison } from './PlayoffWeekComparison';

interface DraftStrategyBreakdownProps {
  analysis: DraftStrategyComparison;
  playerA: DraftPlayer;
  playerB: DraftPlayer;
}

const LABELS: Record<DraftScoreKey, string> = {
  production: 'Production',
  regularSeason: 'Regular season',
  playoffs: 'Fantasy playoffs',
  positionValue: 'Position value',
};

export function DraftStrategyBreakdown({ analysis, playerA, playerB }: DraftStrategyBreakdownProps) {
  const rows = Object.keys(LABELS) as DraftScoreKey[];
  const candidates: Array<{ player: DraftPlayer; option: DraftCandidateScore }> = [
    { player: playerA, option: analysis.optionA },
    { player: playerB, option: analysis.optionB },
  ];
  return <section className="rounded-xl border border-line-strong bg-surface-glass p-5 shadow-card" aria-labelledby="draft-score-heading">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="scoreboard-text text-accent">Strategy score</p><h2 id="draft-score-heading" className="mt-1 text-xl font-semibold text-ink">Why the recommendation changes</h2></div>
      <p className="text-xs text-ink-mute">Factors are normalized from 0–100 against the league player and team distributions, then weighted by {analysis.strategyLabel}.</p>
    </div>
    <div className="mt-5 grid grid-cols-[minmax(7rem,1fr)_4rem_4rem] gap-x-3 gap-y-3 text-sm sm:grid-cols-[minmax(10rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)]">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Factor</span><strong className="truncate text-right text-xs text-ink">{playerA.name}</strong><strong className="truncate text-right text-xs text-ink">{playerB.name}</strong>
      {rows.map((key) => <div key={key} className="contents">
        <span className="self-center text-xs text-ink-dim">{LABELS[key]}</span>
        {[analysis.optionA, analysis.optionB].map((option) => <div key={`${option.playerId}-${key}`} className="relative h-8 overflow-hidden rounded-md border border-line bg-surface-0" title={`${LABELS[key]}: ${option.components[key].toFixed(0)} / 100`}>
          <span className="absolute inset-y-0 left-0 bg-accent-muted" style={{ width: `${option.components[key]}%` }} />
          <strong className="relative flex h-full items-center justify-end px-2 font-mono text-xs text-ink">{option.components[key].toFixed(0)}</strong>
        </div>)}
      </div>)}
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {candidates.map(({ player, option }) => <article key={player.id} className="rounded-lg border border-line bg-surface-0 p-3">
          <div className="flex items-center justify-between"><strong className="truncate text-sm text-ink">{player.name}</strong><span className="font-mono text-xl font-bold text-accent">{option.total}</span></div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-ink-mute">Regular season</dt><dd className="font-semibold text-ink">{option.metrics.regularUsableStarts} usable · {option.metrics.regularOffNights} off-night</dd></div>
            <div><dt className="text-ink-mute">Fantasy playoffs</dt><dd className="font-semibold text-ink">{option.metrics.playoffUsableStarts} usable · {option.metrics.playoffOffNights} off-night</dd></div>
            <div><dt className="text-ink-mute">League FPPG</dt><dd className="font-semibold text-ink">{option.metrics.fppg.toFixed(2)}</dd></div>
            <div><dt className="text-ink-mute">Value over replacement</dt><dd className="font-semibold text-ink">{option.metrics.valueOverReplacement >= 0 ? '+' : ''}{option.metrics.valueOverReplacement.toFixed(2)} FPPG</dd></div>
          </dl>
        </article>)}
    </div>
    <PlayoffWeekComparison candidates={candidates.map(({ player, option }) => ({ name: player.name, score: option }))} />
  </section>;
}
