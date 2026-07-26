import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, Check, ChevronDown, Clock3, History, Maximize2, PanelRightOpen, Search, Star, Target, Trophy, Undo2, UserCheck, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { DRAFT_STRATEGY_PRESETS, toLeagueProfile, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { rankDraftCandidates, type RankedDraftCandidate } from '../../lib/draftStrategy';
import { DRAFT_TIER_POSITIONS, assignDraftSlot, buildDraftCandidateContext, buildDraftTiers, currentDraftRound, readDraftRoomLayout, withDraftRoomLayout } from '../../lib/draftRoom';
import type { DraftPlayer, DraftPlayerDirectoryMeta } from '../../lib/playerSearch';
import { loadSeasonSchedule, type SeasonScheduleData } from '../../lib/schedulePlanning';
import { analyzeKeeperRosterPlan } from '../../lib/myTeamAnalysis';
import { mugshotSeason } from '../../lib/season';
import { getTeamLogoUrl } from '../../lib/teamLogos';
import { apiService } from '../../services/api';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { Card } from '../Card';
import { EmptyState } from '../ui/empty-state';
import { DraftStrategyControl } from '../comparison/DraftStrategyControl';
import { ManualDraftControls } from './ManualDraftControls';

const POSITIONS = ['ALL', 'C', 'LW', 'RW', 'D', 'G'] as const;
type PositionFilter = typeof POSITIONS[number];
type BoardView = 'recommended' | 'tiers' | 'targets';

function normalizeId(id: string) {
  return id.replace(/^nhl:/, '');
}

function asRosterPlayer(player: DraftPlayer, slot = 'BN'): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    current_slot: slot,
    games_played: player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0,
    blendedFppg: player.blendedFppg ?? 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
  };
}

export function DraftBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [meta, setMeta] = useState<DraftPlayerDirectoryMeta | null>(null);
  const [schedule, setSchedule] = useState<SeasonScheduleData | null>(null);
  const [position, setPosition] = useState<PositionFilter>('ALL');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<BoardView>('recommended');
  const [visibleTierCount, setVisibleTierCount] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rankingWorkspaceRef = useRef(activeLeague);
  rankingWorkspaceRef.current = activeLeague;
  const leagueProfile = useMemo(() => toLeagueProfile(activeLeague), [activeLeague.numberOfTeams, activeLeague.rosterRules, activeLeague.scoring, activeLeague.schedule]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([apiService.getDraftPlayers(leagueProfile), loadSeasonSchedule()])
      .then(([directory, seasonSchedule]) => {
        if (cancelled) return;
        setPlayers(directory.players);
        setMeta(directory.meta);
        setSchedule(seasonSchedule);
      })
      .catch(() => { if (!cancelled) setError('The Draft Room could not load its player or schedule data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leagueProfile]);

  const updateDraftSession = (draftSession: LeagueWorkspace['draftSession']) => {
    updateLeague({ ...activeLeague, draftSession, updatedAt: new Date().toISOString() });
  };
  const pickedIds = useMemo(() => new Set(activeLeague.draftSession.picks.map((pick) => normalizeId(pick.playerId))), [activeLeague.draftSession.picks]);
  const keeperIds = useMemo(() => new Set(activeLeague.roster.filter((entry) => entry.keeper || entry.protected).map((entry) => normalizeId(entry.playerId))), [activeLeague.roster]);
  const modeledRoster = useMemo(() => {
    const kept = players.filter((player) => keeperIds.has(normalizeId(player.id))).map((player) => asRosterPlayer(player));
    const mine = activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').flatMap((pick) => {
      const player = players.find((candidate) => normalizeId(candidate.id) === normalizeId(pick.playerId));
      return player ? [asRosterPlayer(player, pick.slot)] : [];
    });
    return [...kept, ...mine];
  }, [activeLeague.draftSession.picks, keeperIds, players]);
  const candidatePool = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return players
      .filter((player) => player.blendedFppg !== null)
      .filter((player) => !keeperIds.has(normalizeId(player.id)) && !pickedIds.has(normalizeId(player.id)))
      .filter((player) => position === 'ALL' || player.pos.includes(position))
      .filter((player) => !normalizedQuery || player.name.toLocaleLowerCase().includes(normalizedQuery) || player.team.toLocaleLowerCase().includes(normalizedQuery))
      .filter((player) => normalizedQuery || (player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0) >= (player.pos.includes('G') ? 25 : 20))
      .sort((a, b) => (b.blendedFppg ?? 0) - (a.blendedFppg ?? 0))
      .slice(0, 140);
  }, [keeperIds, pickedIds, players, position, query]);
  const rankings = useMemo(() => schedule ? rankDraftCandidates(candidatePool, players, modeledRoster, rankingWorkspaceRef.current, schedule) : [], [candidatePool, modeledRoster, players, schedule, activeLeague.draftStrategy, activeLeague.rosterRules, activeLeague.schedule, activeLeague.scoring]);
  const tiers = useMemo(() => buildDraftTiers(
    rankings.slice(0, 100),
    2.75,
    position === 'ALL' ? DRAFT_TIER_POSITIONS : [position],
  ), [position, rankings]);
  const skaterRankings = useMemo(() => rankings.filter((candidate) => !candidate.player.pos.includes('G')), [rankings]);
  const goalieRankings = useMemo(() => rankings.filter((candidate) => candidate.player.pos.includes('G')), [rankings]);
  const boardRankings = position === 'ALL' ? skaterRankings : rankings;
  const contextById = useMemo(() => buildDraftCandidateContext(rankings), [rankings]);
  const playerById = useMemo(() => new Map(players.map((player) => [normalizeId(player.id), player])), [players]);
  const targetById = useMemo(() => new Map(activeLeague.draftSession.targets.map((target) => [normalizeId(target.playerId), target])), [activeLeague.draftSession.targets]);
  const selected = selectedId ? rankings.find((candidate) => normalizeId(candidate.player.id) === normalizeId(selectedId)) ?? null : null;
  const keeperPlan = useMemo(() => analyzeKeeperRosterPlan(activeLeague), [activeLeague]);
  const availablePlayerCount = useMemo(() => players.filter((player) => player.blendedFppg !== null && !keeperIds.has(normalizeId(player.id)) && !pickedIds.has(normalizeId(player.id))).length, [keeperIds, pickedIds, players]);
  const round = currentDraftRound(activeLeague);
  const strategyLabel = activeLeague.draftStrategy.presetId === 'custom' ? 'Custom strategy' : DRAFT_STRATEGY_PRESETS[activeLeague.draftStrategy.presetId].label;
  const layout = readDraftRoomLayout(searchParams);
  const setLayout = (nextLayout: 'full' | 'compact') => setSearchParams(withDraftRoomLayout(searchParams, nextLayout));

  const markPlayer = (candidate: RankedDraftCandidate, status: 'mine' | 'taken') => {
    if (pickedIds.has(normalizeId(candidate.player.id))) return;
    const slot = status === 'mine' ? assignDraftSlot(activeLeague, candidate.player) : undefined;
    updateDraftSession({
      ...activeLeague.draftSession,
      status: 'live',
      picks: [...activeLeague.draftSession.picks, {
        playerId: normalizeId(candidate.player.id), fullName: candidate.player.name, team: candidate.player.team,
        positions: candidate.player.pos, status, slot, source: 'manual', madeAt: new Date().toISOString(),
      }],
    });
    setSelectedId(null);
  };

  const toggleTarget = (candidate: RankedDraftCandidate) => {
    const id = normalizeId(candidate.player.id);
    const exists = targetById.has(id);
    updateDraftSession({
      ...activeLeague.draftSession,
      targets: exists
        ? activeLeague.draftSession.targets.filter((target) => normalizeId(target.playerId) !== id)
        : [...activeLeague.draftSession.targets, { playerId: id, fullName: candidate.player.name, priority: 'normal', targetRound: null, addedAt: new Date().toISOString() }],
    });
  };

  const setTargetRound = (playerId: string, targetRound: number | null) => updateDraftSession({
    ...activeLeague.draftSession,
    targets: activeLeague.draftSession.targets.map((target) => normalizeId(target.playerId) === normalizeId(playerId) ? { ...target, targetRound } : target),
  });

  const adjustPlayerRank = (playerId: string, delta: number) => {
    const id = normalizeId(playerId);
    const current = activeLeague.draftSession.rankAdjustments[id] ?? 0;
    const next = Math.max(-20, Math.min(20, current + delta));
    const rankAdjustments = { ...activeLeague.draftSession.rankAdjustments };
    if (next === 0) delete rankAdjustments[id];
    else rankAdjustments[id] = next;
    updateDraftSession({ ...activeLeague.draftSession, rankAdjustments });
  };

  const lastManualPickIndex = activeLeague.draftSession.picks.map((pick) => pick.source === 'manual').lastIndexOf(true);
  const undoLast = () => {
    if (lastManualPickIndex < 0) return;
    updateDraftSession({
      ...activeLeague.draftSession,
      picks: activeLeague.draftSession.picks.filter((_, index) => index !== lastManualPickIndex),
    });
  };

  const recordManualSelections = (selections: Array<{ player: DraftPlayer; status: 'mine' | 'taken' }>) => {
    const now = new Date().toISOString();
    let nextPicks = [...activeLeague.draftSession.picks];
    const alreadyPicked = new Set(nextPicks.map((pick) => normalizeId(pick.playerId)));
    for (const { player, status } of selections) {
      const playerId = normalizeId(player.id);
      if (alreadyPicked.has(playerId)) continue;
      const draftWorkspace = { ...activeLeague, draftSession: { ...activeLeague.draftSession, picks: nextPicks } };
      nextPicks.push({
        playerId,
        fullName: player.name,
        team: player.team,
        positions: player.pos,
        status,
        slot: status === 'mine' ? assignDraftSlot(draftWorkspace, player) : undefined,
        source: 'manual',
        madeAt: now,
      });
      alreadyPicked.add(playerId);
    }
    updateDraftSession({
      ...activeLeague.draftSession,
      status: 'live',
      picks: nextPicks,
    });
  };

  const urgent = boardRankings.slice(0, 24).filter((candidate) => contextById.get(normalizeId(candidate.player.id))?.advice === 'take-now').sort((a, b) => (contextById.get(normalizeId(b.player.id))?.dropToNextAtPosition ?? 0) - (contextById.get(normalizeId(a.player.id))?.dropToNextAtPosition ?? 0))[0];
  const playoff = [...boardRankings.slice(0, 30)].sort((a, b) => b.score.metrics.playoffUsableStarts - a.score.metrics.playoffUsableStarts || b.score.total - a.score.total)[0];
  const recommendations = [boardRankings[0], urgent, playoff].filter((candidate, index, list): candidate is RankedDraftCandidate => Boolean(candidate) && list.findIndex((item) => item?.player.id === candidate?.player.id) === index).slice(0, position === 'ALL' ? 2 : 3);
  const goalieWatch = position === 'ALL' ? goalieRankings[0] : undefined;
  const hasMoreTiers = position === 'ALL'
    ? DRAFT_TIER_POSITIONS.some((tierPosition) => tiers.filter((tier) => tier.position === tierPosition).length > visibleTierCount)
    : tiers.length > visibleTierCount;

  if (layout === 'compact') return <div className="mx-auto max-w-[760px] space-y-3">
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="scoreboard-text text-accent">SECOND-SCREEN MODE</p><h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.05em]">Draft Room</h1><p className="mt-1 text-xs text-ink-dim">Fast picks, targets, and the next tier decision.</p><WorkspaceContextSummary workspace={activeLeague} keeperCount={keeperPlan.keeperCount} compact /></div>
        <button type="button" onClick={() => setLayout('full')} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><Maximize2 size={14} />Full view</button>
      </div>
      <div className="grid grid-cols-4 gap-px border-y border-line bg-line"><CompactStatus label="Round" value={round} /><CompactStatus label="Mine" value={activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} /><CompactStatus label="Available" value={availablePlayerCount} /><CompactStatus label="Targets" value={activeLeague.draftSession.targets.filter((target) => !pickedIds.has(normalizeId(target.playerId))).length} /></div>
      <div className="flex flex-col gap-2 bg-surface-0 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"><DraftSyncSummary workspace={activeLeague} />{lastManualPickIndex >= 0 && <button type="button" onClick={undoLast} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-line px-2 text-xs font-semibold text-ink-dim"><Undo2 size={13} />Undo</button>}</div>
      <div className="border-t border-line bg-surface-1 px-4 py-3"><ManualDraftControls players={players} draftedIds={pickedIds} onRecord={recordManualSelections} /></div>
    </Card>

    <Card className="p-3"><DraftStrategyControl compact value={activeLeague.draftStrategy} onChange={(draftStrategy) => updateLeague({ ...activeLeague, draftStrategy, updatedAt: new Date().toISOString() })} /></Card>

    <Card className="p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="scoreboard-text text-accent">MY TARGETS</p><h2 className="text-base font-semibold text-ink">Upcoming choices</h2></div><Target size={17} className="text-accent" /></div>
      <TargetSummary compact targets={activeLeague.draftSession.targets} playerById={playerById} pickedIds={pickedIds} round={round} onRoundChange={setTargetRound} onSelect={setSelectedId} />
    </Card>

    <Card className="overflow-hidden">
      <div className="border-b border-line p-4"><p className="scoreboard-text text-accent">RECOMMENDED NOW</p><h2 className="text-base font-semibold text-ink">Best decisions at this pick</h2></div>
      <div className="divide-y divide-line">{recommendations.map((candidate, index) => <CompactDraftRow key={candidate.player.id} candidate={candidate} label={index === 0 ? 'Best overall' : candidate === urgent ? 'Tier urgency' : 'Playoff edge'} context={contextById.get(normalizeId(candidate.player.id))} targeted={targetById.has(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onTarget={() => toggleTarget(candidate)} onMine={() => markPlayer(candidate, 'mine')} onTaken={() => markPlayer(candidate, 'taken')} />)}</div>
    </Card>

    {selected && <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div><p className="scoreboard-text text-accent">PLAYER INFO</p><h2 className="text-base font-semibold text-ink">Decision context</h2></div><button type="button" aria-label="Close player info" onClick={() => setSelectedId(null)} className="grid size-8 place-items-center rounded-md border border-line text-ink-mute"><X size={14} /></button></div><SelectedPlayer candidate={selected} context={contextById.get(normalizeId(selected.player.id))} targeted={targetById.has(normalizeId(selected.player.id))} onAdjust={(delta) => adjustPlayerRank(selected.player.id, delta)} onTarget={() => toggleTarget(selected)} onMine={() => markPlayer(selected, 'mine')} onTaken={() => markPlayer(selected, 'taken')} /></Card>}

    <Card className="overflow-hidden">
      <div className="border-b border-line p-4"><div className="flex items-center justify-between gap-3"><div><p className="scoreboard-text text-accent">AVAILABLE NOW</p><h2 className="text-base font-semibold text-ink">Short board</h2></div><span className="text-[10px] text-ink-mute">{strategyLabel}</span></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="inline-flex flex-wrap rounded-lg border border-line bg-surface-0 p-1" aria-label="Compact draft position filter">{POSITIONS.map((item) => <button key={item} type="button" onClick={() => setPosition(item)} className={`rounded-md px-2 py-1.5 text-[10px] font-semibold ${position === item ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>{item}</button>)}</div><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={14} /><span className="sr-only">Search compact draft board</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find player or team" className="min-h-9 w-full rounded-lg border border-line bg-surface-0 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" /></label></div></div>
      {loading && <div className="p-6 text-center text-sm text-ink-dim">Building your short board…</div>}
      {!loading && error && <div className="p-4"><EmptyState title="Draft Room unavailable" description={error} /></div>}
      {!loading && !error && boardRankings.length === 0 && <div className="p-4"><EmptyState title="No matching players" description="Change the position or search filter." /></div>}
      {!loading && !error && <div className="divide-y divide-line">{boardRankings.slice(0, 12).map((candidate) => <CompactDraftRow key={candidate.player.id} candidate={candidate} context={contextById.get(normalizeId(candidate.player.id))} targeted={targetById.has(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onTarget={() => toggleTarget(candidate)} onMine={() => markPlayer(candidate, 'mine')} onTaken={() => markPlayer(candidate, 'taken')} />)}</div>}
      {!loading && !error && position === 'ALL' && goalieWatch && <div className="border-t border-line bg-surface-0 p-3"><p className="scoreboard-text text-positive">GOALIE LANE</p><CompactDraftRow candidate={goalieWatch} context={contextById.get(normalizeId(goalieWatch.player.id))} targeted={targetById.has(normalizeId(goalieWatch.player.id))} onSelect={() => setSelectedId(goalieWatch.player.id)} onTarget={() => toggleTarget(goalieWatch)} onMine={() => markPlayer(goalieWatch, 'mine')} onTaken={() => markPlayer(goalieWatch, 'taken')} /></div>}
      <div className="border-t border-line p-3 text-center"><button type="button" onClick={() => setLayout('full')} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><Maximize2 size={13} />Open full tiers and strategy</button></div>
    </Card>

    <div className="grid gap-3 sm:grid-cols-2"><Card className="p-4"><div className="flex items-center justify-between"><div><p className="scoreboard-text text-accent">RECENT PICKS</p><h2 className="text-base font-semibold text-ink">Draft activity</h2></div><History size={16} className="text-ink-mute" /></div><RecentDraftPicks workspace={activeLeague} limit={5} /></Card><Card className="p-4"><p className="scoreboard-text text-accent">ROSTER NEEDS</p><p className="mt-2 text-xs text-ink-dim">{keeperPlan.keeperCount} keepers · {activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} drafted</p><p className="mt-2 text-sm text-ink">{remainingNeeds(activeLeague)}</p></Card></div>
  </div>;

  return <div className="mx-auto max-w-[1500px] space-y-4">
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div><p className="scoreboard-text text-accent">LIVE DRAFT COMPANION</p><h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.05em] sm:text-3xl">Draft Room</h1><p className="mt-1 text-sm text-ink-dim">Tiers, targets, league scoring, roster needs, and playoff fit in one fast workspace.</p><WorkspaceContextSummary workspace={activeLeague} keeperCount={keeperPlan.keeperCount} /><button type="button" onClick={() => setLayout('compact')} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><PanelRightOpen size={14} />Compact second-screen view</button></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatusMetric label="Round" value={round} />
          <StatusMetric label="My picks" value={activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} />
          <StatusMetric label="Available" value={availablePlayerCount} />
          <StatusMetric label="Targets" value={activeLeague.draftSession.targets.filter((target) => !pickedIds.has(normalizeId(target.playerId))).length} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line bg-surface-0 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <DraftSyncSummary workspace={activeLeague} />
        {lastManualPickIndex >= 0 && <button type="button" onClick={undoLast} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-line px-2.5 font-semibold text-ink-dim hover:text-ink"><Undo2 size={14} />Undo manual pick</button>}
      </div>
      <div className="border-t border-line bg-surface-1 px-4 py-3 sm:px-5"><ManualDraftControls players={players} draftedIds={pickedIds} onRecord={recordManualSelections} /></div>
    </Card>

    <Card className="p-4"><DraftStrategyControl value={activeLeague.draftStrategy} onChange={(draftStrategy) => updateLeague({ ...activeLeague, draftStrategy, updatedAt: new Date().toISOString() })} /><p className="mt-3 text-xs text-ink-mute">{meta?.statsSeason ?? 'Prior-season'} NHL stats · default pool requires 20 skater GP / 25 goalie GP · rankings update after every recorded pick</p></Card>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card className="draft-recommendations p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="scoreboard-text text-accent">RECOMMENDED NOW</p><h2 className="text-lg font-semibold text-ink">Take value before the tier drops</h2></div><div className="flex rounded-lg border border-line bg-surface-0 p-1">{(['recommended', 'tiers', 'targets'] as BoardView[]).map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-md px-3 py-2 text-xs font-semibold capitalize ${view === item ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{item}</button>)}</div></div>
          {view === 'recommended' && <div className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">{recommendations.map((candidate, index) => <RecommendationCard key={candidate.player.id} candidate={candidate} label={index === 0 ? (position === 'ALL' ? 'Best skater' : 'Best available') : candidate === urgent ? 'Tier urgency' : 'Playoff edge'} context={contextById.get(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onMine={() => markPlayer(candidate, 'mine')} />)}{goalieWatch && <RecommendationCard key={`goalie-${goalieWatch.player.id}`} candidate={goalieWatch} label="Goalie lane" context={contextById.get(normalizeId(goalieWatch.player.id))} onSelect={() => setSelectedId(goalieWatch.player.id)} onMine={() => markPlayer(goalieWatch, 'mine')} />}</div>}
          {view === 'targets' && <TargetSummary targets={activeLeague.draftSession.targets} playerById={playerById} pickedIds={pickedIds} round={round} onRoundChange={setTargetRound} onSelect={setSelectedId} />}
          {view === 'tiers' && <p className="mt-4 rounded-lg border border-line bg-surface-0 p-3 text-sm text-ink-dim">The full board below is grouped by value tier. A larger drop to the next player at a position means waiting is more expensive.</p>}
        </Card>

        {selected && <Card className="overflow-hidden xl:hidden"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div><p className="scoreboard-text text-accent">PLAYER INFO</p><h2 className="text-base font-semibold text-ink">Decision context</h2></div><button type="button" aria-label="Close player info" onClick={() => setSelectedId(null)} className="grid size-8 place-items-center rounded-md border border-line text-ink-mute"><X size={14} /></button></div><SelectedPlayer candidate={selected} context={contextById.get(normalizeId(selected.player.id))} targeted={targetById.has(normalizeId(selected.player.id))} onAdjust={(delta) => adjustPlayerRank(selected.player.id, delta)} onTarget={() => toggleTarget(selected)} onMine={() => markPlayer(selected, 'mine')} onTaken={() => markPlayer(selected, 'taken')} /></Card>}

        <Card className="draft-player-pool overflow-hidden">
          <div className="border-b border-line p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="scoreboard-text text-accent">PLAYER POOL</p><h2 className="text-lg font-semibold text-ink">{strategyLabel} tiers</h2></div><div className="flex flex-col gap-2 sm:flex-row"><div className="inline-flex flex-wrap rounded-lg border border-line bg-surface-0 p-1" aria-label="Draft board position filter">{POSITIONS.map((item) => <button key={item} type="button" onClick={() => setPosition(item)} className={`rounded-md px-2.5 py-2 text-xs font-semibold ${position === item ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{item}</button>)}</div><label className="relative block min-w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={16} /><span className="sr-only">Search draft board</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" className="min-h-10 w-full rounded-lg border border-line bg-surface-0 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" /></label></div></div></div>
          {loading && <div className="p-10 text-center text-ink-dim">Building your Draft Room…</div>}
          {!loading && error && <div className="p-4"><EmptyState title="Draft Room unavailable" description={error} /></div>}
          {!loading && !error && tiers.length === 0 && <div className="p-4"><EmptyState title="No matching players" description="Change the position or search filter." /></div>}
          {!loading && !error && (position === 'ALL' ? DRAFT_TIER_POSITIONS.flatMap((tierPosition) => tiers.filter((tier) => tier.position === tierPosition).slice(0, visibleTierCount)) : tiers.slice(0, visibleTierCount)).map((tier) => <section key={`${tier.position}-${tier.number}`} className={`border-b border-line last:border-b-0 ${tier.position === 'G' ? 'bg-positive-muted/10' : ''}`}><div className="sticky top-0 z-10 flex items-center justify-between bg-surface-2/95 px-4 py-2 [backdrop-filter:var(--frost)] sm:px-5"><div className="flex items-center gap-2"><span className={`scoreboard-text ${tier.position === 'G' ? 'text-positive' : 'text-accent'}`}>{tier.label}</span><span className="text-[10px] text-ink-mute">{tier.candidates.length} comparable player{tier.candidates.length === 1 ? '' : 's'} remain</span></div><ChevronDown size={14} className="text-ink-mute" /></div><div className="divide-y divide-line">{tier.candidates.map((candidate) => <DraftPlayerRow key={`${tier.position}-${candidate.player.id}`} candidate={candidate} context={contextById.get(normalizeId(candidate.player.id))} targeted={targetById.has(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onTarget={() => toggleTarget(candidate)} onMine={() => markPlayer(candidate, 'mine')} onTaken={() => markPlayer(candidate, 'taken')} />)}</div></section>)}
          {!loading && !error && hasMoreTiers && <div className="p-4 text-center"><button type="button" onClick={() => setVisibleTierCount((count) => count + 2)} className="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink-dim hover:border-accent hover:text-accent">Load two more tiers per position</button></div>}
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="scoreboard-text text-accent">MY TARGETS</p><h2 className="text-base font-semibold text-ink">Personal draft queue</h2></div><Target size={18} className="text-accent" /></div><TargetSummary compact targets={activeLeague.draftSession.targets} playerById={playerById} pickedIds={pickedIds} round={round} onRoundChange={setTargetRound} onSelect={setSelectedId} /></Card>
        <Card className="hidden overflow-hidden xl:block"><div className="border-b border-line p-4"><p className="scoreboard-text text-accent">PLAYER INFO</p><h2 className="text-base font-semibold text-ink">Decision context</h2></div>{selected ? <SelectedPlayer candidate={selected} context={contextById.get(normalizeId(selected.player.id))} targeted={targetById.has(normalizeId(selected.player.id))} onAdjust={(delta) => adjustPlayerRank(selected.player.id, delta)} onTarget={() => toggleTarget(selected)} onMine={() => markPlayer(selected, 'mine')} onTaken={() => markPlayer(selected, 'taken')} /> : <p className="p-4 text-sm text-ink-dim">Select a player to inspect their league and schedule fit.</p>}</Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="scoreboard-text text-accent">DRAFTED</p><h2 className="text-base font-semibold text-ink">Recent activity</h2></div><History size={17} className="text-ink-mute" /></div><div className="mt-3 space-y-2">{activeLeague.draftSession.picks.length ? [...activeLeague.draftSession.picks].reverse().slice(0, 8).map((pick, index) => <div key={`${pick.playerId}-${pick.madeAt}-${index}`} className="flex items-center gap-2 rounded-md border border-line bg-surface-0 px-2.5 py-2"><span className={`grid size-6 place-items-center rounded-full ${pick.status === 'mine' ? 'bg-positive-muted text-positive' : 'bg-surface-2 text-ink-mute'}`}>{pick.status === 'mine' ? <UserCheck size={13} /> : <X size={13} />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{pick.fullName}</span><span className="text-[10px] text-ink-mute">{pick.status === 'mine' ? pick.slot ?? 'Mine' : 'Taken'}</span></div>) : <p className="text-sm text-ink-dim">No selections recorded yet.</p>}</div></Card>
        <Card className="p-4"><p className="scoreboard-text text-accent">ROSTER NEEDS</p><p className="mt-2 text-xs text-ink-dim">{keeperPlan.keeperCount} keeper{keeperPlan.keeperCount === 1 ? '' : 's'} · {activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} drafted by you</p><p className="mt-2 text-sm text-ink">{remainingNeeds(activeLeague)}</p><Link to="/team" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">Manage keepers</Link></Card>
      </aside>
    </div>

  </div>;
}

function WorkspaceContextSummary({ workspace, keeperCount, compact = false }: { workspace: LeagueWorkspace; keeperCount: number; compact?: boolean }) {
  const windowLabel = workspace.schedule.defaultWindow.preset.replace(/-/g, ' ');
  return <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`} aria-label="Active draft context">
    <span className="rounded-full border border-line bg-surface-0 px-2.5 py-1 text-[10px] font-semibold text-ink-dim">{workspace.name}</span>
    <span className="rounded-full border border-line bg-surface-0 px-2.5 py-1 text-[10px] font-semibold text-ink-dim">{workspace.scoring.label}</span>
    <span className="rounded-full border border-line bg-surface-0 px-2.5 py-1 text-[10px] font-semibold capitalize text-ink-dim">{windowLabel}</span>
    <span className="rounded-full border border-line bg-surface-0 px-2.5 py-1 text-[10px] font-semibold text-ink-dim">{keeperCount} keeper{keeperCount === 1 ? '' : 's'} modeled</span>
  </div>;
}

function remainingNeeds(workspace: LeagueWorkspace) {
  const capacity = { ...workspace.rosterRules.slots };
  const consume = (slot?: string) => { const key = slot?.replace(/-\d+$/, ''); if (key && capacity[key] > 0) capacity[key] -= 1; };
  workspace.roster.filter((entry) => entry.keeper).forEach((entry) => consume(entry.slot ?? entry.positions[0]));
  workspace.draftSession.picks.filter((pick) => pick.status === 'mine').forEach((pick) => consume(pick.slot));
  const needs = Object.entries(capacity).filter(([slot, count]) => !['BN', 'IR', 'IR+'].includes(slot) && count > 0).map(([slot, count]) => `${slot} ×${count}`);
  return needs.length ? needs.join(' · ') : 'Active lineup filled; build depth next.';
}

function StatusMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-24 rounded-lg border border-line bg-surface-0 px-3 py-2"><strong className="block font-mono text-lg text-accent">{value}</strong><span className="text-[10px] uppercase tracking-wide text-ink-mute">{label}</span></div>;
}

function CompactStatus({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 bg-surface-1 px-2 py-2.5 text-center"><strong className="block truncate font-mono text-base text-accent">{value}</strong><span className="block truncate text-[9px] uppercase tracking-wide text-ink-mute">{label}</span></div>;
}

function DraftSyncSummary({ workspace }: { workspace: LeagueWorkspace }) {
  const sync = workspace.draftSession.sync;
  if (sync.mode === 'provider') {
    const detail = sync.status === 'error'
      ? sync.lastError ?? 'The last provider refresh needs attention.'
      : sync.lastSyncedAt ? `Last provider snapshot ${new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Waiting for the first provider snapshot.';
    return <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${sync.status === 'error' ? 'border-warning text-warning' : 'border-positive text-positive'}`}><Clock3 size={13} />Yahoo snapshot</span><span className="text-ink-mute">{detail}</span></div>;
  }
  return <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-ink-dim"><Clock3 size={13} />Manual tracking</span><span className="text-ink-mute">{workspace.platform === 'yahoo' ? 'Yahoo is selected, but provider draft access is not connected.' : 'Use bulk catch-up instead of crossing off every pick.'}</span></div>;
}

function PlayerIdentity({ player }: { player: DraftPlayer }) {
  return <div className="flex min-w-0 items-center gap-2.5"><div className="relative shrink-0"><img src={`https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${player.team}/${normalizeId(player.id)}.png`} alt="" className="size-10 rounded-full border border-line bg-surface-0 object-cover" /><img src={getTeamLogoUrl(player.team)} alt="" className="absolute -bottom-1 -right-1 size-4 object-contain" /></div><div className="min-w-0"><strong className="block truncate text-sm text-ink">{player.name}</strong><span className="text-[10px] text-ink-mute">{player.pos.join('/')} · {player.team}</span></div></div>;
}

function CompactDraftRow({ candidate, label, context, targeted, onSelect, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; label?: string; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; targeted: boolean; onSelect: () => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  return <article className="p-3 sm:p-4">
    <div className="flex items-start gap-3"><button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">{label && <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-accent">{label}</span>}<PlayerIdentity player={candidate.player} /></button><div className="shrink-0 text-right"><strong className="block font-mono text-lg text-accent">{candidate.score.total.toFixed(1)}</strong><span className="text-[9px] text-ink-mute">draft score</span></div></div>
    <div className="mt-3 grid grid-cols-3 gap-1.5"><MiniMetric value={candidate.score.metrics.projectedFppg.toFixed(2)} label="projected" /><MiniMetric value={`${candidate.score.metrics.playoffUsableStarts}/${candidate.score.metrics.championshipWeek.usableStarts}`} label="PO / final" /><MiniMetric value={context?.dropToNextAtPosition ?? 0} label="next drop" /></div>
    <div className="mt-3 flex items-center gap-1.5"><button type="button" aria-label={`${targeted ? 'Remove' : 'Add'} ${candidate.player.name} ${targeted ? 'from' : 'to'} targets`} aria-pressed={targeted} onClick={onTarget} className={`grid size-9 shrink-0 place-items-center rounded-md border ${targeted ? 'border-warning bg-warning-muted text-warning' : 'border-line text-ink-mute'}`}><Star size={14} fill={targeted ? 'currentColor' : 'none'} /></button><p className={`min-w-0 flex-1 text-[10px] font-semibold ${context?.advice === 'take-now' ? 'text-warning' : context?.advice === 'can-wait' ? 'text-positive' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? 'Tier drop soon' : context?.advice === 'can-wait' ? 'Comparable players remain' : 'Close decision'}</p><button type="button" onClick={onTaken} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Taken</button><button type="button" onClick={onMine} className="min-h-9 rounded-md bg-accent px-3 text-xs font-bold text-accent-ink">Mine</button></div>
  </article>;
}

function RecentDraftPicks({ workspace, limit }: { workspace: LeagueWorkspace; limit: number }) {
  if (!workspace.draftSession.picks.length) return <p className="mt-3 text-sm text-ink-dim">No selections recorded yet.</p>;
  return <div className="mt-3 space-y-1.5">{[...workspace.draftSession.picks].reverse().slice(0, limit).map((pick, index) => <div key={`${pick.playerId}-${pick.madeAt}-${index}`} className="flex items-center gap-2 rounded-md border border-line bg-surface-0 px-2.5 py-2"><span className={`grid size-6 place-items-center rounded-full ${pick.status === 'mine' ? 'bg-positive-muted text-positive' : 'bg-surface-2 text-ink-mute'}`}>{pick.status === 'mine' ? <UserCheck size={13} /> : <X size={13} />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{pick.fullName}</span><span className="text-[10px] text-ink-mute">{pick.status === 'mine' ? pick.slot ?? 'Mine' : 'Taken'}</span></div>)}</div>;
}

function RecommendationCard({ candidate, label, context, onSelect, onMine }: { candidate: RankedDraftCandidate; label: string; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; onSelect: () => void; onMine: () => void }) {
  return <article className="rounded-xl border border-line bg-surface-0 p-3"><div className="flex items-center justify-between gap-2"><span className="scoreboard-text text-accent">{label}</span><span className="rounded-full bg-accent-muted px-2 py-1 text-[10px] font-bold text-accent">{context?.position ?? candidate.player.pos[0]} Tier {context?.tier ?? '—'}</span></div><button type="button" onClick={onSelect} className="mt-3 w-full text-left"><PlayerIdentity player={candidate.player} /></button><div className="mt-3 grid grid-cols-3 gap-1.5"><MiniMetric value={candidate.score.total.toFixed(1)} label="score" /><MiniMetric value={candidate.score.metrics.projectedFppg.toFixed(2)} label="projected" /><MiniMetric value={`${candidate.score.metrics.playoffUsableStarts}/${candidate.score.metrics.championshipWeek.usableStarts}`} label="PO / final" /></div><p className={`mt-2 text-[10px] font-semibold capitalize ${projectionTone(candidate.score.metrics.projectionTrajectory)}`}>{candidate.score.metrics.projectionTrajectory} · {candidate.score.metrics.projectionConfidence} confidence</p><p className={`mt-2 text-xs ${context?.advice === 'take-now' ? 'text-warning' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? `Take now · ${context.dropToNextAtPosition} point drop at ${context.position}` : `${context?.similarAtPosition ?? 0} comparable ${context?.position ?? 'position'} option${context?.similarAtPosition === 1 ? '' : 's'} remain`}</p><button type="button" onClick={onMine} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-bold text-accent-ink"><Check size={14} />Draft to my team</button></article>;
}

function DraftPlayerRow({ candidate, context, targeted, onSelect, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; targeted: boolean; onSelect: () => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  return <article className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(13rem,1.3fr)_repeat(3,minmax(4.5rem,0.55fr))_minmax(8rem,0.8fr)_auto] lg:items-center"><button type="button" onClick={onSelect} className="min-w-0 text-left"><PlayerIdentity player={candidate.player} /></button><BoardMetric label="Draft score" value={candidate.score.total.toFixed(1)} accent /><BoardMetric label="Projected FPPG" value={candidate.score.metrics.projectedFppg.toFixed(2)} /><BoardMetric label={`${candidate.score.metrics.championshipWeek.usableStarts} championship`} value={String(candidate.score.metrics.playoffUsableStarts)} positive icon={<Trophy size={12} />} /><div><p className={`text-xs font-semibold ${context?.advice === 'take-now' ? 'text-warning' : context?.advice === 'can-wait' ? 'text-positive' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? 'Take before tier drop' : context?.advice === 'can-wait' ? 'Can likely wait' : 'Close decision'}</p><p className={`mt-0.5 text-[10px] capitalize ${projectionTone(candidate.score.metrics.projectionTrajectory)}`}>{candidate.score.metrics.projectionTrajectory} · {candidate.score.metrics.projectionConfidence} confidence</p><p className="mt-0.5 text-[10px] text-ink-mute">{context?.similarAtPosition ?? 0} similar at position · next drop {context?.dropToNextAtPosition ?? 0}</p></div><div className="flex items-center justify-end gap-1.5"><button type="button" aria-label={`${targeted ? 'Remove' : 'Add'} ${candidate.player.name} ${targeted ? 'from' : 'to'} targets`} aria-pressed={targeted} onClick={onTarget} className={`grid size-9 place-items-center rounded-md border ${targeted ? 'border-warning bg-warning-muted text-warning' : 'border-line text-ink-mute hover:text-warning'}`}><Star size={14} fill={targeted ? 'currentColor' : 'none'} /></button><button type="button" onClick={onTaken} className="min-h-9 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-dim hover:text-ink">Taken</button><button type="button" onClick={onMine} className="min-h-9 rounded-md bg-accent px-2.5 text-xs font-bold text-accent-ink">Mine</button></div></article>;
}

function TargetSummary({ targets, playerById, pickedIds, round, onRoundChange, onSelect, compact = false }: { targets: LeagueWorkspace['draftSession']['targets']; playerById: Map<string, DraftPlayer>; pickedIds: Set<string>; round: number; onRoundChange: (id: string, round: number | null) => void; onSelect: (id: string) => void; compact?: boolean }) {
  const available = targets.filter((target) => !pickedIds.has(normalizeId(target.playerId))).sort((a, b) => (a.targetRound ?? 99) - (b.targetRound ?? 99));
  if (!available.length) return <p className={`${compact ? 'mt-3' : 'mt-4'} text-sm text-ink-dim`}>Star players from the board and add the round where you hope to take them.</p>;
  return <div className={`${compact ? 'mt-3' : 'mt-4 grid gap-2 md:grid-cols-2'} space-y-2`}>{available.map((target) => { const player = playerById.get(normalizeId(target.playerId)); const approaching = target.targetRound !== null && target.targetRound <= round + 1; return <div key={target.playerId} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${approaching ? 'border-warning bg-warning-muted' : 'border-line bg-surface-0'}`}><button type="button" onClick={() => onSelect(target.playerId)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs text-ink">{target.fullName}</strong><span className="text-[10px] text-ink-mute">{player ? `${player.pos.join('/')} · ${player.team}` : 'Player data loading'}</span></button><label className="text-[9px] font-bold uppercase text-ink-mute">Round<input aria-label={`${target.fullName} target round`} type="number" min="1" max="50" value={target.targetRound ?? ''} onChange={(event) => onRoundChange(target.playerId, event.target.value ? Number(event.target.value) : null)} className="ml-1 h-7 w-12 rounded border border-line bg-surface-1 px-1 text-center text-xs text-ink" /></label></div>; })}</div>;
}

function SelectedPlayer({ candidate, context, targeted, onAdjust, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; targeted: boolean; onAdjust: (delta: number) => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  const components = [['Production', candidate.score.components.production], ['Regular fit', candidate.score.components.regularSeason], ['Playoffs', candidate.score.components.playoffs], ['Position market', candidate.score.components.positionValue]] as const;
  return <div className="p-4"><PlayerIdentity player={candidate.player} /><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><MiniMetric value={candidate.score.total.toFixed(1)} label="draft score" /><MiniMetric value={candidate.score.metrics.projectedFppg.toFixed(2)} label="projected FPPG" /><MiniMetric value={candidate.score.metrics.fppg.toFixed(2)} label="league FPPG" /><MiniMetric value={candidate.score.metrics.projectionConfidence} label="confidence" /></div><div className="mt-3 rounded-lg border border-line bg-surface-0 p-3"><div className="flex items-center justify-between gap-2"><p className={`text-xs font-semibold capitalize ${projectionTone(candidate.score.metrics.projectionTrajectory)}`}>{candidate.score.metrics.projectionTrajectory} outlook · {candidate.score.metrics.projectionDeltaPercent > 0 ? '+' : ''}{candidate.score.metrics.projectionDeltaPercent.toFixed(1)}%</p>{candidate.player.pos.includes('G') && <span className="text-[10px] text-ink-mute">{candidate.score.metrics.projectedGames} projected GP · {candidate.score.metrics.projectionVolatility} volatility</span>}</div><ul className="mt-2 space-y-1 text-[10px] text-ink-mute">{candidate.score.metrics.projectionReasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}</ul></div><div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-surface-0 p-2"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">My adjustment</p><p className="text-xs text-ink-dim">Move this player without changing league scoring.</p></div><div className="flex items-center gap-1"><button type="button" aria-label={`Lower ${candidate.player.name} on my board`} onClick={() => onAdjust(-1)} className="grid size-8 place-items-center rounded-md border border-line text-ink-dim">−</button><strong className="min-w-8 text-center font-mono text-sm text-accent">{(candidate.score.metrics.manualAdjustment ?? 0) > 0 ? '+' : ''}{candidate.score.metrics.manualAdjustment ?? 0}</strong><button type="button" aria-label={`Raise ${candidate.player.name} on my board`} onClick={() => onAdjust(1)} className="grid size-8 place-items-center rounded-md border border-line text-ink-dim">+</button></div></div><div className="mt-4 space-y-2">{components.map(([label, value]) => <div key={label}><div className="flex justify-between text-[10px] text-ink-dim"><span>{label}</span><span>{value.toFixed(0)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-0"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, value)}%` }} /></div></div>)}</div><PlayoffWeekStrip score={candidate.score} /><p className="mt-3 text-[10px] text-ink-mute">Regular season: {candidate.score.metrics.regularUsableStarts} usable starts · playoffs: {candidate.score.metrics.playoffUsableStarts}. Strategy weights decide how much playoff strength can offset regular-season access.</p><div className={`mt-4 rounded-lg border p-3 text-xs ${context?.advice === 'take-now' ? 'border-warning bg-warning-muted text-warning' : 'border-line bg-surface-0 text-ink-dim'}`}>{context?.advice === 'take-now' ? `Only ${context.similarAtPosition} comparable option${context.similarAtPosition === 1 ? '' : 's'} remain at ${context.position}. Waiting costs about ${context.dropToNextAtPosition} strategy points.` : `${context?.similarAtPosition ?? 0} comparable ${context?.position ?? 'position'} options remain, so you may be able to wait.`}</div><div className="mt-4 grid grid-cols-3 gap-2"><button type="button" onClick={onTarget} className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md border text-xs font-semibold ${targeted ? 'border-warning text-warning' : 'border-line text-ink-dim'}`}><Star size={13} />{targeted ? 'Targeted' : 'Target'}</button><button type="button" onClick={onTaken} className="min-h-9 rounded-md border border-line text-xs font-semibold text-ink-dim">Taken</button><button type="button" onClick={onMine} className="min-h-9 rounded-md bg-accent text-xs font-bold text-accent-ink">Mine</button></div><Link to={`/compare?mode=draft&a=${normalizeId(candidate.player.id)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><ArrowLeftRight size={13} />Compare this player</Link></div>;
}

function PlayoffWeekStrip({ score }: { score: RankedDraftCandidate['score'] }) {
  return <div className="mt-4"><div className="flex items-center justify-between"><span className="scoreboard-text flex items-center gap-1 text-positive"><Trophy size={11} />Playoff weeks</span><span className="text-[9px] text-ink-mute">usable / games</span></div><div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, score.metrics.playoffWeeks.length)}, minmax(0, 1fr))` }}>{score.metrics.playoffWeeks.map((week) => <div key={week.start} className={`rounded-md border px-2 py-2 text-center ${week.isChampionship ? 'border-positive bg-positive-muted' : 'border-line bg-surface-0'}`}><strong className={`block font-mono text-sm ${week.isChampionship ? 'text-positive' : 'text-ink'}`}>{week.usableStarts}/{week.games}</strong><span className="block truncate text-[8px] uppercase text-ink-mute">{week.isChampionship ? 'Final' : `W${week.index}`}</span></div>)}</div></div>;
}

function MiniMetric({ value, label }: { value: string | number; label: string }) { return <div className="rounded-md border border-line bg-surface-1 px-2 py-2"><strong className="block font-mono text-sm text-ink">{value}</strong><span className="text-[9px] text-ink-mute">{label}</span></div>; }

function projectionTone(trajectory: RankedDraftCandidate['score']['metrics']['projectionTrajectory']): string {
  return trajectory === 'rising' ? 'text-positive' : trajectory === 'declining' ? 'text-warning' : 'text-ink-dim';
}
function BoardMetric({ label, value, accent = false, positive = false, icon }: { label: string; value: string; accent?: boolean; positive?: boolean; icon?: ReactNode }) { return <div><strong className={`flex items-center gap-1 font-mono text-sm ${accent ? 'text-accent' : positive ? 'text-positive' : 'text-ink'}`}>{icon}{value}</strong><span className="text-[10px] text-ink-mute">{label}</span></div>; }
