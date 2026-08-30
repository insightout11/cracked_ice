import type { DraftCandidateScore, DraftStrategyComparison, DraftScoreKey, DraftProductionMode } from '../../lib/draftStrategy';
import type { DraftPlayer } from '../../lib/playerSearch';
import { PlayoffWeekComparison } from './PlayoffWeekComparison';

interface DraftStrategyBreakdownProps {
  analysis: DraftStrategyComparison;
  playerA: DraftPlayer;
  playerB: DraftPlayer;
  productionMode?: DraftProductionMode;
}

interface CandidateStyle {
  option: DraftCandidateScore;
  barClass: string;
  borderClass: string;
  textClass: string;
}

const LABELS: Record<DraftScoreKey, string> = {
  production: 'Projected fantasy value',
  regularSeason: 'Regular season',
  playoffs: 'Fantasy playoffs',
  positionValue: 'Position value',
};

export function DraftStrategyBreakdown({ analysis, playerA, playerB, productionMode = 'projection' }: DraftStrategyBreakdownProps) {
  const labels = productionMode === 'projection' ? LABELS : { ...LABELS, production: 'Prior-season fantasy value' };
  const rows = Object.keys(labels) as DraftScoreKey[];
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
      <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">{productionMode === 'projection' ? 'Upcoming projected value' : 'Prior-season production'} combines your league FPPG with starts that fit before your saved championship ends. Position value measures production above replacement, with a modest multi-position bonus. Everything is weighted by <strong className="font-semibold text-ink">{analysis.strategyLabel}</strong>.</p>
    </div>

    <div className="mt-5 sm:hidden">
      <div className="grid grid-cols-2 gap-3">
        <strong className="truncate text-sm text-accent">{playerA.name}</strong>
        <strong className="truncate text-sm text-positive">{playerB.name}</strong>
      </div>
      <div className="mt-3 space-y-4">
        {rows.map((key) => <div key={key}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-dim">{labels[key]}</p>
          <div className="grid grid-cols-2 gap-3">
            {candidates.map((candidate, index) => <FactorBar key={`${candidate.option.playerId}-${key}`} candidate={candidate} factor={key} factorLabel={labels[key]} competitor={candidates[index === 0 ? 1 : 0].option} />)}
          </div>
        </div>)}
      </div>
    </div>

    <div className="mt-5 hidden grid-cols-[minmax(10rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] gap-x-3 gap-y-3 text-sm sm:grid">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Factor</span>
      <strong className="truncate text-right text-sm text-accent">{playerA.name}</strong>
      <strong className="truncate text-right text-sm text-positive">{playerB.name}</strong>
      {rows.map((key) => <div key={key} className="contents">
        <span className="self-center text-sm font-medium text-ink-dim">{labels[key]}</span>
        {candidates.map((candidate, index) => <FactorBar key={`${candidate.option.playerId}-${key}`} candidate={candidate} factor={key} factorLabel={labels[key]} competitor={candidates[index === 0 ? 1 : 0].option} />)}
      </div>)}
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {candidates.map(({ player, option, borderClass, textClass }) => <article key={player.id} className={`rounded-lg border bg-surface-0 p-4 ${borderClass}`}>
        <div className="flex items-center justify-between">
          <strong className={`truncate text-base ${textClass}`}>{player.name}</strong>
          <span className={`font-mono text-xl font-bold ${textClass}`}>{option.total}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div><dt className="text-ink-dim">Before fantasy playoffs</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.regularUsableStarts}/{option.metrics.regularGames} candidate starts · +{option.metrics.regularAddedStarts} team starts</dd></div>
          <div><dt className="text-ink-dim">Fantasy playoffs</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.playoffUsableStarts}/{option.metrics.playoffGames} candidate starts · +{option.metrics.playoffAddedStarts} team starts · {option.metrics.playoffOffNights} off-night</dd></div>
          <div><dt className="text-ink-dim">Fantasy-season value</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.projectedFantasyPoints.toFixed(1)} candidate pts · +{option.metrics.marginalProjectedPoints.toFixed(1)} team pts</dd></div>
          <div><dt className="text-ink-dim">After championship</dt><dd className={`mt-0.5 font-semibold ${option.metrics.postFantasyGames ? 'text-warning' : 'text-positive'}`}>{option.metrics.postFantasyGames} NHL games do not count</dd></div>
          <div><dt className="text-ink-dim">League FPPG</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.fppg.toFixed(2)}</dd></div>
          <div><dt className="text-ink-dim">{productionMode === 'projection' ? 'Upcoming projection' : 'Prior-season actual'}</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.projectedFppg.toFixed(2)} {productionMode === 'projection' && <span className={projectionTone(option.metrics.projectionTrajectory)}>({formatDelta(option.metrics.projectionDeltaPercent)})</span>}</dd></div>
          <div><dt className="text-ink-dim">Production basis</dt><dd className="mt-0.5 font-semibold capitalize text-ink">{productionMode === 'projection' ? option.metrics.projectionTrajectory : 'actual'} <span className="font-normal text-ink-mute">· {productionMode === 'projection' ? `${option.metrics.projectionConfidence} confidence${player.pos.includes('G') ? ` · ${option.metrics.projectedGames} GP · ${option.metrics.projectionVolatility} volatility` : ''}` : 'league-scored prior season'}</span></dd></div>
          <div><dt className="text-ink-dim">{productionMode === 'projection' ? 'Projected above replacement' : 'Above replacement'}</dt><dd className="mt-0.5 font-semibold text-ink">{option.metrics.valueOverReplacement >= 0 ? '+' : ''}{option.metrics.valueOverReplacement.toFixed(2)} FPPG <span className="font-normal text-ink-mute">vs {option.metrics.replacementPosition ?? 'position'} ({option.metrics.replacementFppg.toFixed(2)})</span></dd></div>
          <div><dt className="text-ink-dim">Eligibility</dt><dd className="mt-0.5 font-semibold text-ink">{player.pos.join('/')}{option.metrics.flexibilityBonus > 0 ? <span className="font-normal text-positive"> · +{option.metrics.flexibilityBonus.toFixed(0)} flexibility</span> : null}</dd></div>
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

function FactorBar({ candidate, factor, factorLabel, competitor }: { candidate: CandidateStyle; factor: DraftScoreKey; factorLabel: string; competitor: DraftCandidateScore }) {
  const value = candidate.option.components[factor];
  const competitorValue = competitor.components[factor];
  const isWinner = value > competitorValue;
  const isTie = value === competitorValue;
  const stateLabel = isWinner ? 'Edge' : isTie ? 'Even' : null;

  return <div
    className={`relative h-9 overflow-hidden rounded-md border bg-surface-0 ${isWinner ? `${candidate.borderClass} ring-1 ring-current/10` : 'border-line-strong'}`}
    title={`${factorLabel}: ${value.toFixed(0)} / 100${isWinner ? ' — stronger factor' : isTie ? ' — even' : ''}`}
    aria-label={`${factorLabel} ${value.toFixed(0)} out of 100${isWinner ? ', edge' : isTie ? ', even' : ''}`}
  >
    <span className={`absolute inset-y-0 left-0 ${candidate.barClass}`} style={{ width: `${value}%` }} />
    <span className="relative flex h-full items-center justify-between gap-2 px-2">
      <span className={`text-[9px] font-bold uppercase tracking-wider ${stateLabel ? candidate.textClass : 'text-transparent'}`}>{stateLabel ?? 'No edge'}</span>
      <strong className="font-mono text-xs text-ink">{value.toFixed(0)}</strong>
    </span>
  </div>;
}
