import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowLeftRight, Check, ChevronDown, Clock3, History, Info, Layers3, ListOrdered, Maximize2, PanelRightOpen, Search, Star, Target, Trophy, Undo2, UserCheck, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import { DRAFT_STRATEGY_PRESETS, toLeagueProfile, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { rankDraftCandidates, type RankedDraftCandidate } from '../../lib/draftStrategy';
import { DRAFT_PROJECTION_MODEL } from '../../lib/draftProjection';
import { DRAFT_TIER_POSITIONS, assignDraftSlot, buildDraftCandidateContext, buildDraftMarketContext, buildDraftTiers, currentDraftRound, readDraftRoomLayout, sortDraftBoardCandidates, withDraftRoomLayout, type DraftBoardSortKey, type DraftCandidateContext, type DraftMarketContext } from '../../lib/draftRoom';
import type { DraftPlayer, DraftPlayerDirectoryMeta } from '../../lib/playerSearch';
import { loadSeasonSchedule, type SeasonScheduleData } from '../../lib/schedulePlanning';
import { analyzeKeeperRosterPlan } from '../../lib/myTeamAnalysis';
import { mugshotSeason } from '../../lib/season';
import { getTeamLogoUrl } from '../../lib/teamLogos';
import { apiService } from '../../services/api';
import { useLeagueWorkspace } from '../../contexts/LeagueWorkspaceContext';
import { useTimeWindow } from '../../contexts/TimeWindowContext';
import type { PlayerSearchResult } from '../../types';
import { Card } from '../Card';
import { PlayerDetailModal } from '../PlayerDetailModal';
import { EmptyState } from '../ui/empty-state';
import { DraftStrategyControl } from '../comparison/DraftStrategyControl';
import { ManualDraftControls } from './ManualDraftControls';
import { track } from '../../lib/analytics';

const POSITION_FILTERS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'SKATERS', label: 'SKATERS' },
  { value: 'C', label: 'C' },
  { value: 'LW', label: 'LW' },
  { value: 'RW', label: 'RW' },
  { value: 'D', label: 'D' },
  { value: 'G', label: 'G' },
] as const;
type PositionFilter = typeof POSITION_FILTERS[number]['value'];
type BoardView = 'recommended' | 'targets';
type PoolView = 'tiers' | 'ranked';

const DRAFT_BOARD_LIMIT = 250;
const SORT_OPTIONS: Array<{ value: DraftBoardSortKey; label: string }> = [
  { value: 'valueVsAdp', label: 'Value vs Yahoo ADP' },
  { value: 'draftScore', label: 'Draft score' },
  { value: 'yahooAdp', label: 'Yahoo ADP' },
  { value: 'projectedFppg', label: 'Cracked Ice projected FPPG' },
  { value: 'leagueFppg', label: 'Prior-season FPPG' },
  { value: 'playoffStarts', label: 'Playoff starts' },
  { value: 'championshipStarts', label: 'Championship starts' },
];

function normalizeId(id: string) {
  return id.replace(/^nhl:/, '');
}

function matchesDraftSearch(player: DraftPlayer, normalizedQuery: string): boolean {
  return !normalizedQuery
    || player.name.toLocaleLowerCase().includes(normalizedQuery)
    || player.team.toLocaleLowerCase().includes(normalizedQuery);
}

function matchesPositionFilter(player: DraftPlayer, filter: PositionFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'SKATERS') return !player.pos.includes('G');
  return player.pos.includes(filter);
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

function asDetailedRosterPlayer(player: PlayerSearchResult, fallback: DraftPlayer): RosterPlayer {
  const fallbackStats = Object.fromEntries((fallback.scoringBreakdown?.contributions ?? []).map((item) => [item.key, item.stat]));
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    games_played: player.games_played ?? fallback.nhlGamesPlayed ?? fallback.scoringBreakdown?.gamesPlayed ?? 0,
    stats: player.stats && Object.keys(player.stats).length > 0 ? player.stats : {
      goals: 0,
      assists: 0,
      shots_on_goal: 0,
      power_play_points: 0,
      blocks: 0,
      ...fallbackStats,
    },
    blendedFppg: player.blendedFppg ?? fallback.blendedFppg,
    seasonFppg: player.seasonFppg,
    last30Fppg: player.last30Fppg,
    last7Fppg: player.last7Fppg,
    statsSeason: player.statsSeason,
    statsGeneratedAt: player.statsGeneratedAt,
    teamGamesPlayed: player.teamGamesPlayed,
    careerHistory: player.careerHistory,
    careerSummary: player.careerSummary,
    bio: player.bio,
    gameLog: player.gameLog,
    advancedStats: player.advancedStats,
    roleTrend: player.roleTrend,
  };
}

export function DraftBoard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeLeague, updateLeague } = useLeagueWorkspace();
  const { state: timeWindow } = useTimeWindow();
  const [players, setPlayers] = useState<DraftPlayer[]>([]);
  const [meta, setMeta] = useState<DraftPlayerDirectoryMeta | null>(null);
  const [schedule, setSchedule] = useState<SeasonScheduleData | null>(null);
  const [position, setPosition] = useState<PositionFilter>('ALL');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<BoardView>('recommended');
  const [poolView, setPoolView] = useState<PoolView>('tiers');
  const [sortKey, setSortKey] = useState<DraftBoardSortKey>('valueVsAdp');
  const [visibleTierCount, setVisibleTierCount] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileDetails, setProfileDetails] = useState<PlayerSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rankingWorkspaceRef = useRef(activeLeague);
  rankingWorkspaceRef.current = activeLeague;
  const leagueProfile = useMemo(() => toLeagueProfile(activeLeague), [activeLeague.name, activeLeague.numberOfTeams, activeLeague.platform, activeLeague.rosterRules, activeLeague.scoring, activeLeague.schedule]);

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
  const availablePlayers = useMemo(() => players
      .filter((player) => player.blendedFppg !== null)
      .filter((player) => !keeperIds.has(normalizeId(player.id)) && !pickedIds.has(normalizeId(player.id)))
  , [keeperIds, pickedIds, players]);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
  const baseCandidatePool = useMemo(() => availablePlayers
      .filter((player) => (player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0) >= (player.pos.includes('G') ? 25 : 20))
      .sort((a, b) => (b.blendedFppg ?? 0) - (a.blendedFppg ?? 0))
      .slice(0, DRAFT_BOARD_LIMIT), [availablePlayers]);
  const searchMatches = useMemo(() => normalizedQuery
    ? availablePlayers
      .filter((player) => matchesDraftSearch(player, normalizedQuery))
      .sort((a, b) => (a.yahooAdp ?? Number.POSITIVE_INFINITY) - (b.yahooAdp ?? Number.POSITIVE_INFINITY)
        || (b.blendedFppg ?? 0) - (a.blendedFppg ?? 0))
      .slice(0, 40)
    : [], [availablePlayers, normalizedQuery]);
  const rankingPool = useMemo(() => {
    const candidates = new Map(baseCandidatePool.map((player) => [normalizeId(player.id), player]));
    searchMatches.forEach((player) => candidates.set(normalizeId(player.id), player));
    return [...candidates.values()];
  }, [baseCandidatePool, searchMatches]);
  const rankings = useMemo(() => schedule ? rankDraftCandidates(rankingPool, players, modeledRoster, rankingWorkspaceRef.current, schedule) : [], [rankingPool, modeledRoster, players, schedule, activeLeague.draftStrategy, activeLeague.rosterRules, activeLeague.schedule, activeLeague.scoring]);
  const tiers = useMemo(() => buildDraftTiers(
    rankings,
    2.75,
    position === 'ALL'
      ? DRAFT_TIER_POSITIONS
      : position === 'SKATERS'
        ? DRAFT_TIER_POSITIONS.filter((tierPosition) => tierPosition !== 'G')
        : [position],
  ), [position, rankings]);
  const contextById = useMemo(() => buildDraftCandidateContext(rankings), [rankings]);
  const marketById = useMemo(() => buildDraftMarketContext(rankings), [rankings]);
  const baseCandidateIds = useMemo(() => new Set(baseCandidatePool.map((player) => normalizeId(player.id))), [baseCandidatePool]);
  const recommendationRankings = useMemo(() => rankings.filter((candidate) =>
    baseCandidateIds.has(normalizeId(candidate.player.id))
    && matchesPositionFilter(candidate.player, position)), [baseCandidateIds, position, rankings]);
  const recommendationSkaters = useMemo(() => recommendationRankings.filter((candidate) => !candidate.player.pos.includes('G')), [recommendationRankings]);
  const recommendationGoalies = useMemo(() => recommendationRankings.filter((candidate) => candidate.player.pos.includes('G')), [recommendationRankings]);
  const visibleRankings = useMemo(() => rankings.filter((candidate) =>
    matchesPositionFilter(candidate.player, position)
    && matchesDraftSearch(candidate.player, normalizedQuery)), [normalizedQuery, position, rankings]);
  const boardRankings = position === 'ALL'
    ? visibleRankings.filter((candidate) => !candidate.player.pos.includes('G'))
    : visibleRankings;
  const rankedBoard = useMemo(() => sortDraftBoardCandidates(visibleRankings, marketById, sortKey), [marketById, sortKey, visibleRankings]);
  const visibleTiers = useMemo(() => tiers.map((tier) => ({
    ...tier,
    candidates: tier.candidates.filter((candidate) =>
      matchesDraftSearch(candidate.player, normalizedQuery)
      && (!['ALL', 'SKATERS'].includes(position) || contextById.get(normalizeId(candidate.player.id))?.position === tier.position)),
  })).filter((tier) => tier.candidates.length > 0), [contextById, normalizedQuery, position, tiers]);
  const displayTiers = useMemo(() => normalizedQuery
    ? visibleTiers
    : position === 'ALL'
      ? DRAFT_TIER_POSITIONS.flatMap((tierPosition) => visibleTiers.filter((tier) => tier.position === tierPosition).slice(0, visibleTierCount))
      : position === 'SKATERS'
        ? DRAFT_TIER_POSITIONS.filter((tierPosition) => tierPosition !== 'G').flatMap((tierPosition) => visibleTiers.filter((tier) => tier.position === tierPosition).slice(0, visibleTierCount))
        : visibleTiers.slice(0, visibleTierCount), [normalizedQuery, position, visibleTierCount, visibleTiers]);
  const playerById = useMemo(() => new Map(players.map((player) => [normalizeId(player.id), player])), [players]);
  const targetById = useMemo(() => new Map(activeLeague.draftSession.targets.map((target) => [normalizeId(target.playerId), target])), [activeLeague.draftSession.targets]);
  const selected = selectedId ? rankings.find((candidate) => normalizeId(candidate.player.id) === normalizeId(selectedId)) ?? null : null;
  const profileCandidate = profileId ? rankings.find((candidate) => normalizeId(candidate.player.id) === normalizeId(profileId)) ?? null : null;
  const resolvedProfileDetails = profileCandidate && profileDetails && normalizeId(profileDetails.id) === normalizeId(profileCandidate.player.id) ? profileDetails : null;
  const profilePlayer = profileCandidate ? (resolvedProfileDetails ? asDetailedRosterPlayer(resolvedProfileDetails, profileCandidate.player) : asRosterPlayer(profileCandidate.player)) : null;
  const profileProjection = resolvedProfileDetails?.candidateProjection as PlayerProjection | undefined;
  const keeperPlan = useMemo(() => analyzeKeeperRosterPlan(activeLeague), [activeLeague]);
  const availablePlayerCount = availablePlayers.length;
  const round = currentDraftRound(activeLeague);
  const strategyLabel = activeLeague.draftStrategy.presetId === 'custom' ? 'Custom strategy' : DRAFT_STRATEGY_PRESETS[activeLeague.draftStrategy.presetId].label;
  const layout = readDraftRoomLayout(searchParams);
  const setLayout = (nextLayout: 'full' | 'compact') => setSearchParams(withDraftRoomLayout(searchParams, nextLayout));

  useEffect(() => {
    if (!profileCandidate) {
      setProfileDetails(null);
      return;
    }
    let cancelled = false;
    const window = {
      start: timeWindow.config.startUtc.slice(0, 10),
      end: timeWindow.config.endUtc.slice(0, 10),
    };
    apiService.searchPlayers(profileCandidate.player.name, 8, window, leagueProfile)
      .then(({ results }) => {
        if (cancelled) return;
        setProfileDetails(results.find((player) => normalizeId(player.id) === normalizeId(profileCandidate.player.id)) ?? null);
      })
      .catch(() => { if (!cancelled) setProfileDetails(null); });
    return () => { cancelled = true; };
  }, [leagueProfile, profileCandidate?.player.id, profileCandidate?.player.name, timeWindow.config.endUtc, timeWindow.config.startUtc]);

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
    track('draft_board_action', {
      action: status === 'mine' ? 'drafted_mine' : 'drafted_other',
      position: candidate.player.pos.join('/'),
    });
    setSelectedId(null);
    setProfileId(null);
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
    track('draft_board_action', {
      action: exists ? 'target_removed' : 'target_added',
      position: candidate.player.pos.join('/'),
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
    const adjustedPlayer = playerById.get(id);
    track('draft_board_action', { action: 'rank_adjusted', position: adjustedPlayer?.pos.join('/') ?? 'unknown' });
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
    if (nextPicks.length > activeLeague.draftSession.picks.length) {
      track('draft_board_action', { action: 'bulk_picks', position: 'mixed' });
    }
  };

  const recommendationBoard = position === 'ALL' ? recommendationSkaters : recommendationRankings;
  const urgent = recommendationBoard.slice(0, 24).filter((candidate) => contextById.get(normalizeId(candidate.player.id))?.advice === 'take-now').sort((a, b) => (contextById.get(normalizeId(b.player.id))?.dropToNextAtPosition ?? 0) - (contextById.get(normalizeId(a.player.id))?.dropToNextAtPosition ?? 0))[0];
  const playoff = [...recommendationBoard.slice(0, 30)].sort((a, b) => b.score.metrics.playoffUsableStarts - a.score.metrics.playoffUsableStarts || b.score.total - a.score.total)[0];
  const recommendations = [recommendationBoard[0], urgent, playoff].filter((candidate, index, list): candidate is RankedDraftCandidate => Boolean(candidate) && list.findIndex((item) => item?.player.id === candidate?.player.id) === index).slice(0, position === 'ALL' ? 2 : 3);
  const goalieWatch = position === 'ALL' ? recommendationGoalies[0] : undefined;
  const hasMoreTiers = !normalizedQuery && (position === 'ALL'
    ? DRAFT_TIER_POSITIONS.some((tierPosition) => visibleTiers.filter((tier) => tier.position === tierPosition).length > visibleTierCount)
    : position === 'SKATERS'
      ? DRAFT_TIER_POSITIONS.filter((tierPosition) => tierPosition !== 'G').some((tierPosition) => visibleTiers.filter((tier) => tier.position === tierPosition).length > visibleTierCount)
      : visibleTiers.length > visibleTierCount);
  const profileContext = profileCandidate ? contextById.get(normalizeId(profileCandidate.player.id)) : undefined;
  const profileMarket = profileCandidate ? marketById.get(normalizeId(profileCandidate.player.id)) : undefined;
  const profileModal = profileCandidate && profilePlayer ? <PlayerDetailModal
    isOpen
    player={profilePlayer}
    projection={profileProjection}
    timeWindow={timeWindow}
    leagueProfile={leagueProfile}
    draftContext={{
      crackedIceRank: profileMarket?.crackedIceRank,
      yahooAdp: profileCandidate.player.yahooAdp,
      draftScore: profileCandidate.score.total,
      projectedFppg: profileCandidate.score.metrics.projectedFppg,
      playoffStarts: profileCandidate.score.metrics.playoffUsableStarts,
      finalWeekStarts: profileCandidate.score.metrics.championshipWeek.usableStarts,
      tier: profileContext ? `${profileContext.position} Tier ${profileContext.tier}` : undefined,
    }}
    onClose={() => setProfileId(null)}
  /> : null;

  if (layout === 'compact') return <><div className="mx-auto max-w-[760px] space-y-3">
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

    {selected && <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div><p className="scoreboard-text text-accent">PLAYER INFO</p><h2 className="text-base font-semibold text-ink">Decision context</h2></div><button type="button" aria-label="Close player info" onClick={() => setSelectedId(null)} className="grid size-8 place-items-center rounded-md border border-line text-ink-mute"><X size={14} /></button></div><SelectedPlayer candidate={selected} context={contextById.get(normalizeId(selected.player.id))} market={marketById.get(normalizeId(selected.player.id))} targeted={targetById.has(normalizeId(selected.player.id))} onAdjust={(delta) => adjustPlayerRank(selected.player.id, delta)} onFullProfile={() => setProfileId(selected.player.id)} onTarget={() => toggleTarget(selected)} onMine={() => markPlayer(selected, 'mine')} onTaken={() => markPlayer(selected, 'taken')} /></Card>}

    <Card className="overflow-hidden">
      <div className="border-b border-line p-4"><div className="flex items-center justify-between gap-3"><div><p className="scoreboard-text text-accent">AVAILABLE NOW</p><h2 className="text-base font-semibold text-ink">Short board</h2></div><span className="text-[10px] text-ink-mute">{strategyLabel}</span></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="inline-flex flex-wrap rounded-lg border border-line bg-surface-0 p-1" aria-label="Compact draft position filter">{POSITION_FILTERS.map((item) => <button key={item.value} type="button" onClick={() => setPosition(item.value)} className={`rounded-md px-2 py-1.5 text-[10px] font-semibold ${position === item.value ? 'bg-accent text-accent-ink' : 'text-ink-dim'}`}>{item.label}</button>)}</div><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={14} /><span className="sr-only">Search compact draft board</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find player or team" className="min-h-9 w-full rounded-lg border border-line bg-surface-0 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" /></label></div></div>
      {loading && <div className="p-6 text-center text-sm text-ink-dim">Building your short board…</div>}
      {!loading && error && <div className="p-4"><EmptyState title="Draft Room unavailable" description={error} /></div>}
      {!loading && !error && boardRankings.length === 0 && <div className="p-4"><EmptyState title="No matching players" description="Change the position or search filter." /></div>}
      {!loading && !error && <div className="divide-y divide-line">{boardRankings.slice(0, 12).map((candidate) => <CompactDraftRow key={candidate.player.id} candidate={candidate} context={contextById.get(normalizeId(candidate.player.id))} targeted={targetById.has(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onTarget={() => toggleTarget(candidate)} onMine={() => markPlayer(candidate, 'mine')} onTaken={() => markPlayer(candidate, 'taken')} />)}</div>}
      {!loading && !error && position === 'ALL' && goalieWatch && <div className="border-t border-line bg-surface-0 p-3"><p className="scoreboard-text text-positive">GOALIE LANE</p><CompactDraftRow candidate={goalieWatch} context={contextById.get(normalizeId(goalieWatch.player.id))} targeted={targetById.has(normalizeId(goalieWatch.player.id))} onSelect={() => setSelectedId(goalieWatch.player.id)} onTarget={() => toggleTarget(goalieWatch)} onMine={() => markPlayer(goalieWatch, 'mine')} onTaken={() => markPlayer(goalieWatch, 'taken')} /></div>}
      <div className="border-t border-line p-3 text-center"><button type="button" onClick={() => setLayout('full')} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"><Maximize2 size={13} />Open full tiers and strategy</button></div>
    </Card>

    <div className="grid gap-3 sm:grid-cols-2"><Card className="p-4"><div className="flex items-center justify-between"><div><p className="scoreboard-text text-accent">RECENT PICKS</p><h2 className="text-base font-semibold text-ink">Draft activity</h2></div><History size={16} className="text-ink-mute" /></div><RecentDraftPicks workspace={activeLeague} limit={5} /></Card><Card className="p-4"><p className="scoreboard-text text-accent">ROSTER NEEDS</p><p className="mt-2 text-xs text-ink-dim">{keeperPlan.keeperCount} keepers · {activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} drafted</p><p className="mt-2 text-sm text-ink">{remainingNeeds(activeLeague)}</p></Card></div>
  </div>{profileModal}</>;

  return <div className="mx-auto max-w-[1500px] space-y-4">
    <Card className="z-30 overflow-hidden shadow-card lg:sticky lg:top-2">
      <div className="flex flex-col gap-3 p-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="shrink-0"><p className="scoreboard-text text-accent">LIVE DRAFT</p><h1 className="font-display text-xl font-bold uppercase tracking-[0.05em] text-ink">Draft Room</h1></div>
          <WorkspaceContextSummary workspace={activeLeague} keeperCount={keeperPlan.keeperCount} compact />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarMetric label="Round" value={round} />
          <ToolbarMetric label="Mine" value={activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} />
          <ToolbarMetric label="Ranked" value={baseCandidatePool.length} />
          <ToolbarMetric label="Targets" value={activeLeague.draftSession.targets.filter((target) => !pickedIds.has(normalizeId(target.playerId))).length} />
          <button type="button" onClick={() => setLayout('compact')} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent" title="Compact second-screen view"><PanelRightOpen size={14} /><span className="hidden sm:inline">Compact</span></button>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line bg-surface-0 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <DraftSyncSummary workspace={activeLeague} compact />
        <div className="flex items-center gap-2"><span className="text-[10px] text-ink-mute">{availablePlayerCount} total available</span>{lastManualPickIndex >= 0 && <button type="button" onClick={undoLast} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-line px-2.5 font-semibold text-ink-dim hover:text-ink"><Undo2 size={14} />Undo</button>}</div>
      </div>
      <div className="border-t border-line bg-surface-1 px-3 py-2.5 sm:px-4"><ManualDraftControls players={players} draftedIds={pickedIds} onRecord={recordManualSelections} /></div>
    </Card>

    <div><DraftStrategyControl compact value={activeLeague.draftStrategy} onChange={(draftStrategy) => updateLeague({ ...activeLeague, draftStrategy, updatedAt: new Date().toISOString() })} /><ProjectionDisclosure meta={meta} /></div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card className="draft-recommendations p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="scoreboard-text text-accent">RECOMMENDED NOW</p><h2 className="text-lg font-semibold text-ink">Take value before the tier drops</h2></div><div className="flex rounded-lg border border-line bg-surface-0 p-1">{(['recommended', 'targets'] as BoardView[]).map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-md px-3 py-2 text-xs font-semibold capitalize ${view === item ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{item}</button>)}</div></div>
          {view === 'recommended' && <div className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">{recommendations.map((candidate, index) => <RecommendationCard key={candidate.player.id} candidate={candidate} label={index === 0 ? (position === 'ALL' ? 'Best skater' : 'Best available') : candidate === urgent ? 'Tier urgency' : 'Playoff edge'} context={contextById.get(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onMine={() => markPlayer(candidate, 'mine')} />)}{goalieWatch && <RecommendationCard key={`goalie-${goalieWatch.player.id}`} candidate={goalieWatch} label="Goalie lane" context={contextById.get(normalizeId(goalieWatch.player.id))} onSelect={() => setSelectedId(goalieWatch.player.id)} onMine={() => markPlayer(goalieWatch, 'mine')} />}</div>}
          {view === 'targets' && <TargetSummary targets={activeLeague.draftSession.targets} playerById={playerById} pickedIds={pickedIds} round={round} onRoundChange={setTargetRound} onSelect={setSelectedId} />}
        </Card>

        {selected && <Card className="overflow-hidden xl:hidden"><div className="flex items-center justify-between border-b border-line px-4 py-3"><div><p className="scoreboard-text text-accent">PLAYER INFO</p><h2 className="text-base font-semibold text-ink">Decision context</h2></div><button type="button" aria-label="Close player info" onClick={() => setSelectedId(null)} className="grid size-8 place-items-center rounded-md border border-line text-ink-mute"><X size={14} /></button></div><SelectedPlayer candidate={selected} context={contextById.get(normalizeId(selected.player.id))} market={marketById.get(normalizeId(selected.player.id))} targeted={targetById.has(normalizeId(selected.player.id))} onAdjust={(delta) => adjustPlayerRank(selected.player.id, delta)} onFullProfile={() => setProfileId(selected.player.id)} onTarget={() => toggleTarget(selected)} onMine={() => markPlayer(selected, 'mine')} onTaken={() => markPlayer(selected, 'taken')} /></Card>}

        <Card className="draft-player-pool overflow-hidden">
          <div className="border-b border-line p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div><p className="scoreboard-text text-accent">PLAYER POOL</p><div className="flex flex-wrap items-baseline gap-x-2"><h2 className="text-lg font-semibold text-ink">{strategyLabel} {poolView === 'tiers' ? 'tiers' : 'ranked board'}</h2><span className="text-[10px] text-ink-mute">Top {baseCandidatePool.length} scored players</span></div></div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="inline-flex rounded-lg border border-line bg-surface-0 p-1" aria-label="Draft board view"><button type="button" onClick={() => setPoolView('tiers')} aria-pressed={poolView === 'tiers'} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${poolView === 'tiers' ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}><Layers3 size={13} />Tiers</button><button type="button" onClick={() => setPoolView('ranked')} aria-pressed={poolView === 'ranked'} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${poolView === 'ranked' ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}><ListOrdered size={13} />Ranked</button></div>
                <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface-0 p-1" aria-label="Draft board position filter">{POSITION_FILTERS.map((item) => <button key={item.value} type="button" onClick={() => setPosition(item.value)} className={`rounded-md px-2.5 py-2 text-xs font-semibold ${position === item.value ? 'bg-accent text-accent-ink' : 'text-ink-dim hover:text-ink'}`}>{item.label}</button>)}</div>
                {poolView === 'ranked' && <label className="relative block min-w-48"><ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={15} /><span className="sr-only">Sort ranked board</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as DraftBoardSortKey)} className="min-h-10 w-full appearance-none rounded-lg border border-line bg-surface-0 pl-9 pr-8 text-xs font-semibold text-ink outline-none focus:border-accent">{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-mute" size={14} /></label>}
                <label className="relative block min-w-56"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" size={16} /><span className="sr-only">Search draft board</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or team" className="min-h-10 w-full rounded-lg border border-line bg-surface-0 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent" /></label>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-ink-mute"><strong className="text-ink-dim">CI projected FPPG</strong> is the Cracked Ice early estimate using your league scoring. <strong className="text-ink-dim">PO starts / final</strong> means usable starts across all playoff weeks / usable starts in your championship week.</p>
            {poolView === 'ranked' && sortKey === 'valueVsAdp' && <p className="mt-3 rounded-lg border border-positive/40 bg-positive-muted px-3 py-2 text-xs text-positive"><strong>Value vs Yahoo ADP</strong> shows how many picks later Yahoo drafts a player than Cracked Ice ranks them. Positive numbers indicate potential value if your room follows Yahoo ADP.</p>}
          </div>
          {loading && <div className="p-10 text-center text-ink-dim">Building your Draft Room…</div>}
          {!loading && error && <div className="p-4"><EmptyState title="Draft Room unavailable" description={error} /></div>}
          {!loading && !error && (poolView === 'tiers' ? displayTiers.length === 0 : rankedBoard.length === 0) && <div className="p-4"><EmptyState title="No matching players" description="Change the position or search filter." /></div>}
          {!loading && !error && poolView === 'tiers' && displayTiers.map((tier) => <section key={`${tier.position}-${tier.number}`} className={`border-b border-line last:border-b-0 ${tier.position === 'G' ? 'bg-positive-muted/10' : ''}`}><div className="flex items-center justify-between bg-surface-2/95 px-4 py-2 [backdrop-filter:var(--frost)] sm:px-5"><div className="flex items-center gap-2"><span className={`scoreboard-text ${tier.position === 'G' ? 'text-positive' : 'text-accent'}`}>{tier.label}</span><span className="text-[10px] text-ink-mute">{tier.candidates.length} comparable player{tier.candidates.length === 1 ? '' : 's'} remain</span></div><ChevronDown size={14} className="text-ink-mute" /></div><div className="divide-y divide-line">{tier.candidates.map((candidate) => <DraftPlayerRow key={`${tier.position}-${candidate.player.id}`} candidate={candidate} context={contextById.get(normalizeId(candidate.player.id))} selected={selectedId != null && normalizeId(selectedId) === normalizeId(candidate.player.id)} targeted={targetById.has(normalizeId(candidate.player.id))} onSelect={() => setSelectedId(candidate.player.id)} onTarget={() => toggleTarget(candidate)} onMine={() => markPlayer(candidate, 'mine')} onTaken={() => markPlayer(candidate, 'taken')} />)}</div></section>)}
          {!loading && !error && poolView === 'tiers' && hasMoreTiers && <div className="p-4 text-center"><button type="button" onClick={() => setVisibleTierCount((count) => count + 2)} className="min-h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink-dim hover:border-accent hover:text-accent">Load two more tiers per position</button></div>}
          {!loading && !error && poolView === 'ranked' && <RankedDraftList candidates={rankedBoard} marketById={marketById} contextById={contextById} selectedId={selectedId} targetById={targetById} onSelect={setSelectedId} onTarget={toggleTarget} onMine={(candidate) => markPlayer(candidate, 'mine')} onTaken={(candidate) => markPlayer(candidate, 'taken')} />}
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="hidden max-h-[calc(100vh-13.5rem)] overflow-hidden xl:sticky xl:top-[12.5rem] xl:z-10 xl:flex xl:flex-col"><div className="shrink-0 border-b border-line p-4"><p className="scoreboard-text text-accent">PLAYER INFO</p><h2 className="text-base font-semibold text-ink">Decision context</h2></div>{selected ? <SelectedPlayer sidebar candidate={selected} context={contextById.get(normalizeId(selected.player.id))} market={marketById.get(normalizeId(selected.player.id))} targeted={targetById.has(normalizeId(selected.player.id))} onAdjust={(delta) => adjustPlayerRank(selected.player.id, delta)} onFullProfile={() => setProfileId(selected.player.id)} onTarget={() => toggleTarget(selected)} onMine={() => markPlayer(selected, 'mine')} onTaken={() => markPlayer(selected, 'taken')} /> : <p className="p-4 text-sm text-ink-dim">Select a player to inspect their league and schedule fit.</p>}</Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="scoreboard-text text-accent">MY TARGETS</p><h2 className="text-base font-semibold text-ink">Personal draft queue</h2></div><Target size={18} className="text-accent" /></div><TargetSummary compact targets={activeLeague.draftSession.targets} playerById={playerById} pickedIds={pickedIds} round={round} onRoundChange={setTargetRound} onSelect={setSelectedId} /></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="scoreboard-text text-accent">DRAFTED</p><h2 className="text-base font-semibold text-ink">Recent activity</h2></div><History size={17} className="text-ink-mute" /></div><div className="mt-3 space-y-2">{activeLeague.draftSession.picks.length ? [...activeLeague.draftSession.picks].reverse().slice(0, 8).map((pick, index) => <div key={`${pick.playerId}-${pick.madeAt}-${index}`} className="flex items-center gap-2 rounded-md border border-line bg-surface-0 px-2.5 py-2"><span className={`grid size-6 place-items-center rounded-full ${pick.status === 'mine' ? 'bg-positive-muted text-positive' : 'bg-surface-2 text-ink-mute'}`}>{pick.status === 'mine' ? <UserCheck size={13} /> : <X size={13} />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{pick.fullName}</span><span className="text-[10px] text-ink-mute">{pick.status === 'mine' ? pick.slot ?? 'Mine' : 'Taken'}</span></div>) : <p className="text-sm text-ink-dim">No selections recorded yet.</p>}</div></Card>
        <Card className="p-4"><p className="scoreboard-text text-accent">ROSTER NEEDS</p><p className="mt-2 text-xs text-ink-dim">{keeperPlan.keeperCount} keeper{keeperPlan.keeperCount === 1 ? '' : 's'} · {activeLeague.draftSession.picks.filter((pick) => pick.status === 'mine').length} drafted by you</p><p className="mt-2 text-sm text-ink">{remainingNeeds(activeLeague)}</p><Link to="/team" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">Manage keepers</Link></Card>
      </aside>
    </div>

    {profileModal}

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

function ToolbarMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-surface-0 px-2.5"><strong className="font-mono text-sm text-accent">{value}</strong><span className="text-[9px] uppercase tracking-wide text-ink-mute">{label}</span></div>;
}

function CompactStatus({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 bg-surface-1 px-2 py-2.5 text-center"><strong className="block truncate font-mono text-base text-accent">{value}</strong><span className="block truncate text-[9px] uppercase tracking-wide text-ink-mute">{label}</span></div>;
}

function DraftSyncSummary({ workspace, compact = false }: { workspace: LeagueWorkspace; compact?: boolean }) {
  const sync = workspace.draftSession.sync;
  if (sync.mode === 'provider') {
    const detail = sync.status === 'error'
      ? sync.lastError ?? 'The last provider refresh needs attention.'
      : sync.lastSyncedAt ? `Last provider snapshot ${new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Waiting for the first provider snapshot.';
    return <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${sync.status === 'error' ? 'border-warning text-warning' : 'border-positive text-positive'}`}><Clock3 size={13} />Yahoo snapshot</span><span className="text-ink-mute">{detail}</span></div>;
  }
  return <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-ink-dim"><Clock3 size={13} />Manual tracking</span>{!compact && <span className="text-ink-mute">{workspace.platform === 'yahoo' ? 'Yahoo is selected, but provider draft access is not connected.' : 'Use bulk catch-up instead of crossing off every pick.'}</span>}{compact && workspace.platform === 'yahoo' && <span className="truncate text-[10px] text-ink-mute" title="Yahoo is selected, but provider draft access is not connected.">Yahoo draft sync not connected</span>}</div>;
}

function ProjectionDisclosure({ meta }: { meta: DraftPlayerDirectoryMeta | null }) {
  const statsSeason = meta?.statsSeason ?? 'prior-season';
  return <details className="mt-2 rounded-lg border border-line bg-surface-0 px-3 py-2 text-[10px] text-ink-mute open:border-line-strong">
    <summary className="cursor-pointer list-none font-semibold text-ink-dim marker:hidden"><Info size={12} className="mr-1.5 inline text-accent" />{DRAFT_PROJECTION_MODEL.label} · based on {statsSeason} and recent NHL results <span className="ml-1 text-accent">Methodology</span></summary>
    <div className="mt-2 border-t border-line pt-2">
      <p><strong className="text-ink">What it is:</strong> {DRAFT_PROJECTION_MODEL.methodology}. Cracked Ice then applies your league scoring, roster construction, strategy, and schedule.</p>
    </div>
    <p className="mt-2">{meta?.eligibilitySource === 'yahoo' ? `Yahoo ADP and eligibility updated ${meta.eligibilityUpdatedAt ?? 'date unavailable'}. ` : ''}The default scored pool requires 20 skater GP or 25 goalie GP and updates after every recorded pick.</p>
  </details>;
}

function PlayerIdentity({ player }: { player: DraftPlayer }) {
  return <div className="flex min-w-0 items-center gap-2.5"><div className="relative shrink-0"><img src={`https://assets.nhle.com/mugs/nhl/${mugshotSeason}/${player.team}/${normalizeId(player.id)}.png`} alt="" className="size-10 rounded-full border border-line bg-surface-0 object-cover" /><img src={getTeamLogoUrl(player.team)} alt="" className="absolute -bottom-1 -right-1 size-4 object-contain" /></div><div className="min-w-0"><strong className="block truncate text-sm text-ink">{player.name}</strong><span className="text-[10px] text-ink-mute">{player.pos.join('/')} · {player.team}</span></div></div>;
}

function CompactDraftRow({ candidate, label, context, targeted, onSelect, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; label?: string; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; targeted: boolean; onSelect: () => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  return <article className="p-3 sm:p-4">
    <div className="flex items-start gap-3"><button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">{label && <span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-accent">{label}</span>}<PlayerIdentity player={candidate.player} /></button><div className="shrink-0 text-right"><strong className="block font-mono text-lg text-accent">{candidate.score.total.toFixed(1)}</strong><span className="text-[9px] text-ink-mute">draft score</span></div></div>
    <div className="mt-3 grid grid-cols-4 gap-1.5"><MiniMetric value={formatYahooAdp(candidate.player)} label="Yahoo ADP" /><MiniMetric value={candidate.score.metrics.projectedFppg.toFixed(2)} label="CI proj. FPPG" /><MiniMetric value={`${candidate.score.metrics.playoffUsableStarts}/${candidate.score.metrics.championshipWeek.usableStarts}`} label="PO starts / final" /><MiniMetric value={context?.dropToNextAtPosition ?? 0} label="next drop" /></div>
    <div className="mt-3 flex items-center gap-1.5"><button type="button" aria-label={`${targeted ? 'Remove' : 'Add'} ${candidate.player.name} ${targeted ? 'from' : 'to'} targets`} aria-pressed={targeted} onClick={onTarget} className={`grid size-9 shrink-0 place-items-center rounded-md border ${targeted ? 'border-warning bg-warning-muted text-warning' : 'border-line text-ink-mute'}`}><Star size={14} fill={targeted ? 'currentColor' : 'none'} /></button><p className={`min-w-0 flex-1 text-[10px] font-semibold ${context?.advice === 'take-now' ? 'text-warning' : context?.advice === 'can-wait' ? 'text-positive' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? 'Tier drop soon' : context?.advice === 'can-wait' ? 'Comparable players remain' : 'Close decision'}</p><button type="button" onClick={onTaken} className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-ink-dim">Taken</button><button type="button" onClick={onMine} className="min-h-9 rounded-md bg-accent px-3 text-xs font-bold text-accent-ink">Mine</button></div>
  </article>;
}

function RecentDraftPicks({ workspace, limit }: { workspace: LeagueWorkspace; limit: number }) {
  if (!workspace.draftSession.picks.length) return <p className="mt-3 text-sm text-ink-dim">No selections recorded yet.</p>;
  return <div className="mt-3 space-y-1.5">{[...workspace.draftSession.picks].reverse().slice(0, limit).map((pick, index) => <div key={`${pick.playerId}-${pick.madeAt}-${index}`} className="flex items-center gap-2 rounded-md border border-line bg-surface-0 px-2.5 py-2"><span className={`grid size-6 place-items-center rounded-full ${pick.status === 'mine' ? 'bg-positive-muted text-positive' : 'bg-surface-2 text-ink-mute'}`}>{pick.status === 'mine' ? <UserCheck size={13} /> : <X size={13} />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{pick.fullName}</span><span className="text-[10px] text-ink-mute">{pick.status === 'mine' ? pick.slot ?? 'Mine' : 'Taken'}</span></div>)}</div>;
}

function RecommendationCard({ candidate, label, context, onSelect, onMine }: { candidate: RankedDraftCandidate; label: string; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; onSelect: () => void; onMine: () => void }) {
  return <article className="rounded-xl border border-line bg-surface-0 p-3"><div className="flex items-center justify-between gap-2"><span className="scoreboard-text text-accent">{label}</span><span className="rounded-full bg-accent-muted px-2 py-1 text-[10px] font-bold text-accent">{context?.position ?? candidate.player.pos[0]} Tier {context?.tier ?? '—'}</span></div><button type="button" onClick={onSelect} className="mt-3 w-full text-left"><PlayerIdentity player={candidate.player} /></button><div className="mt-3 grid grid-cols-4 gap-1.5"><MiniMetric value={formatYahooAdp(candidate.player)} label="Yahoo ADP" /><MiniMetric value={candidate.score.total.toFixed(1)} label="score" /><MiniMetric value={candidate.score.metrics.projectedFppg.toFixed(2)} label="CI proj. FPPG" /><MiniMetric value={`${candidate.score.metrics.playoffUsableStarts}/${candidate.score.metrics.championshipWeek.usableStarts}`} label="PO starts / final" /></div><p className={`mt-2 text-[10px] font-semibold capitalize ${projectionTone(candidate.score.metrics.projectionTrajectory)}`}>{candidate.score.metrics.projectionTrajectory} · {candidate.score.metrics.projectionConfidence} confidence</p><p className={`mt-2 text-xs ${context?.advice === 'take-now' ? 'text-warning' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? `Take now · ${context.dropToNextAtPosition} point drop at ${context.position}` : `${context?.similarAtPosition ?? 0} comparable ${context?.position ?? 'position'} option${context?.similarAtPosition === 1 ? '' : 's'} remain`}</p><button type="button" onClick={onMine} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-bold text-accent-ink"><Check size={14} />Draft to my team</button></article>;
}

function DraftPlayerRow({ candidate, context, selected, targeted, onSelect, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; context?: ReturnType<typeof buildDraftCandidateContext> extends Map<string, infer T> ? T : never; selected: boolean; targeted: boolean; onSelect: () => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  return <article className={`grid gap-3 border-l-2 px-4 py-3 transition-colors sm:px-5 lg:grid-cols-[minmax(13rem,1.3fr)_repeat(4,minmax(4.25rem,0.5fr))_minmax(8rem,0.8fr)_auto] lg:items-center ${selected ? 'border-l-accent bg-accent-muted/40' : 'border-l-transparent hover:bg-surface-0/60'}`}><button type="button" onClick={onSelect} aria-pressed={selected} className="min-w-0 text-left"><PlayerIdentity player={candidate.player} /></button><BoardMetric label="Yahoo ADP" value={formatYahooAdp(candidate.player)} /><BoardMetric label="Draft score" value={candidate.score.total.toFixed(1)} accent /><BoardMetric label="CI proj. FPPG" value={candidate.score.metrics.projectedFppg.toFixed(2)} /><BoardMetric label="PO starts / final" value={`${candidate.score.metrics.playoffUsableStarts}/${candidate.score.metrics.championshipWeek.usableStarts}`} positive icon={<Trophy size={12} />} /><div><p className={`text-xs font-semibold ${context?.advice === 'take-now' ? 'text-warning' : context?.advice === 'can-wait' ? 'text-positive' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? 'Take before tier drop' : context?.advice === 'can-wait' ? 'Can likely wait' : 'Close decision'}</p><p className={`mt-0.5 text-[10px] capitalize ${projectionTone(candidate.score.metrics.projectionTrajectory)}`}>{candidate.score.metrics.projectionTrajectory} · {candidate.score.metrics.projectionConfidence} confidence</p><p className="mt-0.5 text-[10px] text-ink-mute">{context?.similarAtPosition ?? 0} similar at position · next drop {context?.dropToNextAtPosition ?? 0}</p></div><DraftRowActions playerName={candidate.player.name} targeted={targeted} onTarget={onTarget} onTaken={onTaken} onMine={onMine} /></article>;
}

function RankedDraftList({ candidates, marketById, contextById, selectedId, targetById, onSelect, onTarget, onMine, onTaken }: { candidates: RankedDraftCandidate[]; marketById: Map<string, DraftMarketContext>; contextById: Map<string, DraftCandidateContext>; selectedId: string | null; targetById: Map<string, LeagueWorkspace['draftSession']['targets'][number]>; onSelect: (id: string) => void; onTarget: (candidate: RankedDraftCandidate) => void; onMine: (candidate: RankedDraftCandidate) => void; onTaken: (candidate: RankedDraftCandidate) => void }) {
  return <div>
    <div className="sticky top-[8.5rem] z-10 hidden grid-cols-[3rem_minmax(13rem,1.4fr)_repeat(5,minmax(4.5rem,0.55fr))_minmax(9rem,0.8fr)_9.75rem] items-center gap-3 border-b border-line bg-surface-2/95 px-5 py-2 text-[9px] font-bold uppercase tracking-wide text-ink-mute [backdrop-filter:var(--frost)] lg:grid"><span>Rank</span><span>Player</span><ColumnHelp label="Value vs ADP" explanation="Yahoo ADP minus Cracked Ice rank. Positive means Yahoo drafts the player later than Cracked Ice ranks them." /><span>Yahoo ADP</span><ColumnHelp label="Draft score" explanation="A 0–100 league-specific score combining projected value, schedule fit, playoff fit, positional value, and your manual adjustment." /><ColumnHelp label="CI proj. FPPG" explanation="Cracked Ice's early estimate of fantasy points per game using your league scoring." /><ColumnHelp label="PO starts / final" explanation="Usable starts across all fantasy playoff weeks / usable starts in your championship week." /><span>Decision</span><span className="sr-only">Actions</span></div>
    <div className="divide-y divide-line">{candidates.map((candidate) => { const id = normalizeId(candidate.player.id); return <RankedDraftRow key={candidate.player.id} candidate={candidate} context={contextById.get(id)} market={marketById.get(id)} selected={selectedId != null && normalizeId(selectedId) === id} targeted={targetById.has(id)} onSelect={() => onSelect(candidate.player.id)} onTarget={() => onTarget(candidate)} onMine={() => onMine(candidate)} onTaken={() => onTaken(candidate)} />; })}</div>
  </div>;
}

function RankedDraftRow({ candidate, context, market, selected, targeted, onSelect, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; context?: DraftCandidateContext; market?: DraftMarketContext; selected: boolean; targeted: boolean; onSelect: () => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  const value = market?.valueVsAdp;
  return <article className={`border-l-2 px-4 py-3 transition-colors [contain-intrinsic-size:auto_84px] [content-visibility:auto] sm:px-5 ${selected ? 'border-l-accent bg-accent-muted/40' : 'border-l-transparent hover:bg-surface-0/60'}`}>
    <div className="grid gap-3 lg:grid-cols-[3rem_minmax(13rem,1.4fr)_repeat(5,minmax(4.5rem,0.55fr))_minmax(9rem,0.8fr)_9.75rem] lg:items-center">
      <strong className="hidden font-mono text-sm text-ink-mute lg:block">#{market?.crackedIceRank ?? '—'}</strong>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="min-w-0 text-left"><span className="mb-1 block font-mono text-[10px] text-ink-mute lg:hidden">Cracked Ice #{market?.crackedIceRank ?? '—'}</span><PlayerIdentity player={candidate.player} /></button>
      <RankedMetric label="Value vs ADP" value={formatMarketValue(value)} tone={value != null && value > 0 ? 'positive' : value != null && value < 0 ? 'warning' : 'muted'} />
      <RankedMetric label="Yahoo ADP" value={formatYahooAdp(candidate.player)} />
      <RankedMetric label="Draft score" value={candidate.score.total.toFixed(1)} tone="accent" />
      <RankedMetric label="CI projected FPPG" value={candidate.score.metrics.projectedFppg.toFixed(2)} />
      <RankedMetric label="PO starts / final" value={`${candidate.score.metrics.playoffUsableStarts}/${candidate.score.metrics.championshipWeek.usableStarts}`} tone="positive" />
      <div><p className={`text-xs font-semibold ${context?.advice === 'take-now' ? 'text-warning' : context?.advice === 'can-wait' ? 'text-positive' : 'text-ink-dim'}`}>{context?.advice === 'take-now' ? 'Take before tier drop' : context?.advice === 'can-wait' ? 'Can likely wait' : 'Close decision'}</p><p className="mt-0.5 text-[10px] text-ink-mute">{context ? `${context.position} Tier ${context.tier} · next drop ${context.dropToNextAtPosition}` : 'Strategy context unavailable'}</p></div>
      <DraftRowActions playerName={candidate.player.name} targeted={targeted} onTarget={onTarget} onTaken={onTaken} onMine={onMine} />
    </div>
  </article>;
}

function RankedMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'accent' | 'positive' | 'warning' | 'muted' }) {
  const toneClass = tone === 'accent' ? 'text-accent' : tone === 'positive' ? 'text-positive' : tone === 'warning' ? 'text-warning' : tone === 'muted' ? 'text-ink-mute' : 'text-ink';
  return <div className="min-w-0"><strong className={`block font-mono text-sm ${toneClass}`}>{value}</strong><span className="text-[9px] text-ink-mute lg:hidden">{label}</span></div>;
}

function ColumnHelp({ label, explanation }: { label: string; explanation: string }) {
  return <span tabIndex={0} title={explanation} aria-label={`${label}. ${explanation}`} className="cursor-help underline decoration-dotted decoration-ink-mute/70 underline-offset-2 outline-none focus:text-accent">{label}</span>;
}

function DraftRowActions({ playerName, targeted, onTarget, onTaken, onMine }: { playerName: string; targeted: boolean; onTarget: () => void; onTaken: () => void; onMine: () => void }) {
  return <div className="flex items-center justify-end gap-1.5"><button type="button" aria-label={`${targeted ? 'Remove' : 'Add'} ${playerName} ${targeted ? 'from' : 'to'} targets`} aria-pressed={targeted} onClick={onTarget} className={`grid size-9 place-items-center rounded-md border ${targeted ? 'border-warning bg-warning-muted text-warning' : 'border-line text-ink-mute hover:text-warning'}`}><Star size={14} fill={targeted ? 'currentColor' : 'none'} /></button><button type="button" onClick={onTaken} className="min-h-9 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-dim hover:text-ink">Taken</button><button type="button" onClick={onMine} className="min-h-9 rounded-md bg-accent px-2.5 text-xs font-bold text-accent-ink">Mine</button></div>;
}

function TargetSummary({ targets, playerById, pickedIds, round, onRoundChange, onSelect, compact = false }: { targets: LeagueWorkspace['draftSession']['targets']; playerById: Map<string, DraftPlayer>; pickedIds: Set<string>; round: number; onRoundChange: (id: string, round: number | null) => void; onSelect: (id: string) => void; compact?: boolean }) {
  const available = targets.filter((target) => !pickedIds.has(normalizeId(target.playerId))).sort((a, b) => (a.targetRound ?? 99) - (b.targetRound ?? 99));
  if (!available.length) return <p className={`${compact ? 'mt-3' : 'mt-4'} text-sm text-ink-dim`}>Star players from the board and add the round where you hope to take them.</p>;
  return <div className={`${compact ? 'mt-3' : 'mt-4 grid gap-2 md:grid-cols-2'} space-y-2`}>{available.map((target) => { const player = playerById.get(normalizeId(target.playerId)); const approaching = target.targetRound !== null && target.targetRound <= round + 1; return <div key={target.playerId} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${approaching ? 'border-warning bg-warning-muted' : 'border-line bg-surface-0'}`}><button type="button" onClick={() => onSelect(target.playerId)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs text-ink">{target.fullName}</strong><span className="text-[10px] text-ink-mute">{player ? `${player.pos.join('/')} · ${player.team}` : 'Player data loading'}</span></button><label className="text-[9px] font-bold uppercase text-ink-mute">Round<input aria-label={`${target.fullName} target round`} type="number" min="1" max="50" value={target.targetRound ?? ''} onChange={(event) => onRoundChange(target.playerId, event.target.value ? Number(event.target.value) : null)} className="ml-1 h-7 w-12 rounded border border-line bg-surface-1 px-1 text-center text-xs text-ink" /></label></div>; })}</div>;
}

function SelectedPlayer({ candidate, context, market, targeted, sidebar = false, onAdjust, onFullProfile, onTarget, onMine, onTaken }: { candidate: RankedDraftCandidate; context?: DraftCandidateContext; market?: DraftMarketContext; targeted: boolean; sidebar?: boolean; onAdjust: (delta: number) => void; onFullProfile: () => void; onTarget: () => void; onMine: () => void; onTaken: () => void }) {
  const components = [['Production', candidate.score.components.production], ['Regular fit', candidate.score.components.regularSeason], ['Playoffs', candidate.score.components.playoffs], ['Position market', candidate.score.components.positionValue]] as const;
  return <div className={sidebar ? 'flex min-h-0 flex-1 flex-col' : 'p-4'}>
    <div className={sidebar ? 'shrink-0 p-4 pb-3' : ''}>
      <PlayerIdentity player={candidate.player} />
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-0 px-3 py-2">
        <div><p className="text-[9px] uppercase tracking-wide text-ink-mute">Market value</p><strong className={`font-mono text-sm ${market?.valueVsAdp != null && market.valueVsAdp > 0 ? 'text-positive' : 'text-ink'}`}>{formatMarketValue(market?.valueVsAdp)} vs Yahoo ADP</strong></div>
        <span className="rounded-full border border-accent bg-accent-muted px-2 py-1 text-[10px] font-bold text-accent">Cracked Ice #{market?.crackedIceRank ?? '—'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2"><MiniMetric value={formatYahooAdp(candidate.player)} label="Yahoo ADP" /><MiniMetric value={candidate.score.total.toFixed(1)} label="draft score" /><MiniMetric value={candidate.score.metrics.projectedFppg.toFixed(2)} label="CI projected FPPG" /><MiniMetric value={candidate.score.metrics.fppg.toFixed(2)} label="prior-season FPPG" /></div>
      <button type="button" onClick={onFullProfile} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent-muted text-xs font-bold text-accent hover:bg-accent/15"><Maximize2 size={14} />View full player profile</button>
    </div>
    <div className={sidebar ? 'min-h-0 overflow-y-auto border-t border-line px-4 pb-4' : ''}>
    <div className="mt-3 rounded-lg border border-line bg-surface-0 p-3"><div className="flex items-center justify-between gap-2"><p className={`text-xs font-semibold capitalize ${projectionTone(candidate.score.metrics.projectionTrajectory)}`}>{candidate.score.metrics.projectionTrajectory} outlook · {candidate.score.metrics.projectionDeltaPercent > 0 ? '+' : ''}{candidate.score.metrics.projectionDeltaPercent.toFixed(1)}%</p>{candidate.player.pos.includes('G') && <span className="text-[10px] text-ink-mute">{candidate.score.metrics.projectedGames} projected GP · {candidate.score.metrics.projectionVolatility} volatility</span>}</div><ul className="mt-2 space-y-1 text-[10px] text-ink-mute">{candidate.score.metrics.projectionReasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>
    <PlayoffWeekStrip score={candidate.score} />
    <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-surface-0 p-2"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">My adjustment</p><p className="text-xs text-ink-dim">Move this player without changing league scoring.</p></div><div className="flex items-center gap-1"><button type="button" aria-label={`Lower ${candidate.player.name} on my board`} onClick={() => onAdjust(-1)} className="grid size-8 place-items-center rounded-md border border-line text-ink-dim">−</button><strong className="min-w-8 text-center font-mono text-sm text-accent">{(candidate.score.metrics.manualAdjustment ?? 0) > 0 ? '+' : ''}{candidate.score.metrics.manualAdjustment ?? 0}</strong><button type="button" aria-label={`Raise ${candidate.player.name} on my board`} onClick={() => onAdjust(1)} className="grid size-8 place-items-center rounded-md border border-line text-ink-dim">+</button></div></div>
    <div className="mt-4 space-y-2">{components.map(([label, value]) => <div key={label}><div className="flex justify-between text-[10px] text-ink-dim"><span>{label}</span><span>{value.toFixed(0)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-0"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, value)}%` }} /></div></div>)}</div>
    <p className="mt-3 text-[10px] text-ink-mute">Regular season: {candidate.score.metrics.regularUsableStarts} usable starts · playoffs: {candidate.score.metrics.playoffUsableStarts}. Strategy weights decide how much playoff strength can offset regular-season access.</p>
    <div className={`mt-4 rounded-lg border p-3 text-xs ${context?.advice === 'take-now' ? 'border-warning bg-warning-muted text-warning' : 'border-line bg-surface-0 text-ink-dim'}`}>{context?.advice === 'take-now' ? `Only ${context.similarAtPosition} comparable option${context.similarAtPosition === 1 ? '' : 's'} remain at ${context.position}. Waiting costs about ${context.dropToNextAtPosition} strategy points.` : `${context?.similarAtPosition ?? 0} comparable ${context?.position ?? 'position'} options remain, so you may be able to wait.`}</div>
    <div className="mt-4 grid grid-cols-3 gap-2"><button type="button" onClick={onTarget} className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-md border text-xs font-semibold ${targeted ? 'border-warning text-warning' : 'border-line text-ink-dim'}`}><Star size={13} />{targeted ? 'Targeted' : 'Target'}</button><button type="button" onClick={onTaken} className="min-h-9 rounded-md border border-line text-xs font-semibold text-ink-dim">Taken</button><button type="button" onClick={onMine} className="min-h-9 rounded-md bg-accent text-xs font-bold text-accent-ink">Mine</button></div>
    <Link to={`/compare?mode=draft&a=${normalizeId(candidate.player.id)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><ArrowLeftRight size={13} />Compare this player</Link>
    </div>
  </div>;
}

function PlayoffWeekStrip({ score }: { score: RankedDraftCandidate['score'] }) {
  return <div className="mt-4"><div className="flex items-center justify-between"><span className="scoreboard-text flex items-center gap-1 text-positive"><Trophy size={11} />Playoff weeks</span><span className="text-[9px] text-ink-mute">usable / games</span></div><div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, score.metrics.playoffWeeks.length)}, minmax(0, 1fr))` }}>{score.metrics.playoffWeeks.map((week) => <div key={week.start} className={`rounded-md border px-2 py-2 text-center ${week.isChampionship ? 'border-positive bg-positive-muted' : 'border-line bg-surface-0'}`}><strong className={`block font-mono text-sm ${week.isChampionship ? 'text-positive' : 'text-ink'}`}>{week.usableStarts}/{week.games}</strong><span className="block truncate text-[8px] uppercase text-ink-mute">{week.isChampionship ? 'Final' : `W${week.index}`}</span></div>)}</div></div>;
}

function MiniMetric({ value, label }: { value: string | number; label: string }) { return <div className="rounded-md border border-line bg-surface-1 px-2 py-2"><strong className="block font-mono text-sm text-ink">{value}</strong><span className="text-[9px] text-ink-mute">{label}</span></div>; }

function formatYahooAdp(player: DraftPlayer): string {
  return player.yahooAdp ? player.yahooAdp.toFixed(1) : '—';
}

function formatMarketValue(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function projectionTone(trajectory: RankedDraftCandidate['score']['metrics']['projectionTrajectory']): string {
  return trajectory === 'rising' ? 'text-positive' : trajectory === 'declining' ? 'text-warning' : 'text-ink-dim';
}
function BoardMetric({ label, value, accent = false, positive = false, icon }: { label: string; value: string; accent?: boolean; positive?: boolean; icon?: ReactNode }) { return <div><strong className={`flex items-center gap-1 font-mono text-sm ${accent ? 'text-accent' : positive ? 'text-positive' : 'text-ink'}`}>{icon}{value}</strong><span className="text-[10px] text-ink-mute">{label}</span></div>; }
