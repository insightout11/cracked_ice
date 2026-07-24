import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Repeat2 } from 'lucide-react';
import type { PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { planStreamingMoves, type StreamingPlan } from '../../lib/streamingPlanner';
import { Button } from '../ui/button';

interface StreamingPlannerProps {
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  candidates: RosterPlayer[];
  projections: Record<string, PlayerProjection>;
  selectedWindow: { start: string; end: string };
  compact?: boolean;
  previewLabel?: string;
}

function addUtcDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function displayDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function signed(value: number, digits = 0): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function PlanDetails({ plan, baseline }: { plan: StreamingPlan; baseline: StreamingPlan }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-line bg-surface-0 p-2"><span className="block text-[10px] uppercase tracking-wide text-ink-mute">Projected points</span><strong className="scoreboard-number text-lg text-ink">{plan.projectedPoints.toFixed(1)}</strong><span className={plan.pointsDelta >= 0 ? 'ml-2 text-xs text-positive' : 'ml-2 text-xs text-negative'}>{signed(plan.pointsDelta, 1)}</span></div>
        <div className="rounded-md border border-line bg-surface-0 p-2"><span className="block text-[10px] uppercase tracking-wide text-ink-mute">Usable starts</span><strong className="scoreboard-number text-lg text-ink">{plan.projectedStarts}</strong><span className={plan.startsDelta >= 0 ? 'ml-2 text-xs text-positive' : 'ml-2 text-xs text-negative'}>{signed(plan.startsDelta)}</span></div>
        <div className="rounded-md border border-line bg-surface-0 p-2"><span className="block text-[10px] uppercase tracking-wide text-ink-mute">Moves used</span><strong className="scoreboard-number text-lg text-ink">{plan.moveCount}</strong></div>
        <div className="rounded-md border border-line bg-surface-0 p-2"><span className="block text-[10px] uppercase tracking-wide text-ink-mute">Moves left</span><strong className="scoreboard-number text-lg text-ink">{plan.remainingMoves ?? '—'}</strong></div>
      </div>

      <ol className="space-y-2">
        {plan.moves.map((move, index) => (
          <li key={`${move.add.id}-${move.drop.id}-${move.effectiveDate}`} className="rounded-md border border-line bg-surface-0 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="scoreboard-number text-ink-mute">{index + 1}</span>
              <strong>Add {move.add.full_name}</strong>
              <ArrowRight size={14} className="text-accent" aria-hidden="true" />
              <span className="text-ink-dim">Drop {move.drop.full_name}</span>
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              Act {displayDate(move.actionDate)} · usable {displayDate(move.effectiveDate)} · {signed(move.pointsDeltaAtStep, 1)} pts · {signed(move.startsDeltaAtStep)} starts
            </p>
            <p className="mt-1 text-[11px] text-ink-mute">{move.availability === 'unknown' ? 'Availability unknown: scenario only' : `${move.availability.replace(/-/g, ' ')} now; reconfirm before this move`}</p>
          </li>
        ))}
      </ol>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <caption className="sr-only">Daily projected lineup impact for the selected streaming sequence</caption>
          <thead className="bg-surface-0 text-ink-mute"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Baseline</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Effect</th></tr></thead>
          <tbody className="divide-y divide-line">
            {plan.daily.map((day) => (
              <tr key={day.date} className={day.moves.length > 0 || day.pointsDelta !== 0 ? 'bg-accent-muted' : 'bg-surface-1'}>
                <td className="px-3 py-2 text-ink">{displayDate(day.date)}{day.moves.length > 0 ? ' · move' : ''}</td>
                <td className="px-3 py-2 text-ink-dim">{day.baselineStarts} start{day.baselineStarts === 1 ? '' : 's'} · {day.baselinePoints.toFixed(1)}</td>
                <td className="px-3 py-2 text-ink">{day.plannedStarts} start{day.plannedStarts === 1 ? '' : 's'} · {day.plannedPoints.toFixed(1)}</td>
                <td className={`px-3 py-2 ${day.pointsDelta > 0 ? 'text-positive' : day.pointsDelta < 0 ? 'text-negative' : 'text-ink-mute'}`}>{signed(day.startsDelta)} starts · {signed(day.pointsDelta, 1)} pts</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-mute">Compared with the zero-move baseline of {baseline.projectedStarts} usable starts and {baseline.projectedPoints.toFixed(1)} projected points.</p>
    </div>
  );
}

export function StreamingPlanner({ workspace, roster, candidates, projections, selectedWindow, compact = false, previewLabel }: StreamingPlannerProps) {
  const [days, setDays] = useState<7 | 14>(7);
  const [selectedMoveCount, setSelectedMoveCount] = useState(1);
  const end = [selectedWindow.end, addUtcDays(selectedWindow.start, days - 1)].sort()[0];
  const result = useMemo(() => planStreamingMoves(
    workspace,
    roster,
    candidates,
    projections,
    { start: selectedWindow.start, end },
    { alternativesPerMoveCount: 3 },
  ), [candidates, end, projections, roster, selectedWindow.start, workspace]);
  const availableMoveCounts = Object.keys(result.plansByMoveCount)
    .map(Number)
    .filter((count) => count > 0 && result.plansByMoveCount[count].length > 0);
  const activeMoveCount = availableMoveCounts.includes(selectedMoveCount) ? selectedMoveCount : availableMoveCounts[0] ?? 0;
  const plans = result.plansByMoveCount[activeMoveCount] ?? [];
  const bestPlan = plans[0];

  return (
    <section className="border-t border-line p-4" aria-labelledby="streaming-planner-title">
      {previewLabel && <p className="mb-3 rounded-md border border-accent bg-accent-muted p-2 text-xs text-accent">{previewLabel}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="scoreboard-text text-accent">TRANSACTION PLANNER</p>
          <h3 id="streaming-planner-title" className="mt-1 text-lg font-semibold text-ink">Plan the next sequence</h3>
          <p className="mt-1 text-sm text-ink-dim">Optimize usable starts and league-scored points across confirmed candidates.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface-0 p-1" aria-label="Planner horizon">
          {([7, 14] as const).map((option) => <Button key={option} type="button" size="sm" variant={days === option ? 'primary' : 'ghost'} aria-pressed={days === option} onClick={() => setDays(option)}>{option} days</Button>)}
        </div>
      </div>

      {!result.configuredMoveLimit && <p className="mt-3 flex items-center gap-2 rounded-md border border-warning bg-warning-muted p-3 text-xs text-warning"><AlertTriangle size={15} />Set moves used in League Settings for an executable limit. Showing up to three scenario moves.</p>}

      <div className={`mt-4 grid gap-3 ${compact ? '' : 'lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]'}`}>
        <div className="min-w-0 rounded-md border border-line bg-surface-2 p-3">
          <div className="flex items-center gap-2"><CalendarDays size={16} className="text-accent" /><strong className="text-sm text-ink">Zero-move baseline</strong></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded bg-surface-0 p-2 text-[12px] text-ink-dim"><strong className="scoreboard-number block text-lg text-ink">{result.baseline.projectedStarts}</strong>usable starts</div><div className="rounded bg-surface-0 p-2 text-[12px] text-ink-dim"><strong className="scoreboard-number block text-lg text-ink">{result.baseline.projectedPoints.toFixed(1)}</strong>projected points</div></div>
          <ul className="mt-3 space-y-1 text-[11px] text-ink-mute">{result.assumptions.map((assumption) => <li key={assumption}>· {assumption}</li>)}</ul>
        </div>

        <div className="min-w-0 rounded-md border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Repeat2 size={16} className="text-accent" /><strong className="text-sm text-ink">Best sequence</strong></div>
            <div className="flex gap-1">
              {availableMoveCounts.map((count) => <Button key={count} type="button" size="sm" variant={activeMoveCount === count ? 'primary' : 'ghost'} aria-pressed={activeMoveCount === count} onClick={() => setSelectedMoveCount(count)}>{count} move{count === 1 ? '' : 's'}</Button>)}
            </div>
          </div>
          {bestPlan ? <PlanDetails plan={bestPlan} baseline={result.baseline} /> : <p className="mt-3 text-sm text-ink-dim">No legal move sequence is available under the current limits, locks, candidate schedules, and processing delay.</p>}
          {plans.length > 1 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs font-semibold text-ink">If the first target is taken</p>
              <div className="mt-2 flex flex-wrap gap-2">{plans.slice(1).map((plan) => <span key={plan.moves.map((move) => `${move.add.id}>${move.drop.id}@${move.effectiveDate}`).join('|')} className="rounded-full border border-line bg-surface-0 px-3 py-1 text-xs text-ink-dim">{plan.moves.map((move) => move.add.full_name).join(' → ')} · {signed(plan.pointsDelta, 1)} pts</span>)}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
