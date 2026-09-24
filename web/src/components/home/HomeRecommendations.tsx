import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ArrowRight, CalendarClock, CircleAlert, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import { acquisitionAvailabilityLabel, useAcquisitionRecommendations } from '../../hooks/useAcquisitionRecommendations';
import { useWeekPlanner } from '../../hooks/useWeekPlanner';
import type { AcquisitionScenario } from '../../lib/acquisitionScenarios';
import type { LeagueProfile, RosterPlayer } from '../../lib/coachSchemas';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import { toLeagueProfile } from '../../lib/leagueWorkspace';
import { buildHomeActionLink } from '../../lib/navigationContext';
import { mugshotSeason } from '../../lib/season';
import type { TimeWindowState } from '../../types/timeWindow';
import { Button } from '../ui/button';
import { headshotUrl, useCountUp } from './homeMotion';
import './home.css';

export function PersonalizedHomeRecommendations({ workspace, timeWindow, partialRoster = false }: { workspace: LeagueWorkspace; timeWindow: TimeWindowState; partialRoster?: boolean }) {
  // One profile per workspace: a new object each render made the recommendations reload
  // in a loop, flashing between loading and results.
  const leagueProfile = useMemo(() => toLeagueProfile(workspace), [workspace]);
  const result = useAcquisitionRecommendations({ workspace, leagueProfile, timeWindow });
  return (
    <HomeRecommendations
      workspace={workspace}
      timeWindow={timeWindow}
      result={result}
      partialRoster={partialRoster}
      aside={<PointsOnTable workspace={workspace} leagueProfile={leagueProfile} recommendations={result} />}
    />
  );
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

/** The planner's best plan for this week, as the gain over keeping the roster as is. */
function PointsOnTable({ workspace, leagueProfile, recommendations }: { workspace: LeagueWorkspace; leagueProfile: LeagueProfile; recommendations: AcquisitionRecommendationResult }) {
  const { status, result } = useWeekPlanner({ workspace, leagueProfile, roster: recommendations.roster, recommendations, includeGoalies: false, horizon: 'week' });
  // The fewest adds within half a point of the most gain, as the planner recommends.
  const plan = useMemo(() => {
    if (!result) return null;
    const counts = result.plans.map((_, count) => count).filter((count) => count > 0);
    const best = counts.reduce<number | null>((pick, count) => (pick === null || result.plans[count].gain > result.plans[pick].gain + 0.5 ? count : pick), null);
    return best === null ? null : result.plans[best];
  }, [result]);
  const gain = plan && plan.gain > 0.05 ? plan.gain : 0;
  const shown = useCountUp(gain, 1100);
  const storageKey = result ? `cracked-ice-home-points:${workspace.id}:${result.week.start}` : null;
  const [improved, setImproved] = useState(false);
  useEffect(() => {
    if (!storageKey || status !== 'ready') return;
    try {
      const previous = Number(localStorage.getItem(storageKey));
      setImproved(Number.isFinite(previous) && previous > 0 && gain > previous + 0.5);
      localStorage.setItem(storageKey, String(gain));
    } catch {
      // Storage can be unavailable (private mode); the flourish is optional.
    }
  }, [gain, status, storageKey]);
  const plannerLink = buildHomeActionLink('/team#pickup-board', { leagueId: workspace.id, source: 'home-recommendation', returnTo: '/' });

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-positive/40 bg-surface-1 p-5 sm:p-6" aria-labelledby="home-points-heading">
      <h2 id="home-points-heading" className="text-base font-semibold text-ink">Points on the table this week</h2>
      {status === 'loading' || !result ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-surface-0" aria-label="Planning this week" />
      ) : status === 'error' ? (
        <p className="mt-3 text-sm text-ink-dim">This week's schedules could not be loaded. The planner on My Team will retry.</p>
      ) : gain > 0 && plan ? (
        <>
          <div className="relative mt-3 w-fit">
            {improved && (
              <svg className="crack-flourish pointer-events-none absolute -inset-x-4 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+2rem)]" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 34 L42 28 L58 40 L96 22 L120 34 L150 18 L196 30" fill="none" stroke="var(--positive)" strokeOpacity="0.35" strokeWidth="1.2" />
              </svg>
            )}
            <p className="led-numeral led-green relative text-6xl">+{shown.toFixed(1)}</p>
          </div>
          <p className="mt-2 text-sm text-ink-dim">
            {improved ? 'Up since your last visit. ' : ''}Projected points the planner's best {plan.addCount}-add plan gains over keeping your roster as is.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {plan.adds.slice(0, 3).map((add) => (
              <li key={`${add.add.id}-${add.effectiveDate}`} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-ink">{add.add.full_name}</span>
                <span className="shrink-0 text-xs tabular-nums text-positive">+{add.points.toFixed(1)}</span>
              </li>
            ))}
            {plan.adds.length > 3 && <li className="text-xs text-ink-mute">and {plan.adds.length - 3} more</li>}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-dim">No add improves your lineup this week. Mark a player OK to drop on My Team and the planner will look for streaming room.</p>
      )}
      <Link to={plannerLink} className="mt-auto inline-flex min-h-11 items-center gap-1 pt-4 text-sm font-semibold text-accent hover:underline">Open the planner<ArrowRight size={14} /></Link>
    </section>
  );
}

function Headshot({ player, faded = false }: { player: RosterPlayer; faded?: boolean }) {
  return (
    <img
      src={headshotUrl(mugshotSeason, player.team, player.id)}
      alt=""
      className={`size-20 shrink-0 rounded-full border-2 bg-surface-0 object-cover sm:size-24 ${faded ? 'border-line opacity-60 grayscale' : 'border-accent/60'}`}
      onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}

export function HomeRecommendations({ workspace, timeWindow, result, partialRoster = false, aside }: {
  workspace: LeagueWorkspace;
  timeWindow: TimeWindowState;
  result: AcquisitionRecommendationResult;
  partialRoster?: boolean;
  /** Shown beside the next-decision card (the points on the table). */
  aside?: ReactNode;
}) {
  const withAside = (card: ReactNode) => (aside ? <div className="grid gap-4 lg:grid-cols-12"><div className="min-w-0 lg:col-span-4">{aside}</div><div className="min-w-0 lg:col-span-8">{card}</div></div> : card);
  if (result.status === 'loading') return withAside(
    <section className="h-full rounded-2xl border border-line bg-surface-1 p-5 sm:p-6" aria-live="polite">
      <h2 className="text-base font-semibold text-ink">Your next decision</h2>
      <div className="mt-4 h-24 animate-pulse rounded-lg bg-surface-0" />
      <p className="mt-3 text-sm text-ink-dim">Checking the same roster scenarios used by Pickup Board…</p>
    </section>,
  );

  if (result.status === 'error' || result.status === 'missing-input') return withAside(
    <section className="h-full rounded-2xl border border-warning/50 bg-surface-1 p-5 sm:p-6">
      <CircleAlert className="text-warning" size={22} />
      <p className="mt-3 font-semibold text-warning">Personalized decision unavailable</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">Your public schedule and tools are still ready</h2>
      <p className="mt-2 text-sm text-ink-dim">{result.error ?? 'Projection inputs are incomplete for this recommendation window.'} No missing value has been treated as a zero-point gain or a hold signal.</p>
      <Button asChild variant="ghost" className="mt-4"><Link to={buildHomeActionLink('/team#pickup-board', { leagueId: workspace.id, source: 'home-recommendation', returnTo: '/' })}>Open Pickup Board</Link></Button>
    </section>,
  );

  const lead = result.leadScenario;
  if (!lead || result.status === 'no-clear-upgrade') return withAside(
    <section className="h-full rounded-2xl border border-line-strong bg-surface-1 p-5 sm:p-6">
      <Sparkles className="text-positive" size={22} />
      <p className="mt-3 text-base font-semibold text-ink-dim">Your next decision</p>
      <h2 className="mt-1 text-2xl font-semibold text-ink">Holding is reasonable right now</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">No evaluated option produced a clear, material improvement over your unchanged roster for {timeWindow.config.startUtc.slice(0, 10)} through {timeWindow.config.endUtc.slice(0, 10)}.</p>
      <Button asChild variant="ghost" className="mt-4"><Link to={buildHomeActionLink('/team#pickup-board', { leagueId: workspace.id, source: 'home-recommendation', returnTo: '/', windowStart: timeWindow.config.startUtc.slice(0, 10), windowEnd: timeWindow.config.endUtc.slice(0, 10), timeWindowPreset: 'custom' })}>Review evaluated options</Link></Button>
    </section>,
  );

  const availability = acquisitionAvailabilityLabel(lead);
  return (
    <div className="space-y-6">
      {withAside(
        <section className="h-full overflow-hidden rounded-2xl border border-accent/50 bg-surface-1 shadow-panel" aria-labelledby="home-next-decision">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 sm:px-6">
            <h2 id="home-next-decision" className="text-base font-semibold text-ink">Your next decision</h2>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${availability === 'Confirmed available' ? 'border-positive/50 bg-positive-muted text-positive' : 'border-warning/50 bg-warning-muted text-warning'}`}>{availability}</span>
          </div>
          <div className="grid items-center gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <div className="flex min-w-0 flex-col items-center text-center">
                <Headshot player={lead.addition} />
                <p className="mt-2 text-xs font-semibold text-positive">Add</p>
                <p className="max-w-[9rem] truncate font-semibold text-ink">{lead.addition.full_name}</p>
                <p className="text-xs text-ink-mute">{lead.addition.team} {lead.addition.positions.join('/')}</p>
              </div>
              <ArrowLeftRight className="shrink-0 text-accent" size={22} aria-hidden="true" />
              {lead.drop ? (
                <div className="flex min-w-0 flex-col items-center text-center">
                  <Headshot player={lead.drop} faded />
                  <p className="mt-2 text-xs font-semibold text-negative">Drop</p>
                  <p className="max-w-[9rem] truncate font-semibold text-ink-dim">{lead.drop.full_name}</p>
                  <p className="text-xs text-ink-mute">{lead.drop.team} {lead.drop.positions.join('/')}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="grid size-20 place-items-center rounded-full border-2 border-dashed border-line text-ink-mute sm:size-24">Open</div>
                  <p className="mt-2 text-xs font-semibold text-ink-mute">No drop</p>
                  <p className="text-xs text-ink-mute">Empty roster spot</p>
                </div>
              )}
            </div>
            <div className="text-left sm:text-right">
              <p className="led-numeral led-green text-5xl">{lead.impact.projectedPointsDelta >= 0 ? '+' : ''}{lead.impact.projectedPointsDelta.toFixed(1)}</p>
              <p className="mt-1 text-sm text-ink-dim">projected points</p>
              <p className="text-xs text-ink-mute">{lead.impact.usableStartsDelta >= 0 ? '+' : ''}{lead.impact.usableStartsDelta} usable start{Math.abs(lead.impact.usableStartsDelta) === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
            <p className="text-xs text-ink-mute">{lead.analysis.start} to {lead.analysis.end}{partialRoster ? '. Your roster is still partial, so this is fill-roster guidance.' : ''}</p>
            <Button asChild><Link to={reviewLink(workspace, timeWindow, lead)}>Review move<ArrowRight size={16} /></Link></Button>
          </div>
        </section>,
      )}

      {result.lanes.length > 0 && (
        <section aria-labelledby="home-improvement-lanes">
          <h2 id="home-improvement-lanes" className="text-xl font-semibold text-ink">Other ways to improve your team</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {result.lanes.map((lane) => (
              <article key={lane.id} className="rounded-xl border border-line bg-surface-1 p-4">
                <p className="text-xs font-semibold text-accent">{lane.title}</p>
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
