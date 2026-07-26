import type { DraftCandidateScore, DraftStrategyComparison, DraftScoreKey } from '../../lib/draftStrategy';
import type { DraftPlayer } from '../../lib/playerSearch';
import { PlayoffWeekComparison } from './PlayoffWeekComparison';

interface DraftStrategyBreakdownProps {
  analysis: DraftStrategyComparison;
  playerA: DraftPlayer;
  playerB: DraftPlayer;
}

interface CandidateStyle {
  option: DraftCandidateScore;
  barClass: string;
  borderClass: string;
  textClass: string;
}

const LABELS: Record<DraftScoreKey, string> = {
  production: 'Production',
  regularSeason: 'Regular season',
  playoffs: 'Fantasy playoffs',
  positionValue: 'Position market',
};

export function DraftStrategyBreakdown({ analysis, playerA, playerB }: DraftStrategyBreakdownProps) {
  const rows = Object.keys(LABELS) as DraftScoreKey[];
  const candidates: Array<{
    player: DraftPlayer;
  } & CandidateStyle> = [
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
      barClass: 'bg-positive/50',
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
      <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">Production and schedule factors are normalized from 0–100. Position market measures league-wide scarcity plus useful multi-position eligibility, then everything is weighted by <strong className="font-semibold text-ink">{analysis.strategyLabel}</strong>. <span className="text-ink">Edge</span> marks the stronger player in each factor.</p>
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
            {candidates.map((candidate, index) => <FactorBar key={`${candidate.option.playerId}-${key}`} candidate={candidate} factor={key} competitor={candidates[index === 0 ? 1 : 0].option} />)}
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
        {candidates.map((candidate, index) => <FactorBar key={`${candidate.option.playerId}-${key}`} candidate={candidate} factor={key} competitor={candidates[index === 0 ? 1 : 0].option} />)}
      </div>)}
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {candidates.map(({ player, option, borderClass, textClass }) => <article key={player.id} className={`rounded-lg border bg-surface-0 p-4 ${borderClass}`}>
        <div className="flex items-center justify-between">
          <strong className={`truncate text-base ${textClass}`}>{player.name}</strong>
          <span className={`font-mono text-xl font-bold ${textClass}`}>{option.total}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div><dt className="text-ink-dim">Regular season</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.regularUsableStarts} usable · {option.metrics.regularOffNights} off-night</dd></div>
          <div><dt className="text-ink-dim">Fantasy playoffs</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.playoffUsableStarts} usable · {option.metrics.playoffOffNights} off-night</dd></div>
          <div><dt className="text-ink-dim">League FPPG</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.fppg.toFixed(2)}</dd></div>
          <div><dt className="text-ink-dim">Next-season projection</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.projectedFppg.toFixed(2)} <span className={projectionTone(option.metrics.projectionTrajectory)}>({formatDelta(option.metrics.projectionDeltaPercent)})</span></dd></div>
          <div><dt className="text-ink-dim">Projection outlook</dt><dd className="mt-0.5 font-semibold capitalize text-ink">{option.metrics.projectionTrajectory} <span className="font-normal text-ink-mute">· {option.metrics.projectionConfidence} confidence{player.pos.includes('G') ? ` · ${option.metrics.projectedGames} GP · ${option.metrics.projectionVolatility} volatility` : ''}</span></dd></div>
          <div><dt className="text-ink-dim">Projected above replacement</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.valueOverReplacement >= 0 ? '+' : ''}{option.metrics.valueOverReplacement.toFixed(2)} FPPG <span className="font-normal text-ink-mute">vs {option.metrics.replacementPosition ?? 'position'} ({option.metrics.replacementFppg.toFixed(2)})</span></dd></div>
          <div><dt className="text-ink-dim">Position market</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.marketScarcity.toFixed(0)} {option.metrics.marketPosition ?? 'position'} scarcity{option.metrics.flexibilityBonus > 0 ? <span className="font-normal text-positive"> + {option.metrics.flexibilityBonus.toFixed(0)} eligibility</span> : null}</dd></div>
        </dl>
        <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-mute">{option.metrics.projectionReasons.slice(0, 2).join(' · ')}</p>
      </article>)}
    </div>

    <PlayoffWeekComparison candidates={candidates.map(({ player, option }) => ({ name: player.name, score: option }))} />
  </section>;
}

function projectionTone(trajectory: DraftCandidateScore['metrics']['projectionTrajectory']): string {
  return trajectory === 'rising' ? 'text-positive' : trajectory === 'declining' ? 'text-warning' : 'text-ink-mute';
}

function formatDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function FactorBar({ candidate, factor, competitor }: { candidate: CandidateStyle; factor: DraftScoreKey; competitor: DraftCandidateScore }) {
  const value = candidate.option.components[factor];
  const competitorValue = competitor.components[factor];
  const isWinner = value > competitorValue;
  const isTie = value === competitorValue;
  const stateLabel = isWinner ? 'Edge' : isTie ? 'Even' : null;

  return <div
    className={`relative h-9 overflow-hidden rounded-md border bg-surface-0 ${isWinner ? `${candidate.borderClass} ring-1 ring-current/10` : 'border-line-strong'}`}
    title={`${LABELS[factor]}: ${value.toFixed(0)} / 100${isWinner ? ' — stronger factor' : isTie ? ' — even' : ''}`}
    aria-label={`${LABELS[factor]} ${value.toFixed(0)} out of 100${isWinner ? ', edge' : isTie ? ', even' : ''}`}
  >
    <span className={`absolute inset-y-0 left-0 ${candidate.barClass}`} style={{ width: `${value}%` }} />
    <span className="relative flex h-full items-center justify-between gap-2 px-2">
      <span className={`text-[9px] font-bold uppercase tracking-wider ${stateLabel ? candidate.textClass : 'text-transparent'}`}>{stateLabel ?? 'No edge'}</span>
      <strong className="font-mono text-xs text-ink">{value.toFixed(0)}</strong>
    </span>
  </div>;
}
