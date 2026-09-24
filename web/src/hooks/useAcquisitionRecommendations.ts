import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import type { AcquisitionScenario, AcquisitionScenarioEvaluation } from '../lib/acquisitionScenarios';
import { evaluateAcquisitionScenarios } from '../lib/acquisitionScenarios';
import type { LeagueCandidate, LeagueWorkspace } from '../lib/leagueWorkspace';
import { isLeagueCandidateCurrent } from '../lib/leagueWorkspace';
import { isUnavailableRosterSlot } from '../lib/rosterEligibility';
import { discoverPickupCandidates, likelyOwnedPlayerIds, selectRecommendationLanePreviews, selectRecommendationLanes, type DiscoveredPickupCandidate, type RecommendationLane, type RecommendationLanePreview } from '../lib/pickupCandidateDiscovery';
import { apiService } from '../services/api';
import type { PlayerSearchResult } from '../types';
import type { TimeWindowState } from '../types/timeWindow';

export type RecommendationState = 'loading' | 'missing-input' | 'error' | 'ready' | 'no-clear-upgrade';

export interface RecommendationCandidate {
  candidate: LeagueCandidate;
  player: PlayerSearchResult;
  rosterPlayer: RosterPlayer;
}

export interface AutomaticRecommendationCandidate extends DiscoveredPickupCandidate {
  rosterPlayer: RosterPlayer;
}

export interface AcquisitionRecommendationResult {
  status: RecommendationState;
  directoryLoading: boolean;
  projectionLoading: boolean;
  error: string | null;
  issues: string[];
  players: PlayerSearchResult[];
  roster: RosterPlayer[];
  candidateProjections: Record<string, PlayerProjection>;
  mergedProjections: Record<string, PlayerProjection>;
  candidates: RecommendationCandidate[];
  currentCandidates: RecommendationCandidate[];
  unconfirmedShortlist: RecommendationCandidate[];
  automaticCandidates: AutomaticRecommendationCandidate[];
  confirmedEvaluations: AcquisitionScenarioEvaluation[];
  confirmedLanes: RecommendationLane[];
  targetScenarios: AcquisitionScenario[];
  automaticScenarios: AcquisitionScenario[];
  automaticLanes: RecommendationLane[];
  allScenarios: AcquisitionScenario[];
  lanes: RecommendationLanePreview[];
  leadScenario: AcquisitionScenario | null;
}

const EMPTY_PROJECTIONS: Record<string, PlayerProjection> = {};
const playerDirectoryRequests = new Map<string, Promise<PlayerSearchResult[]>>();
const projectionRequests = new Map<string, Promise<Record<string, PlayerProjection>>>();

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${key}:${stableKey(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function pickupProjectionWindow(timeWindow: TimeWindowState): { start: string; end: string } {
  return { start: timeWindow.config.startUtc.slice(0, 10), end: timeWindow.config.endUtc.slice(0, 10) };
}

export function acquisitionAvailabilityLabel(scenario: AcquisitionScenario): 'Confirmed available' | 'Needs recheck' | 'Availability not checked' {
  if (scenario.availability.status === 'available' && scenario.availability.freshness === 'current') return 'Confirmed available';
  if (scenario.availability.status === 'available' || scenario.availability.freshness === 'stale') return 'Needs recheck';
  return 'Availability not checked';
}

export function sourceLabel(source: string): string {
  return ({
    'live-provider': 'Provider sync',
    'screenshot-confirmed': 'Screenshot',
    'user-confirmed': 'Manually confirmed',
    'imported-snapshot': 'Pasted snapshot',
    unknown: 'Unknown',
  } as Record<string, string>)[source] ?? source;
}

export function toRosterPlayer(player: PlayerSearchResult): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    games_played: player.games_played ?? 0,
    stats: player.stats ?? { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
    blendedFppg: player.blendedFppg,
    seasonFppg: player.seasonFppg,
    last30Fppg: player.last30Fppg,
    last7Fppg: player.last7Fppg,
  };
}

function recommendationRoster(workspace: LeagueWorkspace, players: PlayerSearchResult[]): RosterPlayer[] {
  const byId = new Map(players.map((player) => [normalizeId(player.id), player]));
  return workspace.roster.map((entry) => {
    const directoryPlayer = byId.get(normalizeId(entry.playerId));
    return {
      ...(directoryPlayer ? toRosterPlayer(directoryPlayer) : {
        id: entry.playerId,
        full_name: entry.fullName,
        team: entry.team,
        positions: entry.positions,
        games_played: 0,
        stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
      }),
      id: entry.playerId,
      full_name: entry.fullName,
      team: entry.team,
      positions: entry.positions,
      current_slot: entry.slot,
    };
  });
}

function loadPlayerDirectory(profile: LeagueProfile): Promise<PlayerSearchResult[]> {
  const key = stableKey(profile);
  const cached = playerDirectoryRequests.get(key);
  if (cached) return cached;
  const request = apiService.getAllPlayers(profile).then((response) => response.results).catch((error) => {
    playerDirectoryRequests.delete(key);
    throw error;
  });
  playerDirectoryRequests.set(key, request);
  return request;
}

export function loadProjections(
  key: string,
  profile: LeagueProfile,
  window: { start: string; end: string },
  roster: Array<{ playerId: string; slot: string }>,
): Promise<Record<string, PlayerProjection>> {
  const cached = projectionRequests.get(key);
  if (cached) return cached;
  const request = apiService.applyRosterLineup({ league: profile, window, roster }).then((response) => response.projections).catch((error) => {
    projectionRequests.delete(key);
    throw error;
  });
  projectionRequests.set(key, request);
  return request;
}

function candidateCollections(workspace: LeagueWorkspace, roster: RosterPlayer[], players: PlayerSearchResult[]) {
  const playerById = new Map(players.map((player) => [normalizeId(player.id), player]));
  const candidates = workspace.candidates.map((candidate) => {
    const player = playerById.get(normalizeId(candidate.playerId));
    return player ? { candidate, player, rosterPlayer: toRosterPlayer(player) } : null;
  }).filter((item): item is RecommendationCandidate => Boolean(item));
  const currentCandidates = candidates.filter(({ candidate }) => isLeagueCandidateCurrent(candidate));
  const reviewableCandidates = candidates.filter(({ candidate }) => {
    const status = candidate.status ?? (candidate.availability === 'unknown' ? 'unknown' : 'available');
    return status !== 'taken' && !candidate.preference?.dismissed && !candidate.preference?.excluded;
  });
  const unconfirmedShortlist = reviewableCandidates.filter(({ candidate }) => !isLeagueCandidateCurrent(candidate)).sort((left, right) => {
    const leftScheduleFit = left.candidate.discovery?.source === 'schedule-fit' ? 1 : 0;
    const rightScheduleFit = right.candidate.discovery?.source === 'schedule-fit' ? 1 : 0;
    if (leftScheduleFit !== rightScheduleFit) return rightScheduleFit - leftScheduleFit;
    const leftMarket = left.candidate.discovery?.marketRank ?? Number.POSITIVE_INFINITY;
    const rightMarket = right.candidate.discovery?.marketRank ?? Number.POSITIVE_INFINITY;
    return leftMarket - rightMarket || (right.player.blendedFppg ?? 0) - (left.player.blendedFppg ?? 0);
  }).slice(0, 12);
  const automaticCandidates = discoverPickupCandidates(players, {
    rosterPlayerIds: roster.map((player) => player.id),
    existingCandidateIds: workspace.candidates.map((candidate) => candidate.playerId),
    excludedPlayerIds: likelyOwnedPlayerIds(workspace, players),
    marketSource: workspace.draftSession.marketSource,
    limit: 8,
    maxPerPosition: 2,
  }).map((discovery) => ({ ...discovery, rosterPlayer: toRosterPlayer(discovery.player) }));
  return { candidates, currentCandidates, unconfirmedShortlist, automaticCandidates };
}

function chooseLeadScenario(scenarios: AcquisitionScenario[]): AcquisitionScenario | null {
  const positive = scenarios.filter((scenario) => scenario.impact.projectedPointsDelta > 0 && ['recommend', 'conditional'].includes(scenario.materiality.outcome));
  const byGain = (left: AcquisitionScenario, right: AcquisitionScenario) => right.impact.projectedPointsDelta - left.impact.projectedPointsDelta || right.impact.usableStartsDelta - left.impact.usableStartsDelta;
  return positive.filter((scenario) => scenario.drop === null).sort(byGain)[0]
    ?? positive.filter((scenario) => scenario.availability.status === 'available' && scenario.availability.freshness === 'current').sort(byGain)[0]
    ?? positive.sort(byGain)[0]
    ?? null;
}

export function buildAcquisitionRecommendationResult(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  players: PlayerSearchResult[],
  projections: Record<string, PlayerProjection>,
  timeWindow: TimeWindowState,
  preparedCollections?: ReturnType<typeof candidateCollections>,
) {
  const { candidates, currentCandidates, unconfirmedShortlist, automaticCandidates } = preparedCollections ?? candidateCollections(workspace, roster, players);
  const options = {
    analysisStart: timeWindow.config.startUtc.slice(0, 10),
    analysisEnd: timeWindow.config.endUtc.slice(0, 10),
    projectionSource: workspace.projections.activeSourceId ?? 'cracked-ice',
    productionBasis: 'upcoming-projection' as const,
  };
  const confirmedEvaluations = currentCandidates.map(({ candidate, rosterPlayer }) => evaluateAcquisitionScenarios(workspace, roster, rosterPlayer, projections, {
    ...options,
    availabilityStatus: 'available',
    availabilityEvidence: sourceLabel(candidate.availability),
    availabilityObservedAt: candidate.evidence?.observedAt ?? candidate.observedAt,
    availabilityExpiresAt: candidate.evidence?.expiresAt ?? candidate.expiresAt,
    discoverySource: 'confirmed',
    transactionType: 'unknown',
    selectedDropId: candidate.discovery?.selectedDropPlayerId,
    participation: candidate.discovery?.marketRank ? { marketRank: candidate.discovery.marketRank, source: candidate.discovery.marketSource } : undefined,
    maxDropCandidates: 6,
  }));
  const targetEvaluations = unconfirmedShortlist.map(({ candidate, rosterPlayer }) => evaluateAcquisitionScenarios(workspace, roster, rosterPlayer, projections, {
    ...options,
    lane: roster.filter((player) => !isUnavailableRosterSlot(player.current_slot)).length < Object.entries(workspace.rosterRules.slots).filter(([slot]) => !['IR', 'IR+', 'IR-LT', 'NA'].includes(slot.toUpperCase())).reduce((total, [, count]) => total + count, 0) ? 'fill-roster' : 'this-week',
    availabilityStatus: candidate.status ?? 'unknown',
    availabilityEvidence: sourceLabel(candidate.availability),
    availabilityObservedAt: candidate.evidence?.observedAt ?? candidate.observedAt,
    availabilityExpiresAt: candidate.evidence?.expiresAt ?? candidate.expiresAt,
    discoverySource: candidate.discovery?.source === 'schedule-fit' ? 'schedule-fit' : 'user-selected',
    transactionType: 'unknown',
    selectedDropId: candidate.discovery?.selectedDropPlayerId,
    participation: candidate.discovery?.marketRank ? { marketRank: candidate.discovery.marketRank, source: candidate.discovery.marketSource } : undefined,
    maxDropCandidates: 6,
  }));
  const automaticEvaluations = automaticCandidates.map(({ evidence, marketRank, marketSource, rosterPlayer }) => evaluateAcquisitionScenarios(workspace, roster, rosterPlayer, projections, {
    ...options,
    availabilityStatus: 'unknown',
    availabilityEvidence: 'Not checked',
    discoverySource: 'automatic',
    transactionType: 'unknown',
    participation: marketRank ? { marketRank, source: `${marketSource.toUpperCase()} draft market` } : { source: evidence === 'nhl-sample' ? 'Established NHL sample' : undefined },
    maxDropCandidates: 4,
  }));
  const targetScenarios = targetEvaluations.flatMap((evaluation) => evaluation.scenarios.slice(0, 1)).sort((a, b) => b.impact.projectedPointsDelta - a.impact.projectedPointsDelta);
  const automaticScenarios = automaticEvaluations.flatMap((evaluation) => evaluation.scenarios.slice(0, 1));
  const confirmedScenarios = confirmedEvaluations.flatMap((evaluation) => evaluation.scenarios);
  const allScenarios = [...confirmedScenarios, ...targetScenarios, ...automaticScenarios];
  return {
    candidates,
    currentCandidates,
    unconfirmedShortlist,
    automaticCandidates,
    confirmedEvaluations,
    confirmedLanes: selectRecommendationLanes(confirmedScenarios),
    targetScenarios,
    automaticScenarios,
    automaticLanes: selectRecommendationLanes(automaticScenarios),
    allScenarios,
    lanes: selectRecommendationLanePreviews(allScenarios),
    leadScenario: chooseLeadScenario(allScenarios),
    issues: [...confirmedEvaluations, ...targetEvaluations, ...automaticEvaluations].flatMap((evaluation) => evaluation.issues),
  };
}

export function useAcquisitionRecommendations({
  workspace,
  leagueProfile,
  timeWindow,
  rosterProjections = EMPTY_PROJECTIONS,
  enabled = true,
}: {
  workspace: LeagueWorkspace;
  leagueProfile: LeagueProfile;
  timeWindow: TimeWindowState;
  rosterProjections?: Record<string, PlayerProjection>;
  enabled?: boolean;
}): AcquisitionRecommendationResult {
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  // Projections tagged with the request they answer, so a roster change doesn't
  // recalculate against the previous roster's projections.
  const [candidateState, setCandidateState] = useState<{ key: string; value: Record<string, PlayerProjection> }>({ key: '', value: {} });
  const candidateProjections = candidateState.value;
  const [directoryLoading, setDirectoryLoading] = useState(enabled);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const profileKey = useMemo(() => stableKey(leagueProfile), [leagueProfile]);
  const window = useMemo(() => pickupProjectionWindow(timeWindow), [timeWindow.config.endUtc, timeWindow.config.startUtc]);

  useEffect(() => {
    if (!enabled) { setDirectoryLoading(false); return; }
    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError(null);
    loadPlayerDirectory(leagueProfile).then((result) => { if (!cancelled) setPlayers(result); }).catch(() => {
      if (!cancelled) setDirectoryError('The player directory could not be loaded.');
    }).finally(() => { if (!cancelled) setDirectoryLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, profileKey]);

  const roster = useMemo(() => recommendationRoster(workspace, players), [players, workspace]);
  const collections = useMemo(() => candidateCollections(workspace, roster, players), [players, roster, workspace]);
  const projectionPlayers = useMemo(() => {
    const items = [...collections.currentCandidates, ...collections.unconfirmedShortlist, ...collections.automaticCandidates];
    return [...new Map(items.map((item) => [normalizeId(item.player.id), item.player])).values()];
  }, [collections]);
  const projectionRoster = useMemo(() => {
    const request = projectionPlayers.map((player) => ({ playerId: player.id, slot: 'BN' }));
    roster.forEach((player) => {
      request.push({ playerId: player.id, slot: player.current_slot ?? 'BN' });
    });
    return [...new Map(request.map((entry) => [normalizeId(entry.playerId), entry])).values()];
  }, [projectionPlayers, roster]);
  const projectionKey = useMemo(() => stableKey({ league: workspace.id, profile: profileKey, window, source: workspace.projections.activeSourceId, roster: projectionRoster.map((entry) => [normalizeId(entry.playerId), entry.slot]).sort() }), [profileKey, projectionRoster, window, workspace.id, workspace.projections.activeSourceId]);

  // Fetch when the request itself changes (projectionKey covers the profile's contents,
  // window and roster), not when an equal profile or roster object is re-created: that
  // restarted the request every render and made consumers flash between loading and results.
  const latestRequest = useRef({ leagueProfile, window, projectionRoster });
  latestRequest.current = { leagueProfile, window, projectionRoster };
  useEffect(() => {
    const { leagueProfile: profile, window: requestWindow, projectionRoster: requestRoster } = latestRequest.current;
    if (!enabled || directoryLoading || directoryError || requestRoster.length === 0) { setProjectionLoading(false); return; }
    let cancelled = false;
    setProjectionLoading(true);
    setProjectionError(null);
    loadProjections(projectionKey, profile, requestWindow, requestRoster).then((result) => {
      if (!cancelled) setCandidateState((previous) => (previous.key === projectionKey && previous.value === result ? previous : { key: projectionKey, value: result }));
    }).catch(() => {
      if (!cancelled) setProjectionError('Candidate schedule projections are temporarily unavailable.');
    }).finally(() => { if (!cancelled) setProjectionLoading(false); });
    return () => { cancelled = true; };
  }, [directoryError, directoryLoading, enabled, projectionKey]);

  const mergedProjections = useMemo(() => ({ ...rosterProjections, ...candidateProjections }), [candidateProjections, rosterProjections]);
  // Recalculate only once the projections match the current roster and candidates
  // (until then the previous results stay on screen), and at low priority so a
  // roster edit responds before the scenarios are re-solved.
  const settled = projectionRoster.length === 0 || candidateState.key === projectionKey;
  // Keyed on the window's dates: a new but equal time-window object must not
  // restart the deferred calculation (that would loop).
  const stableTimeWindow = useMemo(() => timeWindow, [timeWindow.config.startUtc, timeWindow.config.endUtc, timeWindow.mode]);
  const inputs = useMemo(
    () => (settled ? { workspace, roster, players, mergedProjections, timeWindow: stableTimeWindow, collections } : null),
    [collections, mergedProjections, players, roster, settled, stableTimeWindow, workspace],
  );
  const deferredInputs = useDeferredValue(inputs);
  const fresh = useMemo(
    () => (deferredInputs ? buildAcquisitionRecommendationResult(deferredInputs.workspace, deferredInputs.roster, deferredInputs.players, deferredInputs.mergedProjections, deferredInputs.timeWindow, deferredInputs.collections) : null),
    [deferredInputs],
  );
  const lastCalculated = useRef<ReturnType<typeof buildAcquisitionRecommendationResult> | null>(null);
  if (fresh) lastCalculated.current = fresh;
  const empty = useMemo(() => buildAcquisitionRecommendationResult(workspace, roster, [], {}, stableTimeWindow), [roster, stableTimeWindow, workspace]);
  const calculated = fresh ?? lastCalculated.current ?? empty;
  let status: RecommendationState = 'ready';
  if (!enabled || roster.length === 0 || !window.start || !window.end) status = 'missing-input';
  else if (directoryLoading || projectionLoading) status = 'loading';
  else if (directoryError || projectionError) status = 'error';
  else if (projectionPlayers.length > 0 && calculated.allScenarios.length === 0 && calculated.issues.some((issue) => /projection is unavailable/i.test(issue))) status = 'missing-input';
  else if (!calculated.leadScenario) status = 'no-clear-upgrade';

  return { status, directoryLoading, projectionLoading, error: directoryError ?? projectionError, players, roster, candidateProjections, mergedProjections, ...calculated };
}
