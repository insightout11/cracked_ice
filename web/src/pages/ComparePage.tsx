import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, CalendarDays, CheckCircle2, Copy, Info, Share2, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import type { DraftPlayer, DraftPlayerDirectoryMeta } from '../lib/playerSearch';
import { apiService } from '../services/api';
import { useLeagueWorkspace } from '../contexts/LeagueWorkspaceContext';
import { toLeagueProfile, type LeagueWorkspace } from '../lib/leagueWorkspace';
import { loadSeasonSchedule, planningIntentFromWorkspace, resolvePlanningWindow, workspaceWindowPreset, type PlanningIntent, type SeasonScheduleData } from '../lib/schedulePlanning';
import { analyzePlayerComparison, reconcileComparisonProjections } from '../lib/playerComparisonAnalysis';
import { PlayerPicker } from '../components/comparison/PlayerPicker';
import { ComparisonScheduleStrip } from '../components/comparison/ComparisonScheduleStrip';
import { ComparisonShareFrame } from '../components/comparison/ComparisonShareFrame';
import { ScoringBreakdown } from '../components/comparison/ScoringBreakdown';
import { DraftStrategyControl } from '../components/comparison/DraftStrategyControl';
import { DraftStrategyBreakdown } from '../components/comparison/DraftStrategyBreakdown';
import { KeeperComparisonBreakdown } from '../components/comparison/KeeperComparisonBreakdown';
import { compareDraftCandidates } from '../lib/draftStrategy';
import { compareKeeperCandidates } from '../lib/keeperAnalysis';
import { Button } from '../components/ui/button';
import { getTeamLogoUrl } from '../lib/teamLogos';
import { mugshotSeason } from '../lib/season';
import { renderElementToPng, shareOrDownloadPng } from '../lib/shareImage';
import { track } from '../lib/analytics';

const INTENTS: PlanningIntent[] = ['week', '14d', '30d', 'playoffs', 'rest-of-season'];

function rosterPlayer(player: DraftPlayer): RosterPlayer {
  return { id: player.id, full_name: player.name, team: player.team, positions: player.pos, current_slot: 'BN', games_played: 0, blendedFppg: player.blendedFppg, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } };
}

function workspaceRoster(activeLeague: LeagueWorkspace): RosterPlayer[] {
  return activeLeague.roster.map((entry) => ({ id: entry.playerId, full_name: entry.fullName, team: entry.team, positions: entry.positions, current_slot: entry.slot, games_played: 0, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } }));
}

const AVAILABILITY_LABELS = { owned: 'On your roster', confirmed: 'Available · confirmed', stale: 'Availability stale', unknown: 'Availability unknown' } as const;
const CONTEXT_LABELS = { draft: 'Player comparison', pickup: 'Pickup decision', roster: 'Roster decision' } as const;

function comparisonAvailabilityLabel(context: keyof typeof CONTEXT_LABELS, availability: keyof typeof AVAILABILITY_LABELS): string {
  return context === 'draft' && availability !== 'owned' ? 'Draft candidate' : AVAILABILITY_LABELS[availability];
}

async function scheduleFallbackProjections(roster: RosterPlayer[], directory: DraftPlayer[], start: string, end: string): Promise<Record<string, PlayerProjection>> {
  const schedule = await loadSeasonSchedule();
  const directoryById = new Map(directory.map((player) => [player.id.replace(/^nhl:/, ''), player]));
  return Object.fromEntries(roster.map((player) => {
    const draft = directoryById.get(player.id.replace(/^nhl:/, ''));
    const fppg = draft?.blendedFppg ?? player.blendedFppg ?? player.seasonFppg ?? 0;
    const games = (schedule.games[player.team] ?? []).filter((game) => game.date >= start && game.date <= end);
    const gamesByDate = Object.fromEntries(games.map((game) => [game.date, { opponent: game.opponent, isHome: game.isHome, isOffNight: Boolean(game.isOffNight), startTime: game.startTime ?? `${game.date}T00:00:00Z` }]));
    return [player.id.replace(/^nhl:/, ''), { fppg, starts: games.length, gamesAvailable: games.length, projectedPoints: fppg * games.length, offNightRate: games.length ? games.filter((game) => game.isOffNight).length / games.length : 0, strengthOfSchedule: 5, gamesByDate } satisfies PlayerProjection];
  }));
}

export function ComparePage() {
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [meta, setMeta] = useState<DraftPlayerDirectoryMeta | null>(null);
  const [projections, setProjections] = useState<Record<string, PlayerProjection>>({});
  const [seasonSchedule, setSeasonSchedule] = useState<SeasonScheduleData | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [projectionSource, setProjectionSource] = useState<'server' | 'schedule-fallback'>('server');
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const trackedComparisonRef = useRef<string | null>(null);
  const leagueProfile = useMemo(() => toLeagueProfile(activeLeague), [activeLeague]);
  const roster = useMemo(() => workspaceRoster(activeLeague), [activeLeague]);
  const keeperRoster = useMemo(() => {
    const keeperIds = new Set(activeLeague.roster.filter((entry) => entry.keeper || entry.protected).map((entry) => entry.playerId.replace(/^nhl:/, '')));
    return roster.filter((player) => keeperIds.has(player.id.replace(/^nhl:/, '')));
  }, [activeLeague.roster, roster]);
  const playerA = useMemo(() => players.find((player) => player.id.replace(/^nhl:/, '') === searchParams.get('a')?.replace(/^nhl:/, '')) ?? null, [players, searchParams]);
  const playerB = useMemo(() => players.find((player) => player.id.replace(/^nhl:/, '') === searchParams.get('b')?.replace(/^nhl:/, '')) ?? null, [players, searchParams]);
  const requestedIntent = searchParams.get('window') as PlanningIntent | null;
  const planningIntent = requestedIntent && INTENTS.includes(requestedIntent) ? requestedIntent : planningIntentFromWorkspace(activeLeague);
  const anchorDate = searchParams.get('start') ?? activeLeague.schedule.defaultWindow.start ?? activeLeague.season.start;
  const requestedMode = searchParams.get('mode');
  const decisionMode = requestedMode === 'draft' || requestedMode === 'keeper' || requestedMode === 'league' ? requestedMode : roster.length === 0 ? 'draft' : 'league';
  const comparisonRoster = decisionMode === 'league' ? roster : keeperRoster;
  const planningWindow = useMemo(() => {
    const resolved = resolvePlanningWindow(planningIntent, anchorDate, activeLeague);
    return planningIntent === 'rest-of-season' && decisionMode !== 'league'
      ? { ...resolved, end: activeLeague.schedule.playoffs.end, label: 'Rest of fantasy season' }
      : resolved;
  }, [activeLeague, anchorDate, decisionMode, planningIntent]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPlayers(true);
    apiService.getDraftPlayers(leagueProfile)
      .then((response) => { if (!cancelled) { setPlayers(response.players); setMeta(response.meta); } })
      .catch(() => { if (!cancelled) setError('The player directory could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoadingPlayers(false); });
    return () => { cancelled = true; };
  }, [leagueProfile]);

  useEffect(() => {
    let cancelled = false;
    loadSeasonSchedule().then((schedule) => { if (!cancelled) setSeasonSchedule(schedule); }).catch(() => { if (!cancelled) setError('The season schedule could not be loaded.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!playerA || !playerB) { setProjections({}); return; }
    let cancelled = false;
    const selected = [rosterPlayer(playerA), rosterPlayer(playerB)];
    const combined = [...comparisonRoster];
    selected.forEach((player) => { if (!combined.some((item) => item.id.replace(/^nhl:/, '') === player.id.replace(/^nhl:/, ''))) combined.push(player); });
    setCalculating(true);
    setError(null);
    apiService.applyRosterLineup({ league: leagueProfile, window: { start: planningWindow.start, end: planningWindow.end }, roster: combined.map((player) => ({ playerId: player.id, slot: player.current_slot ?? 'BN' })) })
      .then(async (response) => {
        const fallback = await scheduleFallbackProjections(combined, players, planningWindow.start, planningWindow.end);
        if (!cancelled) {
          setProjections(reconcileComparisonProjections(fallback, response.projections, players));
          setProjectionSource(Object.keys(response.projections).length > 0 ? 'server' : 'schedule-fallback');
        }
      })
      .catch(async () => {
        try {
          const fallback = await scheduleFallbackProjections(combined, players, planningWindow.start, planningWindow.end);
          if (!cancelled) { setProjections(fallback); setProjectionSource('schedule-fallback'); }
        } catch { if (!cancelled) setError('The schedule-aware comparison could not be calculated right now.'); }
      })
      .finally(() => { if (!cancelled) setCalculating(false); });
    return () => { cancelled = true; };
  }, [comparisonRoster, leagueProfile, planningWindow.end, planningWindow.start, playerA, playerB, players]);

  const analysis = useMemo(() => playerA && playerB && Object.keys(projections).length > 0
    ? analyzePlayerComparison(activeLeague, comparisonRoster, rosterPlayer(playerA), rosterPlayer(playerB), projections, Date.now(), decisionMode === 'league' ? undefined : 'draft')
    : null, [activeLeague, comparisonRoster, decisionMode, playerA, playerB, projections]);
  const draftAnalysis = useMemo(() => decisionMode === 'draft' && playerA && playerB && seasonSchedule
    ? compareDraftCandidates(playerA, playerB, players, keeperRoster, activeLeague, seasonSchedule)
    : null, [activeLeague, decisionMode, keeperRoster, playerA, playerB, players, seasonSchedule]);
  const keeperAnalysis = useMemo(() => decisionMode === 'keeper' && playerA && playerB
    ? compareKeeperCandidates(playerA, playerB, players, activeLeague)
    : null, [activeLeague, decisionMode, playerA, playerB, players]);
  const displayAnalysis = useMemo(() => {
    if (!analysis) return null;
    if (draftAnalysis) return { ...analysis, context: 'draft' as const, winnerId: draftAnalysis.winnerId, verdict: draftAnalysis.verdict, explanation: draftAnalysis.explanation };
    if (keeperAnalysis) return { ...analysis, context: 'draft' as const, winnerId: keeperAnalysis.winnerId, verdict: keeperAnalysis.verdict, explanation: keeperAnalysis.explanation };
    return analysis;
  }, [analysis, draftAnalysis, keeperAnalysis]);

  useEffect(() => {
    if (!displayAnalysis || !playerA || !playerB || calculating) return;
    const key = [playerA.id, playerB.id, decisionMode, planningIntent, planningWindow.start, planningWindow.end].join(':');
    if (trackedComparisonRef.current === key) return;
    trackedComparisonRef.current = key;
    track('coach_reco_run', {
      mode: decisionMode,
      window: planningIntent,
      projection_source: projectionSource,
    });
  }, [calculating, decisionMode, displayAnalysis, planningIntent, planningWindow.end, planningWindow.start, playerA, playerB, projectionSource]);

  const selectPlayer = (key: 'a' | 'b', player: DraftPlayer | null) => {
    const next = new URLSearchParams(searchParams);
    if (player) next.set(key, player.id.replace(/^nhl:/, '')); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const changeWindow = (intent: PlanningIntent) => {
    const nextWindow = resolvePlanningWindow(intent, anchorDate, activeLeague);
    const next = new URLSearchParams(searchParams);
    next.set('window', intent); next.set('start', nextWindow.start);
    setSearchParams(next, { replace: true });
    updateLeague({ ...activeLeague, schedule: { ...activeLeague.schedule, defaultWindow: workspaceWindowPreset(nextWindow) }, updatedAt: new Date().toISOString() });
  };

  const changeDecisionMode = (mode: 'draft' | 'keeper' | 'league') => {
    const next = new URLSearchParams(searchParams);
    next.set('mode', mode);
    setSearchParams(next, { replace: true });
  };

  const copyLink = async () => { await navigator.clipboard.writeText(window.location.href); setShareStatus('Comparison link copied'); };
  const shareImage = async () => {
    if (!shareRef.current || !displayAnalysis) return;
    try {
      const blob = await renderElementToPng(shareRef.current);
      const action = await shareOrDownloadPng(blob, `cracked-ice-${displayAnalysis.optionA.player.full_name}-${displayAnalysis.optionB.player.full_name}.png`, { title: 'Cracked Ice player comparison', text: displayAnalysis.verdict });
      setShareStatus(action === 'shared' ? 'Comparison shared' : 'Comparison PNG downloaded');
    } catch { setShareStatus('Unable to create the comparison image'); }
  };

  return <main className="min-h-screen ice-rink-bg"><div className="container mx-auto space-y-5 px-4 py-6">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="scoreboard-text text-accent">PLAYER DECISION</p><h1 className="font-orbitron mt-1 text-3xl font-bold uppercase tracking-[0.05em] sm:text-4xl">Compare players</h1><p className="mt-2 max-w-2xl text-sm text-ink-dim">See who your league and lineup can actually use—not just who scored more last season.</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Decision mode<select value={decisionMode} onChange={(event) => changeDecisionMode(event.target.value as 'draft' | 'keeper' | 'league')} className="min-h-11 rounded-md border border-line bg-surface-0 px-3 text-sm font-semibold normal-case tracking-normal text-ink"><option value="draft">Pre-draft</option><option value="keeper">Keeper decision</option><option value="league">Current league</option></select></label><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Decision window<select value={planningIntent} onChange={(event) => changeWindow(event.target.value as PlanningIntent)} className="min-h-11 rounded-md border border-line bg-surface-0 px-3 text-sm font-semibold normal-case tracking-normal text-ink"><option value="week">Selected week</option><option value="14d">Next 14 days</option><option value="30d">Next 30 days</option><option value="playoffs">Fantasy playoffs</option><option value="rest-of-season">Rest of season</option></select></label><span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-1 px-3 text-xs text-ink-dim"><CalendarDays size={14} className="text-accent" />{activeLeague.name} · {activeLeague.scoring.label}</span></div></header>

    <section className="grid gap-3 rounded-xl border border-line-strong bg-surface-glass p-4 shadow-card md:grid-cols-[1fr_auto_1fr] md:items-end"><PlayerPicker label="Player A" players={players} selected={playerA} excludeId={playerB?.id} onSelect={(player) => selectPlayer('a', player)} /><ArrowLeftRight className="mx-auto mb-4 hidden text-accent md:block" aria-hidden="true" /><PlayerPicker label="Player B" players={players} selected={playerB} excludeId={playerA?.id} onSelect={(player) => selectPlayer('b', player)} /></section>
    {decisionMode === 'draft' && <DraftStrategyControl value={activeLeague.draftStrategy} onChange={(draftStrategy) => updateLeague({ ...activeLeague, draftStrategy, updatedAt: new Date().toISOString() })} />}
    {loadingPlayers && <div className="rounded-xl border border-line bg-surface-1 p-10 text-center text-ink-dim">Loading league-scored players…</div>}
    {!loadingPlayers && (!playerA || !playerB) && <section className="rounded-xl border border-dashed border-line-strong bg-surface-1 p-10 text-center"><Sparkles className="mx-auto text-accent" size={28} /><h2 className="mt-3 text-lg font-semibold text-ink">Choose two players</h2><p className="mt-1 text-sm text-ink-dim">Cracked Ice will compare production, schedule, and usable lineup starts for {planningWindow.label.toLowerCase()}.</p></section>}
    {calculating && <div className="rounded-xl border border-line bg-surface-1 p-10 text-center text-ink-dim">Solving both lineup scenarios…</div>}
    {error && <div className="rounded-xl border border-negative bg-negative-muted p-4 text-sm text-negative">{error}</div>}

    {displayAnalysis && playerA && playerB && !calculating && <><section className="overflow-hidden rounded-xl border border-accent/60 bg-surface-glass shadow-card"><div className="flex flex-col gap-4 bg-accent-muted p-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="scoreboard-text flex items-center gap-2 text-accent"><CheckCircle2 size={15} />{CONTEXT_LABELS[displayAnalysis.context]}</p><h2 className="font-orbitron mt-1 break-words text-2xl font-bold uppercase leading-tight tracking-[0.05em] sm:text-3xl">{displayAnalysis.verdict}</h2><p className="mt-2 text-sm text-ink-dim">{displayAnalysis.explanation}</p></div><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={copyLink}><Copy size={15} />Copy link</Button><Button variant="ghost" onClick={shareImage}><Share2 size={15} />Share image</Button>{shareStatus && <span aria-live="polite" className="w-full text-right text-xs text-ink-mute">{shareStatus}</span>}</div></div>
      <div className="grid gap-px bg-line lg:grid-cols-2">{[displayAnalysis.optionA, displayAnalysis.optionB].map((option) => { const draft = option.player.id.replace(/^nhl:/, '') === playerA.id.replace(/^nhl:/, '') ? playerA : playerB; const isWinner = displayAnalysis.winnerId === option.player.id; return <article key={option.player.id} className="bg-surface-1 p-5"><div className="flex items-center gap-3"><div className="relative"><img src={`https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${option.player.team}/${option.player.id.replace(/^nhl:/, '')}.png`} alt="" className="size-14 rounded-full border border-line bg-surface-0 object-cover" /><img src={getTeamLogoUrl(option.player.team)} alt="" className="absolute -bottom-1 -right-1 size-6 object-contain" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-bold text-ink">{option.player.full_name}</h3>{isWinner && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">BEST FIT</span>}</div><p className="text-xs text-ink-dim">{option.player.team} · {option.player.positions.join('/')} · {comparisonAvailabilityLabel(displayAnalysis.context, option.availability)}</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="League FPPG" value={option.fppg.toFixed(2)} /><Metric label="NHL games" value={String(option.games)} /><Metric label="Usable starts" value={String(option.usableStarts)} accent /><Metric label="Usable points" value={option.usablePoints.toFixed(1)} accent /></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><SmallMetric label="Blocked" value={option.blockedGames} /><SmallMetric label="Off-night starts" value={option.offNightStarts} /><SmallMetric label="ICE rating" value={option.iceScore?.toFixed(1) ?? '—'} /></div><ScoringBreakdown player={draft} />{option.drop && <p className="mt-3 rounded-md border border-warning/50 bg-warning-muted px-3 py-2 text-xs text-warning">Confirmed pickup scenario: drop {option.drop.full_name}.</p>}{displayAnalysis.context === 'pickup' && option.availability !== 'owned' && option.availability !== 'confirmed' && <p className="mt-3 rounded-md border border-line bg-surface-0 px-3 py-2 text-xs text-ink-dim">What-if only: this player has not been confirmed available in your league.</p>}{option.rosterConstraint && <p className="mt-3 rounded-md border border-warning/50 bg-warning-muted px-3 py-2 text-xs text-warning">This player is marked {option.rosterConstraint} and will not be recommended as a drop.</p>}</article>; })}</div></section>
      {draftAnalysis && <DraftStrategyBreakdown analysis={draftAnalysis} playerA={playerA} playerB={playerB} />}
      {keeperAnalysis && <KeeperComparisonBreakdown analysis={keeperAnalysis} playerA={playerA} playerB={playerB} workspace={activeLeague} onWorkspaceChange={updateLeague} />}
      <section className="rounded-xl border border-line-strong bg-surface-glass p-5 shadow-card"><div className="mb-4"><p className="scoreboard-text text-accent">WHY THE SCHEDULE MATTERS</p><h2 className="mt-1 text-xl font-semibold text-ink">Usable games, not just NHL games</h2><p className="mt-1 text-sm text-ink-dim">Green games fit the simulated lineup. Red games are lost to position and daily-slot congestion.</p></div><ComparisonScheduleStrip optionA={displayAnalysis.optionA} optionB={displayAnalysis.optionB} start={planningWindow.start} end={planningWindow.end} /></section>
      <details className="rounded-xl border border-line bg-surface-1 p-4"><summary className="cursor-pointer font-semibold text-ink">Calculation and data notes</summary><div className="mt-3 grid gap-3 text-sm text-ink-dim sm:grid-cols-2"><p><Info size={14} className="mr-1 inline text-accent" />FPPG uses <strong className="text-ink">{meta?.scoringLabel ?? activeLeague.scoring.label}</strong>. Production source season: {meta?.statsSeason ?? activeLeague.season.id ?? 'not reported'}.</p><p><Info size={14} className="mr-1 inline text-accent" />Window: {planningWindow.start} to {planningWindow.end}. Availability is league-specific evidence and is never inferred from this comparison.</p>{projectionSource === 'schedule-fallback' && <p className="sm:col-span-2"><Info size={14} className="mr-1 inline text-warning" />Live projections were unavailable, so this result uses league-scored FPPG with the configured NHL schedule. ICE and opponent-strength adjustments are omitted.</p>}</div></details>
      <div className="flex justify-center"><Button asChild variant="ghost"><Link to="/team">Back to My Team</Link></Button></div><div aria-hidden="true" className="fixed -left-[10000px] top-0"><ComparisonShareFrame ref={shareRef} analysis={displayAnalysis} draftAnalysis={draftAnalysis} keeperAnalysis={keeperAnalysis} leagueName={activeLeague.name} scoringLabel={meta?.scoringLabel ?? activeLeague.scoring.label} sourceSeason={meta?.statsSeason ?? activeLeague.season.id ?? 'season not reported'} start={planningWindow.start} end={planningWindow.end} /></div></>}
  </div></main>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="rounded-lg border border-line bg-surface-0 p-3"><strong className={`block font-mono text-2xl ${accent ? 'text-accent' : 'text-ink'}`}>{value}</strong><span className="text-[11px] text-ink-mute">{label}</span></div>; }
function SmallMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-md bg-surface-0 px-2 py-2"><strong className="block text-sm text-ink">{value}</strong><span className="text-[10px] text-ink-mute">{label}</span></div>; }
