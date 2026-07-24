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
  const candidates: Array<{
    player: DraftPlayer;
    option: DraftCandidateScore;
    barClass: string;
    borderClass: string;
    textClass: string;
  }> = [
    {
      player: playerA,
      option: analysis.optionA,
      barClass: 'bg-accent/45',
      borderClass: 'border-accent/40',
      textClass: 'text-accent',
    },
    {
      player: playerB,
      option: analysis.optionB,
      barClass: 'bg-positive/35',
      borderClass: 'border-positive/35',
      textClass: 'text-positive',
    },
  ];

  return <section className="rounded-xl border border-line-strong bg-surface-1 p-5 shadow-card" aria-labelledby="draft-score-heading">
    <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="scoreboard-text text-accent">Strategy score</p>
        <h2 id="draft-score-heading" className="mt-1 text-xl font-semibold text-ink">Why the recommendation changes</h2>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">Factors are normalized from 0–100 against the league player and team distributions, then weighted by <strong className="font-semibold text-ink">{analysis.strategyLabel}</strong>.</p>
    </div>

    <div className="mt-5 sm:hidden">
      <div className="grid grid-cols-2 gap-3">
        <strong className="truncate text-sm text-accent">{playerA.name}</strong>
        <strong className="truncate text-sm text-positive">{playerB.name}</strong>
      </div>
      <div className="mt-3 space-y-4">
        {rows.map((key) => <div key={key}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-dim">{LABELS[key]}</p>
          <div className="grid grid-cols-2 gap-3">
            {candidates.map(({ option, barClass }) => <div key={`${option.playerId}-${key}`} className="relative h-9 overflow-hidden rounded-md border border-line-strong bg-surface-0" title={`${LABELS[key]}: ${option.components[key].toFixed(0)} / 100`}>
              <span className={`absolute inset-y-0 left-0 ${barClass}`} style={{ width: `${option.components[key]}%` }} />
              <strong className="relative flex h-full items-center justify-end px-2 font-mono text-xs text-ink">{option.components[key].toFixed(0)}</strong>
            </div>)}
          </div>
        </div>)}
      </div>
    </div>

    <div className="mt-5 hidden grid-cols-[minmax(10rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-x-3 gap-y-3 text-sm sm:grid">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Factor</span>
      <strong className="truncate text-right text-sm text-accent">{playerA.name}</strong>
      <strong className="truncate text-right text-sm text-positive">{playerB.name}</strong>
      {rows.map((key) => <div key={key} className="contents">
        <span className="self-center text-sm font-medium text-ink-dim">{LABELS[key]}</span>
        {candidates.map(({ option, barClass }) => <div key={`${option.playerId}-${key}`} className="relative h-9 overflow-hidden rounded-md border border-line-strong bg-surface-0" title={`${LABELS[key]}: ${option.components[key].toFixed(0)} / 100`}>
          <span className={`absolute inset-y-0 left-0 ${barClass}`} style={{ width: `${option.components[key]}%` }} />
          <strong className="relative flex h-full items-center justify-end px-2 font-mono text-xs text-ink">{option.components[key].toFixed(0)}</strong>
        </div>)}
      </div>)}
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {candidates.map(({ player, option, borderClass, textClass }) => <article key={player.id} className={`rounded-lg border bg-surface-0 p-4 ${borderClass}`}>
        <div className="flex items-center justify-between">
          <strong className={`truncate text-base ${textClass}`}>{player.name}</strong>
          <span className={`font-mono text-xl font-bold ${textClass}`}>{option.total}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div><dt className="text-ink-dim">Regular season</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.regularUsableStarts} usable · {option.metrics.regularOffNights} off-night</dd></div>
          <div><dt className="text-ink-dim">Fantasy playoffs</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.playoffUsableStarts} usable · {option.metrics.playoffOffNights} off-night</dd></div>
          <div><dt className="text-ink-dim">League FPPG</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.fppg.toFixed(2)}</dd></div>
          <div><dt className="text-ink-dim">Value over replacement</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.valueOverReplacement >= 0 ? '+' : ''}{option.metrics.valueOverReplacement.toFixed(2)} FPPG</dd></div>
        </dl>
      </article>)}
    </div>

    <PlayoffWeekComparison candidates={candidates.map(({ player, option }) => ({ name: player.name, score: option }))} />
  </section>;
}
