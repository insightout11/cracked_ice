import { useMemo } from 'react';
import { ArrowRight, CalendarClock, CircleAlert, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import { acquisitionAvailabilityLabel, useAcquisitionRecommendations } from '../../hooks/useAcquisitionRecommendations';
import type { AcquisitionScenario } from '../../lib/acquisitionScenarios';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { toLeagueProfile } from '../../lib/leagueWorkspace';
import { buildHomeActionLink } from '../../lib/navigationContext';
import type { TimeWindowState } from '../../types/timeWindow';
import { Button } from '../ui/button';

export function PersonalizedHomeRecommendations({ workspace, timeWindow, partialRoster = false }: { workspace: LeagueWorkspace; timeWindow: TimeWindowState; partialRoster?: boolean }) {
  // One profile per workspace: a new object each render made the recommendations reload
  // in a loop, flashing between loading and results.
  const leagueProfile = useMemo(() => toLeagueProfile(workspace), [workspace]);
  const result = useAcquisitionRecommendations({ workspace, leagueProfile, timeWindow });
  return <HomeRecommendations workspace={workspace} timeWindow={timeWindow} result={result} partialRoster={partialRoster} />;
}

function reviewLink(workspace: LeagueWorkspace, timeWindow: TimeWindowState, scenario: AcquisitionScenario): string {
  return buildHomeActionLink('/team#pickup-board', {
    leagueId: workspace.id,
    date: scenario.analysis.start,
    source: 'home-recommendation',
    returnTo: '/',
    windowStart: scenario.analysis.start,
    windowEnd: scenario.analysis.end,
    timeWindowPreset: 'custom',
    scenarioId: scenario.id,
    calculationFingerprint: scenario.calculationFingerprint,
    additionId: scenario.addition.id,
    dropId: scenario.drop?.id,
  });
}

function impactCopy(scenario: AcquisitionScenario): string {
  const starts = scenario.impact.usableStartsDelta;
  return `${scenario.impact.projectedPointsDelta >= 0 ? '+' : ''}${scenario.impact.projectedPointsDelta.toFixed(1)} points · ${starts >= 0 ? '+' : ''}${starts} usable start${Math.abs(starts) === 1 ? '' : 's'}`;
}

export function HomeRecommendations({ workspace, timeWindow, result, partialRoster = false }: {
  workspace: LeagueWorkspace;
  timeWindow: TimeWindowState;
  result: AcquisitionRecommendationResult;
  partialRoster?: boolean;
}) {
  if (result.status === 'loading') return (
    <section className="rounded-xl border border-line bg-surface-1 p-5 sm:p-6" aria-live="polite">
      <p className="scoreboard-text text-accent">YOUR NEXT DECISION</p>
      <div className="mt-4 h-24 animate-pulse rounded-lg bg-surface-0" />
      <p className="mt-3 text-sm text-ink-dim">Checking the same roster scenarios used by Pickup Board…</p>
    </section>
  );

  if (result.status === 'error' || result.status === 'missing-input') return (
    <section className="rounded-xl border border-warning/50 bg-surface-1 p-5 sm:p-6">
      <CircleAlert className="text-warning" size={22} />
      <p className="mt-3 scoreboard-text text-warning">PERSONALIZED DECISION UNAVAILABLE</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">Your public schedule and tools are still ready</h2>
      <p className="mt-2 text-sm text-ink-dim">{result.error ?? 'Projection inputs are incomplete for this recommendation window.'} No missing value has been treated as a zero-point gain or a hold signal.</p>
      <Button asChild variant="ghost" className="mt-4"><Link to={buildHomeActionLink('/team#pickup-board', { leagueId: workspace.id, source: 'home-recommendation', returnTo: '/' })}>Open Pickup Board</Link></Button>
    </section>
  );

  const lead = result.leadScenario;
  if (!lead || result.status === 'no-clear-upgrade') return (
    <section className="rounded-xl border border-line-strong bg-surface-1 p-5 sm:p-6">
      <Sparkles className="text-positive" size={22} />
      <p className="mt-3 scoreboard-text text-positive">YOUR NEXT DECISION</p>
      <h2 className="mt-1 text-2xl font-semibold text-ink">Holding is reasonable right now</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">No evaluated option produced a clear, material improvement over your unchanged roster for {timeWindow.config.startUtc.slice(0, 10)} through {timeWindow.config.endUtc.slice(0, 10)}.</p>
      <Button asChild variant="ghost" className="mt-4"><Link to={buildHomeActionLink('/team#pickup-board', { leagueId: workspace.id, source: 'home-recommendation', returnTo: '/', windowStart: timeWindow.config.startUtc.slice(0, 10), windowEnd: timeWindow.config.endUtc.slice(0, 10), timeWindowPreset: 'custom' })}>Review evaluated options</Link></Button>
    </section>
  );

  const availability = acquisitionAvailabilityLabel(lead);
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-accent/50 bg-surface-1 p-5 shadow-panel sm:p-7" aria-labelledby="home-next-decision">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="scoreboard-text text-accent">YOUR NEXT DECISION</p>
            <h2 id="home-next-decision" className="mt-2 text-2xl font-semibold text-ink">{lead.drop === null ? `Fill an open slot with ${lead.addition.full_name}` : `Consider ${lead.addition.full_name}`}</h2>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-dim">If available, <strong className="text-ink">{lead.addition.full_name}</strong> could improve your lineup by approximately <strong className="text-positive">{impactCopy(lead)}</strong>.{lead.drop ? <> The evaluated move would drop <strong className="text-ink">{lead.drop.full_name}</strong>.</> : ' Your saved rules show open regular-roster capacity, so no drop is required.'}</p>
            {partialRoster && <p className="mt-2 text-sm text-warning">Your roster is still partial, so this is fill-roster guidance—not a mature-roster streaming diagnosis.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full border px-2.5 py-1 font-semibold ${availability === 'Confirmed available' ? 'border-positive/50 bg-positive-muted text-positive' : 'border-warning/50 bg-warning-muted text-warning'}`}>{availability}</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-ink-dim">{lead.analysis.start} to {lead.analysis.end}</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-ink-dim">{lead.analysis.projectionSource}</span>
            </div>
          </div>
          <Button asChild size="lg" className="shrink-0"><Link to={reviewLink(workspace, timeWindow, lead)}>Review move<ArrowRight size={16} /></Link></Button>
        </div>
      </section>

      {result.lanes.length > 0 && (
        <section aria-labelledby="home-improvement-lanes">
          <p className="scoreboard-text text-accent">WAYS TO IMPROVE YOUR TEAM</p>
          <h2 id="home-improvement-lanes" className="mt-1 text-2xl font-semibold text-ink">Different paths, one shared calculation</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {result.lanes.map((lane) => (
              <article key={lane.id} className="rounded-xl border border-line bg-surface-1 p-4">
                <p className="scoreboard-text text-accent">{lane.title}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{lane.scenario.addition.full_name}</h3>
                <p className="mt-1 text-xs text-ink-dim">{lane.scenario.drop ? `Drop ${lane.scenario.drop.full_name}` : 'No drop required'} · {impactCopy(lane.scenario)}</p>
                <p className="mt-2 text-xs font-semibold text-warning">{acquisitionAvailabilityLabel(lane.scenario)}</p>
                <Link to={reviewLink(workspace, timeWindow, lane.scenario)} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-accent hover:underline">Review move<ArrowRight size={14} /></Link>
                {lane.alternatives.length > 0 && (
                  <details className="mt-3 border-t border-line pt-3 text-xs text-ink-dim">
                    <summary className="cursor-pointer font-semibold text-ink">{lane.alternatives.length} alternative{lane.alternatives.length === 1 ? '' : 's'}</summary>
                    <div className="mt-2 space-y-2">{lane.alternatives.map((scenario) => <Link key={`${lane.id}-${scenario.id}`} to={reviewLink(workspace, timeWindow, scenario)} className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 hover:bg-surface-2"><span>{scenario.addition.full_name}</span><span>{impactCopy(scenario)}</span></Link>)}</div>
                  </details>
                )}
              </article>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-mute"><CalendarClock size={14} />Usable-start gains are measured against keeping the current roster; vacancies and schedule fit are not added together as separate benefits.</p>
        </section>
      )}
    </div>
  );
}
