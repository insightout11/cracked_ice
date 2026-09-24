import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Clock3, ListOrdered, ScanSearch, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import type { HomeCapacity, HomeRosterWeekDay, PublicBriefing } from '../../lib/homeBriefing';
import { canConfirmRosterReadiness, type RosterReadinessState } from '../../lib/homeReadiness';
import type { RecentComparison } from '../../lib/comparisonRecents';
import { getTeamLogoUrl } from '../../lib/teamLogos';
import { buildHomeActionLink } from '../../lib/navigationContext';
import { Button } from '../ui/button';
import './home.css';

function dateLabel(date: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  // `date` is a calendar selection, not an instant. Keep its label stable in every timezone.
  void timezone;
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function timeLabel(startTime: string | undefined, timezone: string): string {
  if (!startTime || Number.isNaN(new Date(startTime).getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone, timeZoneName: 'short' }).format(new Date(startTime));
}

export function BriefingMastline({ date, timezone, phase, updatedAt }: { date: string; timezone: string; phase: string; updatedAt?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line pb-4 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold uppercase tracking-[0.14em] text-ink">
        {dateLabel(date, timezone, { weekday: 'long', month: 'long', day: 'numeric' })}
        <span className="font-normal text-ink-mute"> · {timezone.replace(/_/g, ' ')} · {phase}</span>
      </p>
      <p>{updatedAt ? `Schedule updated ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(updatedAt))}` : '2026–27 NHL schedule'}</p>
    </div>
  );
}

export function RosterReadinessCard({ workspace, readiness, capacity, date, onConfirm }: { workspace: LeagueWorkspace; readiness: RosterReadinessState; capacity?: HomeCapacity; date?: string; onConfirm: () => void }) {
  if (readiness === 'none') return (
    <aside className="h-full rounded-xl border border-line-strong bg-surface-1 p-5 sm:p-6">
      <Sparkles className="text-accent" />
      <p className="mt-4 text-sm font-semibold text-accent">Your team</p>
      <h2 className="mt-1 text-2xl font-semibold text-ink">Make the briefing yours</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">Add your roster and lineup rules before Cracked Ice makes capacity claims.</p>
      <Button asChild className="mt-5"><Link to={buildHomeActionLink('/team?setup=import', { leagueId: workspace.id, date, source: 'home-briefing', returnTo: '/' })}>Personalize with my roster</Link></Button>
    </aside>
  );

  if (readiness !== 'ready') {
    const confirmable = canConfirmRosterReadiness(workspace);
    return (
      <aside className="h-full rounded-xl border border-warning/50 bg-surface-1 p-5 sm:p-6">
        <CircleAlert className="text-warning" />
        <p className="mt-4 text-sm font-semibold text-warning">{readiness === 'incomplete' ? 'Setup incomplete' : 'Setup needs review'}</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Confirm the full roster</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">{workspace.roster.length} player{workspace.roster.length === 1 ? ' is' : 's are'} saved. {confirmable ? 'Review intentional vacancies before enabling personalized guidance.' : 'Fix player eligibility and lineup rules before personalized guidance can be enabled.'}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild><Link to={buildHomeActionLink('/team?setup=review', { leagueId: workspace.id, date, source: 'home-briefing', returnTo: '/' })}>Review setup</Link></Button>
          {confirmable && <Button variant="ghost" onClick={onConfirm}>Roster is complete</Button>}
        </div>
      </aside>
    );
  }

  const hasConflict = Boolean(capacity?.actionable && capacity.conflict > 0);
  return (
    <aside className="h-full rounded-xl border border-line-strong bg-surface-1 p-5 sm:p-6">
      <CheckCircle2 className="text-positive" />
      <p className="mt-4 text-sm font-semibold text-positive">Your team is ready</p>
      <h2 className="mt-1 text-2xl font-semibold text-ink">{hasConflict ? `${capacity?.conflict} potential lineup conflict${capacity?.conflict === 1 ? '' : 's'}` : 'Roster context is ready'}</h2>
      {capacity ? (
        <>
          <p className="mt-2 text-lg font-semibold text-ink">{capacity.scheduledSkaters} scheduled · {capacity.skaterCapacity} fit · {capacity.conflict} conflict{capacity.conflict === 1 ? '' : 's'}</p>
          <details className="mt-3 text-sm text-ink-dim"><summary className="cursor-pointer font-semibold text-accent">How this is calculated</summary><p className="mt-2 leading-relaxed">Eligible active slots determine who can fit. {capacity.actionable ? 'This is potential capacity, not a guarantee that lineup changes remain open.' : 'Weekly locking is enabled, so this is schedule context only—not an actionable daily claim.'}</p></details>
          {capacity.goalieTeams.length > 0 && <p className="mt-3 text-xs text-ink-mute">Goalie teams scheduled: {capacity.goalieTeams.join(', ')}. Starts are unconfirmed.</p>}
        </>
      ) : <p className="mt-2 text-sm text-ink-dim">Saved league and roster context will be applied when schedule coverage begins.</p>}
      <Button asChild className="mt-5"><Link to={buildHomeActionLink(hasConflict && date ? `/season?start=${date}` : '/team', { leagueId: workspace.id, date, source: 'home-briefing', returnTo: '/' })}>{hasConflict ? 'Review lineup capacity' : 'Open My Team'}<ArrowRight size={16} /></Link></Button>
    </aside>
  );
}

const ACTIONS = [
  { to: '/compare?mode=draft', title: 'Compare Players', copy: 'Put two players into your league, projection, and schedule context.', icon: ScanSearch, motif: 'A  ↔  B' },
  { to: '/draft', title: 'Draft Board', copy: 'Build tiers and round targets around scoring, scarcity, and usable games.', icon: ListOrdered, motif: '01  02  03' },
  { to: '/optimizer', title: 'Schedule Fit', copy: 'Find team combinations that create more usable nights.', icon: CalendarDays, motif: 'M  T  W  T  F' },
] as const;

export function HomeToolActions({ workspace, date, recentComparison }: { workspace: LeagueWorkspace; date: string; recentComparison: RecentComparison | null }) {
  const myPicks = workspace.draftSession.picks.filter((pick) => pick.status === 'mine').length;
  const previews = [
    recentComparison ? `${recentComparison.playerA.name} vs ${recentComparison.playerB.name}` : 'Choose two players · use any selected source',
    `${myPicks} of your picks saved · ${workspace.draftSession.targets.length} targets`,
    `${new Set(workspace.roster.map((entry) => entry.team)).size} roster teams · check ${dateLabel(date, workspace.schedule.timezone, { month: 'short', day: 'numeric' })}`,
  ];
  const destinations = [recentComparison ? `/compare?mode=draft&a=${encodeURIComponent(recentComparison.playerA.id)}&b=${encodeURIComponent(recentComparison.playerB.id)}` : ACTIONS[0].to, ACTIONS[1].to, ACTIONS[2].to];

  return (
    <section aria-labelledby="home-tools">
      <h2 id="home-tools" className="text-xl font-semibold text-ink">Start with the question you need answered</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {ACTIONS.map(({ title, copy, icon: Icon, motif }, index) => (
          <Link key={title} to={buildHomeActionLink(destinations[index], { leagueId: workspace.id, date, source: 'home-tool', returnTo: '/' })} className="group rounded-xl border border-line bg-surface-1 p-5 transition-colors duration-150 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="flex items-center justify-between"><Icon className="text-accent" size={22} /><span className="font-mono text-xs tracking-[0.2em] text-ink-mute">{motif}</span></div>
            <h3 className="mt-7 text-xl font-semibold text-ink group-hover:text-accent">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">{copy}</p>
            <p className="mt-4 rounded-md border border-line bg-surface-0 px-3 py-2 text-xs font-semibold text-ink">{previews[index]}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">Open tool <ArrowRight size={14} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Night heat: light nights leave lineup room (ice), packed nights block starts (goal-lamp red). */
function nightHeat(games: number): { tone: string; label: string; packed: boolean } {
  if (games === 0) return { tone: 'bg-surface-0 border-line text-ink-mute', label: 'No games', packed: false };
  if (games <= 8) return { tone: 'bg-accent-muted border-accent/40 text-accent', label: 'Light night', packed: false };
  if (games <= 12) return { tone: 'bg-surface-2 border-line text-ink', label: 'Busy', packed: false };
  return { tone: 'bg-negative-muted border-negative/50 text-negative', label: 'Packed', packed: true };
}

export function WeekAheadStrip({ briefing, timezone, phase, leagueId, rosterWeek }: { briefing: PublicBriefing; timezone: string; phase: 'preseason' | 'regular-season' | 'outside-coverage'; leagueId: string; rosterWeek?: HomeRosterWeekDay[] }) {
  const opening = phase !== 'regular-season';
  const days = opening ? briefing.openingWeek : briefing.week;
  const personalized = !opening && Boolean(rosterWeek?.length);
  const rosterByDate = new Map((rosterWeek ?? []).map((day) => [day.date, day]));
  return (
    <section className="rounded-2xl border border-line bg-surface-1 p-5 sm:p-6" aria-labelledby="home-week-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-week-heading" className="text-xl font-semibold text-ink">{opening ? 'Opening week' : 'Your week ahead'}</h2>
          <p className="mt-1 text-sm text-ink-dim">Light nights leave lineup room; packed nights leave players on your bench.</p>
        </div>
        {briefing.nextLightDate && <p className="text-sm text-ink-dim">Next light night: <strong className="text-ink">{dateLabel(briefing.nextLightDate, timezone, { weekday: 'long', month: 'short', day: 'numeric' })}</strong></p>}
      </div>
      {days.length ? (
        <ol className={`mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7`} aria-label={opening ? 'Upcoming NHL game nights' : 'This week, night by night'}>
          {days.map((day) => {
            const roster = rosterByDate.get(day.date);
            const games = roster?.nhlGameCount ?? day.gameCount;
            const heat = nightHeat(games);
            return (
              <li key={day.date} className={`relative overflow-hidden rounded-xl border p-3 ${heat.tone} ${heat.packed ? 'ice-cracks' : ''}`}>
                <p className="text-xs font-semibold text-ink">{dateLabel(day.date, timezone, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <p className="mt-2 font-display text-3xl font-bold leading-none">{games}</p>
                <p className="mt-1 text-[11px]">{games === 0 ? 'No games' : `${games === 1 ? 'game' : 'games'} · ${heat.label.toLowerCase()}`}</p>
                {personalized && roster && (
                  <p className="mt-3 border-t border-line pt-2 text-xs text-ink-dim">
                    <strong className="text-ink">{roster.scheduledRosterPlayers}</strong> of yours play
                    {roster.blockedSkaters > 0 ? <span className="text-negative"> · {roster.blockedSkaters} benched</span> : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : <p className="mt-5 rounded-md border border-line bg-surface-0 p-4 text-sm text-ink-dim">No upcoming game dates are available in this schedule snapshot.</p>}
      {personalized && rosterWeek?.some((day) => !day.actionable) && <p className="mt-3 text-xs text-warning">Weekly locking is enabled. This is schedule context only and does not imply that daily lineup swaps remain available.</p>}
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to={buildHomeActionLink(`/season?start=${days[0]?.date ?? briefing.date}`, { leagueId, date: days[0]?.date ?? briefing.date, source: 'home-briefing', returnTo: '/' })} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:underline"><Clock3 size={15} />Open full schedule</Link>
        <Link to="/blog" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-dim hover:text-accent"><Sparkles size={15} />Read the latest strategy guide</Link>
      </div>
    </section>
  );
}
