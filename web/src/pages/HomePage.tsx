import { useEffect, useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BriefingMastline, HomeToolActions, PublicSlate, RosterReadinessCard, WeekAheadStrip } from '../components/home/HomeBriefing';
import { Footer } from '../components/Footer';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { buildPublicBriefing, calculateHomeCapacity, hockeyDateAt, seasonPhase } from '../lib/homeBriefing';
import { confirmRosterReadiness, selectRosterReadiness, selectScheduleReadiness } from '../lib/homeReadiness';
import { loadSeasonSchedule, type SeasonScheduleData } from '../lib/schedulePlanning';
import { SEASON_LABEL } from '../lib/season';
import { track } from '../lib/analytics';
import { loadRecentComparison } from '../lib/comparisonRecents';

export function HomePage() {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [schedule, setSchedule] = useState<SeasonScheduleData | null>(null);
  const [scheduleError, setScheduleError] = useState(false);
  const [retry, setRetry] = useState(0);
  const timezone = activeLeague.schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [date, setDate] = useState(() => hockeyDateAt(new Date(), timezone));
  const phase = seasonPhase(date);
  const readiness = selectRosterReadiness(activeLeague);
  const scheduleReadiness = selectScheduleReadiness(schedule, scheduleError);
  const briefing = useMemo(() => schedule ? buildPublicBriefing(schedule, date, timezone) : null, [date, schedule, timezone]);
  const capacity = useMemo(() => schedule && readiness === 'ready' && phase === 'regular-season' ? calculateHomeCapacity(activeLeague, schedule, date, timezone) : undefined, [activeLeague, date, phase, readiness, schedule, timezone]);
  const recentComparison = useMemo(() => loadRecentComparison(activeLeague.id), [activeLeague.id]);

  useEffect(() => {
    const refreshDate = () => setDate((current) => {
      const next = hockeyDateAt(new Date(), timezone);
      return current === next ? current : next;
    });
    refreshDate();
    const timer = window.setInterval(refreshDate, 30_000);
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDate);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, [timezone]);

  useEffect(() => {
    let cancelled = false;
    setScheduleError(false);
    loadSeasonSchedule(retry > 0).then((value) => {
      if (cancelled) return;
      if (selectScheduleReadiness(value, false) !== 'available') throw new Error('Incomplete schedule coverage');
      setSchedule(value);
    }).catch(() => { if (!cancelled) { setSchedule(null); setScheduleError(true); } });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    track('home_view', { state: scheduleReadiness === 'unavailable' || scheduleReadiness === 'incomplete' ? 'schedule-error' : readiness, phase });
  }, [phase, readiness, scheduleReadiness]);

  const confirmRoster = () => {
    updateLeague(confirmRosterReadiness(activeLeague));
    track('home_setup_action', { action: 'confirm-roster', state: readiness });
    track('home_setup_complete', { method: 'manual-confirmation' });
  };

  return <div className="min-h-screen"><main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8"><BriefingMastline date={date} timezone={timezone} phase={phase === 'preseason' ? `${SEASON_LABEL} draft prep` : phase === 'regular-season' ? `${SEASON_LABEL} regular season` : `outside ${SEASON_LABEL} coverage`} updatedAt={schedule?.lastRefreshed} />
    {briefing ? <><div className="mt-5 grid gap-4 lg:grid-cols-12"><div className="lg:col-span-8"><PublicSlate briefing={briefing} timezone={timezone} phase={phase} leagueId={activeLeague.id} /></div><div className="lg:col-span-4"><RosterReadinessCard workspace={activeLeague} readiness={readiness} capacity={capacity} date={date} onConfirm={confirmRoster} /></div></div><div className="mt-8"><HomeToolActions personalized={readiness === 'ready'} workspace={activeLeague} date={date} recentComparison={recentComparison} /></div><div className="mt-8"><WeekAheadStrip briefing={briefing} timezone={timezone} phase={phase} leagueId={activeLeague.id} /></div></> : scheduleError ? <><div className="mt-5 grid gap-4 lg:grid-cols-12"><section className="rounded-xl border border-warning/50 bg-surface-1 p-6 lg:col-span-8"><p className="scoreboard-text text-warning">SCHEDULE UNAVAILABLE</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">The briefing cannot verify today’s slate.</h1><p className="mt-3 text-base text-ink-dim">Your saved setup and tools are still available. No zero-game claim or personalized recommendation has been inferred from this failure.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink"><RotateCw size={16} />Retry schedule</button><Link to="/compare" className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-semibold text-ink">Continue to Compare</Link></div></section><div className="lg:col-span-4"><RosterReadinessCard workspace={activeLeague} readiness={readiness} date={date} onConfirm={confirmRoster} /></div></div><div className="mt-8"><HomeToolActions personalized={readiness === 'ready'} workspace={activeLeague} date={date} recentComparison={recentComparison} /></div></> : <HomeSkeleton />}
  </main><Footer /></div>;
}

function HomeSkeleton() {
  return <div className="mt-5 grid animate-pulse gap-4 lg:grid-cols-12" aria-label="Loading hockey briefing"><div className="h-96 rounded-xl border border-line bg-surface-1 lg:col-span-8" /><div className="h-96 rounded-xl border border-line bg-surface-1 lg:col-span-4" /></div>;
}
