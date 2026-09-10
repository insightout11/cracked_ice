import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Clock3, ListOrdered, ScanSearch, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LeagueWorkspace } from '../../lib/leagueWorkspace';
import type { HomeCapacity, PublicBriefing } from '../../lib/homeBriefing';
import { canConfirmRosterReadiness, type RosterReadinessState } from '../../lib/homeReadiness';
import type { RecentComparison } from '../../lib/comparisonRecents';
import { getTeamLogoUrl } from '../../lib/teamLogos';
import { buildHomeActionLink } from '../../lib/navigationContext';
import { Button } from '../ui/button';

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

export function PublicSlate({ briefing, timezone, phase, leagueId }: { briefing: PublicBriefing; timezone: string; phase: 'preseason' | 'regular-season' | 'outside-coverage'; leagueId: string }) {
  const hasGames = briefing.gameCount > 0;
  const heading = phase === 'regular-season' ? (hasGames ? "Tonight's fantasy edge" : 'Next game night') : 'Draft prep';
  const scheduleLink = buildHomeActionLink(`/season?start=${briefing.date}`, { leagueId, date: briefing.date, source: 'home-briefing', returnTo: '/' });

  return (
    <section className="relative h-full overflow-hidden rounded-xl border border-line-strong bg-surface-1 p-5 shadow-panel sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--accent-muted),transparent_44%)]" />
      <div className="relative">
        <p className="scoreboard-text text-accent">{heading}</p>
        {phase === 'regular-season' ? (
          <>
            <div className="mt-3 flex items-end gap-3">
              <strong className="font-display text-5xl font-bold leading-none text-ink sm:text-6xl">{briefing.gameCount}</strong>
              <span className="pb-1 text-lg font-semibold text-ink-dim">NHL game{briefing.gameCount === 1 ? '' : 's'}</span>
            </div>
            <p className="mt-3 text-base text-ink-dim">
              {hasGames
                ? (briefing.firstPuckDrop ? `First puck drop ${timeLabel(briefing.firstPuckDrop, timezone)}` : 'Puck-drop time unavailable for this slate')
                : (briefing.nextGameDate ? `The next scheduled slate is ${dateLabel(briefing.nextGameDate, timezone, { weekday: 'long', month: 'short', day: 'numeric' })}.` : 'No later regular-season games are available in this schedule snapshot.')}
            </p>
          </>
        ) : briefing.nextGameDate ? (
          <>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight text-ink xl:text-4xl">Opening night · {dateLabel(briefing.nextGameDate, timezone, { month: 'long', day: 'numeric' })}</h1>
            <div className="mt-4 flex items-end gap-3">
              <strong className="font-display text-5xl font-bold leading-none text-ink sm:text-6xl">{briefing.nextGameCount}</strong>
              <span className="pb-1 text-lg font-semibold text-ink-dim">NHL game{briefing.nextGameCount === 1 ? '' : 's'}</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">Start draft prep with the actual opening slate, then add your league scoring and projection sources.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {briefing.nextMatchups.slice(0, 6).map((game) => (
                <div key={`${game.away}-${game.home}`} className="flex min-h-14 items-center gap-2 rounded-lg border border-line bg-surface-0/80 px-3">
                  <img src={getTeamLogoUrl(game.away)} alt="" className="size-7 object-contain" />
                  <span className="font-semibold text-ink">{game.away}</span><span className="text-xs text-ink-mute">at</span>
                  <img src={getTeamLogoUrl(game.home)} alt="" className="size-7 object-contain" />
                  <span className="font-semibold text-ink">{game.home}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">More useful starts. Better fantasy decisions.</h1>
            <p className="mt-3 max-w-2xl text-base text-ink-dim">Draft and comparison tools remain available without making schedule claims.</p>
          </>
        )}

        {phase === 'regular-season' && hasGames && (
          <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {briefing.matchups.slice(0, 6).map((game) => (
              <div key={`${game.away}-${game.home}`} className="flex min-h-14 items-center gap-2 rounded-lg border border-line bg-surface-0/80 px-3">
                <img src={getTeamLogoUrl(game.away)} alt="" className="size-7 object-contain" />
                <span className="font-semibold text-ink">{game.away}</span><span className="text-xs text-ink-mute">at</span>
                <img src={getTeamLogoUrl(game.home)} alt="" className="size-7 object-contain" />
                <span className="font-semibold text-ink">{game.home}</span>
                <span className="ml-auto text-[10px] text-ink-mute">{timeLabel(game.startTime, timezone)}</span>
              </div>
            ))}
          </div>
        )}
        {briefing.invalidStartTimes > 0 && <p className="mt-3 text-xs text-warning">{briefing.invalidStartTimes} matchup time{briefing.invalidStartTimes === 1 ? ' is' : 's are'} unavailable in this schedule snapshot.</p>}
        <Button asChild size="lg" className="mt-6">
          <Link to={phase === 'regular-season' ? scheduleLink : buildHomeActionLink('/draft', { leagueId, date: briefing.date, source: 'home-briefing', returnTo: '/' })}>
            {phase === 'regular-season' ? 'Open the schedule' : 'Open Draft Board'}<ArrowRight size={17} />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function RosterReadinessCard({ workspace, readiness, capacity, date, onConfirm }: { workspace: LeagueWorkspace; readiness: RosterReadinessState; capacity?: HomeCapacity; date?: string; onConfirm: () => void }) {
  if (readiness === 'none') return (
    <aside className="h-full rounded-xl border border-line-strong bg-surface-1 p-5 sm:p-6">
      <Sparkles className="text-accent" />
      <p className="mt-4 scoreboard-text text-accent">YOUR TEAM</p>
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
        <p className="mt-4 scoreboard-text text-warning">SETUP {readiness === 'incomplete' ? 'INCOMPLETE' : 'NEEDS REVIEW'}</p>
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
      <p className="mt-4 scoreboard-text text-positive">YOUR TEAM · READY</p>
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
      <p className="scoreboard-text text-accent">MAKE THE NEXT DECISION</p>
      <h2 id="home-tools" className="mt-1 text-2xl font-semibold text-ink">Start with the question you need answered</h2>
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

export function WeekAheadStrip({ briefing, timezone, phase, leagueId }: { briefing: PublicBriefing; timezone: string; phase: 'preseason' | 'regular-season' | 'outside-coverage'; leagueId: string }) {
  const opening = phase !== 'regular-season';
  const days = opening ? briefing.openingWeek : briefing.week;
  const max = Math.max(1, ...days.map((day) => day.gameCount));
  return (
    <section className="rounded-xl border border-line bg-surface-1 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="scoreboard-text text-accent">{opening ? 'OPENING-WEEK OUTLOOK' : 'THIS WEEK'}</p><h2 className="mt-1 text-xl font-semibold text-ink">{opening ? 'The first meaningful schedule dates' : 'Slate density at a glance'}</h2></div>
        {briefing.nextLightDate && <p className="text-sm text-ink-dim">Next light night: <strong className="text-ink">{dateLabel(briefing.nextLightDate, timezone, { weekday: 'long', month: 'short', day: 'numeric' })}</strong></p>}
      </div>
      {days.length ? (
        <div className={`mt-5 grid gap-2 ${opening ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7' : 'grid-cols-7'}`} aria-label={opening ? 'Upcoming NHL game dates' : 'Seven day NHL game counts'}>
          {days.map((day) => <div key={day.date} className="text-center"><div className="flex h-20 items-end justify-center rounded-md bg-surface-0 p-1"><div className="w-full rounded-sm bg-accent/70" style={{ height: day.gameCount === 0 ? '0%' : `${(day.gameCount / max) * 100}%` }} /></div><strong className="mt-2 block text-xs text-ink">{dateLabel(day.date, timezone, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span className="text-[10px] text-ink-mute">{day.gameCount === 0 ? 'No games' : `${day.gameCount} games${day.gameCount <= 8 ? ' · light' : ''}`}</span></div>)}
        </div>
      ) : <p className="mt-5 rounded-md border border-line bg-surface-0 p-4 text-sm text-ink-dim">No upcoming game dates are available in this schedule snapshot.</p>}
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to={buildHomeActionLink(`/season?start=${days[0]?.date ?? briefing.date}`, { leagueId, date: days[0]?.date ?? briefing.date, source: 'home-briefing', returnTo: '/' })} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:underline"><Clock3 size={15} />Open full schedule</Link>
        <Link to="/blog" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-dim hover:text-accent"><Sparkles size={15} />Read the latest strategy guide</Link>
      </div>
    </section>
  );
}
