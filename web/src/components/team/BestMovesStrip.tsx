import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import { acquisitionAvailabilityLabel, type AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import type { AcquisitionScenario } from '../../lib/acquisitionScenarios';
import { Button } from '../ui/button';

const MAX_MOVES = 3;

function impactCopy(scenario: AcquisitionScenario): string {
  const starts = scenario.impact.usableStartsDelta;
  return `${scenario.impact.projectedPointsDelta >= 0 ? '+' : ''}${scenario.impact.projectedPointsDelta.toFixed(1)} pts · ${starts >= 0 ? '+' : ''}${starts} start${Math.abs(starts) === 1 ? '' : 's'}`;
}

/** The lead move plus the other lane leaders, without repeating a scenario. */
export function topMoves(result: AcquisitionRecommendationResult): Array<{ title: string; scenario: AcquisitionScenario }> {
  const moves: Array<{ title: string; scenario: AcquisitionScenario }> = [];
  const seen = new Set<string>();
  if (result.leadScenario) {
    moves.push({ title: 'Best overall', scenario: result.leadScenario });
    seen.add(result.leadScenario.id);
  }
  for (const lane of result.lanes) {
    if (seen.has(lane.scenario.id)) continue;
    seen.add(lane.scenario.id);
    moves.push({ title: lane.title, scenario: lane.scenario });
  }
  return moves.slice(0, MAX_MOVES);
}

/**
 * The top of My Team: the best few moves for the selected window, from the same
 * calculation as the Pickup Board below, so the decision is visible without
 * scrolling past the roster.
 */
export function BestMovesStrip({ result, windowLabel, onReview }: { result: AcquisitionRecommendationResult; windowLabel: string; onReview: (scenarioId: string | null) => void }) {
  const heading = <>BEST MOVES <span className="ml-1 normal-case tracking-normal text-ink-mute">{windowLabel}</span></>;
  const seeAll = (
    <button type="button" onClick={() => onReview(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
      All pickup options<ArrowDown size={13} aria-hidden="true" />
    </button>
  );

  if (result.status === 'loading') {
    return (
      <section className="mb-3 rounded-lg border border-line bg-surface-1 p-3" aria-live="polite">
        <p className="scoreboard-text text-accent">{heading}</p>
        <div className="mt-2 h-10 animate-pulse rounded-md bg-surface-0" />
      </section>
    );
  }

  const moves = topMoves(result);
  if (result.status !== 'ready' || !moves.length) {
    const message = result.status === 'no-clear-upgrade'
      ? 'Holding is reasonable: no evaluated move clearly beats your current roster for this window.'
      : result.error ?? 'Pickup suggestions need projections for your roster and candidates.';
    return (
      <section className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-1 px-3 py-2.5">
        <p className="text-xs text-ink-dim"><span className="scoreboard-text mr-2 text-accent">{heading}</span>{message}</p>
        {seeAll}
      </section>
    );
  }

  return (
    <section className="mb-3 rounded-lg border border-accent/40 bg-surface-1 p-3" aria-labelledby="best-moves-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="best-moves-title" className="scoreboard-text flex items-center gap-1.5 text-accent"><Sparkles size={14} aria-hidden="true" />{heading}</h2>
        {seeAll}
      </div>
      <ol className="mt-2 grid gap-2 md:grid-cols-3">
        {moves.map(({ title, scenario }) => {
          const availability = acquisitionAvailabilityLabel(scenario);
          return (
            <li key={scenario.id} className="flex flex-col rounded-md border border-line bg-surface-2 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{title}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-ink">{scenario.addition.full_name}</p>
              <p className="truncate text-[11px] text-ink-dim">{scenario.drop ? `Drop ${scenario.drop.full_name}` : 'No drop required'}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <p className="scoreboard-number text-sm text-positive">{impactCopy(scenario)}</p>
                  <p className={`text-[10px] font-semibold ${availability === 'Confirmed available' ? 'text-positive' : 'text-warning'}`}>{availability}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" className="!inline-flex" onClick={() => onReview(scenario.id)}>Review<ArrowRight size={13} aria-hidden="true" /></Button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
