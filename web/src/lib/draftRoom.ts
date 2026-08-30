import type { DraftPlayer } from './playerSearch';
import type { RankedDraftCandidate } from './draftStrategy';
import type { LeagueWorkspace } from './leagueWorkspace';

const RESERVE_SLOTS = new Set(['BN', 'IR', 'IR+']);
const MATERIAL_FALL_PICK_GAP = 5;

export interface DraftTier {
  position: DraftTierPosition;
  number: number;
  label: string;
  candidates: RankedDraftCandidate[];
}

export const DRAFT_TIER_POSITIONS = ['C', 'LW', 'RW', 'D', 'G'] as const;
export type DraftTierPosition = typeof DRAFT_TIER_POSITIONS[number];

export interface DraftCandidateContext {
  position: DraftTierPosition;
  tier: number;
  similarAtPosition: number;
  dropToNextAtPosition: number;
  advice: 'take-now' | 'can-wait' | 'balanced';
}

export type DraftBoardSortKey = 'valueVsAdp' | 'draftScore' | 'yahooAdp' | 'projectedFppg' | 'leagueFppg' | 'playoffStarts' | 'championshipStarts';

export interface DraftMarketContext {
  crackedIceRank: number;
  valueVsAdp: number | null;
}

export type DraftRecommendationLaneId = 'best-overall' | 'best-roster-fit' | 'value-that-fell' | 'strategy-fit';

export interface DraftRecommendationLane {
  id: DraftRecommendationLaneId;
  label: string;
  candidate: RankedDraftCandidate;
}

export interface DraftRecommendation {
  candidate: RankedDraftCandidate;
  labels: string[];
}

export function mergeDraftRecommendationLane(recommendations: DraftRecommendation[], candidate: RankedDraftCandidate, label: string): DraftRecommendation[] {
  const candidateId = normalizeId(candidate.player.id);
  const existing = recommendations.find((item) => normalizeId(item.candidate.player.id) === candidateId);
  if (!existing) return [...recommendations, { candidate, labels: [label] }];
  return recommendations.map((item) => normalizeId(item.candidate.player.id) === candidateId
    ? { ...item, labels: item.labels.includes(label) ? item.labels : [...item.labels, label] }
    : item);
}

export type DraftRoomLayout = 'full' | 'compact';

export function readDraftRoomLayout(searchParams: URLSearchParams): DraftRoomLayout {
  return searchParams.get('layout') === 'compact' ? 'compact' : 'full';
}

export function withDraftRoomLayout(searchParams: URLSearchParams, layout: DraftRoomLayout): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (layout === 'compact') next.set('layout', 'compact');
  else next.delete('layout');
  return next;
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

export function buildDraftTiers(
  rankings: RankedDraftCandidate[],
  gapThreshold = 2.75,
  positions: readonly DraftTierPosition[] = DRAFT_TIER_POSITIONS,
): DraftTier[] {
  const tiers: DraftTier[] = [];
  for (const position of positions) {
    const positionTiers: DraftTier[] = [];
    for (const candidate of rankings.filter((item) => item.player.pos.includes(position))) {
      const activeTier = positionTiers[positionTiers.length - 1];
      const previous = activeTier?.candidates[activeTier.candidates.length - 1];
      const tierLeader = activeTier?.candidates[0];
      const shouldStartTier = !previous
        || previous.score.total - candidate.score.total >= gapThreshold
        || (tierLeader?.score.total ?? candidate.score.total) - candidate.score.total >= gapThreshold * 1.5
        || (activeTier?.candidates.length ?? 0) >= 8;
      if (shouldStartTier) {
        const number = positionTiers.length + 1;
        positionTiers.push({ position, number, label: `${position} Tier ${number}`, candidates: [candidate] });
      } else {
        activeTier.candidates.push(candidate);
      }
    }
    tiers.push(...positionTiers);
  }
  return tiers;
}

export function buildDraftCandidateContext(rankings: RankedDraftCandidate[]): Map<string, DraftCandidateContext> {
  const tiers = buildDraftTiers(rankings);
  const tierByPositionAndId = new Map(tiers.flatMap((tier) => tier.candidates.map((candidate) => [`${tier.position}:${normalizeId(candidate.player.id)}`, tier.number] as const)));
  return new Map(rankings.map((candidate, index) => {
    const eligible = DRAFT_TIER_POSITIONS.filter((position) => candidate.player.pos.includes(position));
    const contexts = eligible.map((position) => {
      const laterAtPosition = rankings.slice(index + 1).filter((other) => other.player.pos.includes(position));
      const next = laterAtPosition[0];
      const drop = next ? Math.max(0, candidate.score.total - next.score.total) : candidate.score.total;
      const similar = laterAtPosition.filter((other) => candidate.score.total - other.score.total <= 2.75).length;
      return { position, drop, similar, tier: tierByPositionAndId.get(`${position}:${normalizeId(candidate.player.id)}`) ?? 1 };
    });
    const mostUrgent = contexts.sort((a, b) => b.drop - a.drop || a.similar - b.similar)[0]
      ?? { position: 'C' as const, drop: candidate.score.total, similar: 0, tier: 1 };
    return [normalizeId(candidate.player.id), {
      position: mostUrgent.position,
      tier: mostUrgent.tier,
      similarAtPosition: mostUrgent.similar,
      dropToNextAtPosition: Number(mostUrgent.drop.toFixed(1)),
      advice: mostUrgent.drop >= 4 || mostUrgent.similar === 0 ? 'take-now' : mostUrgent.similar >= 3 ? 'can-wait' : 'balanced',
    }];
  }));
}

export function buildDraftMarketContext(rankings: RankedDraftCandidate[]): Map<string, DraftMarketContext> {
  return new Map(rankings.map((candidate, index) => {
    const crackedIceRank = index + 1;
    const valueVsAdp = candidate.player.yahooAdp == null
      ? null
      : Number((candidate.player.yahooAdp - crackedIceRank).toFixed(1));
    return [normalizeId(candidate.player.id), { crackedIceRank, valueVsAdp }];
  }));
}

export function sortDraftBoardCandidates(
  candidates: RankedDraftCandidate[],
  marketContext: Map<string, DraftMarketContext>,
  sortKey: DraftBoardSortKey,
): RankedDraftCandidate[] {
  const numberOr = (value: number | null | undefined, fallback: number) => value == null || Number.isNaN(value) ? fallback : value;
  const compare = (a: RankedDraftCandidate, b: RankedDraftCandidate) => {
    const aMarket = marketContext.get(normalizeId(a.player.id));
    const bMarket = marketContext.get(normalizeId(b.player.id));
    switch (sortKey) {
      case 'valueVsAdp':
        return numberOr(bMarket?.valueVsAdp, Number.NEGATIVE_INFINITY) - numberOr(aMarket?.valueVsAdp, Number.NEGATIVE_INFINITY);
      case 'yahooAdp':
        return numberOr(a.player.yahooAdp, Number.POSITIVE_INFINITY) - numberOr(b.player.yahooAdp, Number.POSITIVE_INFINITY);
      case 'projectedFppg':
        return b.score.metrics.projectedFppg - a.score.metrics.projectedFppg;
      case 'leagueFppg':
        return b.score.metrics.fppg - a.score.metrics.fppg;
      case 'playoffStarts':
        return b.score.metrics.playoffUsableStarts - a.score.metrics.playoffUsableStarts;
      case 'championshipStarts':
        return b.score.metrics.championshipWeek.usableStarts - a.score.metrics.championshipWeek.usableStarts;
      case 'draftScore':
      default:
        return b.score.total - a.score.total;
    }
  };
  return [...candidates].sort((a, b) => compare(a, b)
    || (marketContext.get(normalizeId(a.player.id))?.crackedIceRank ?? Number.POSITIVE_INFINITY)
      - (marketContext.get(normalizeId(b.player.id))?.crackedIceRank ?? Number.POSITIVE_INFINITY)
    || a.player.name.localeCompare(b.player.name));
}

function remainingDraftSlots(workspace: LeagueWorkspace): Record<string, number> {
  const remaining = Object.fromEntries(Object.entries(workspace.rosterRules.slots).map(([slot, count]) => [slot, count]));
  const occupy = (slot?: string) => {
    const normalized = slot?.replace(/-\d+$/, '');
    if (normalized && remaining[normalized] > 0) remaining[normalized] -= 1;
  };
  workspace.roster.filter((entry) => entry.keeper).forEach((entry) => {
    const explicit = entry.slot?.replace(/-\d+$/, '');
    const eligible = [explicit, ...entry.positions, entry.positions.some((position) => ['C', 'LW', 'RW'].includes(position)) ? 'F' : undefined, 'UTIL']
      .filter((slot): slot is string => Boolean(slot) && !RESERVE_SLOTS.has(slot!));
    occupy(eligible.find((slot) => (remaining[slot] ?? 0) > 0));
  });
  workspace.draftSession.picks.filter((pick) => pick.status === 'mine').forEach((pick) => occupy(pick.slot));
  return remaining;
}

export function assignDraftActiveSlot(
  workspace: LeagueWorkspace,
  player: Pick<DraftPlayer, 'pos'>,
): string | undefined {
  const remaining = remainingDraftSlots(workspace);
  const activeEligible = [
    ...player.pos,
    player.pos.some((position) => ['C', 'LW', 'RW'].includes(position)) ? 'F' : undefined,
    'UTIL',
  ].filter((slot): slot is string => Boolean(slot));
  return activeEligible.find((slot) => (remaining[slot] ?? 0) > 0);
}

export function hasOpenActiveDraftSlots(workspace: LeagueWorkspace): boolean {
  const remaining = remainingDraftSlots(workspace);
  return Object.entries(remaining).some(([slot, count]) => !RESERVE_SLOTS.has(slot) && slot !== 'BN' && count > 0);
}

export function buildDraftRecommendationLanes(
  workspace: LeagueWorkspace,
  candidates: RankedDraftCandidate[],
  marketContext: Map<string, DraftMarketContext>,
): DraftRecommendation[] {
  if (!candidates.length) return [];
  const workloadAdjustedProduction = (candidate: RankedDraftCandidate) => candidate.score.metrics.projectedFppg * candidate.score.metrics.projectedGames;
  const currentOverallPick = workspace.draftSession.picks.length + 1;
  const bestOverall = [...candidates].sort((a, b) => workloadAdjustedProduction(b) - workloadAdjustedProduction(a)
    || b.score.metrics.valueOverReplacement - a.score.metrics.valueOverReplacement || b.score.total - a.score.total)[0];
  const bestRosterFit = candidates.filter((candidate) => Boolean(assignDraftActiveSlot(workspace, candidate.player))).sort((a, b) => b.score.total - a.score.total)[0];
  const valueThatFell = candidates.filter((candidate) => {
    const market = marketContext.get(normalizeId(candidate.player.id));
    if (!market || candidate.player.yahooAdp == null) return false;
    return currentOverallPick - market.crackedIceRank >= MATERIAL_FALL_PICK_GAP && currentOverallPick - candidate.player.yahooAdp >= MATERIAL_FALL_PICK_GAP;
  }).sort((a, b) => {
    const aMarket = marketContext.get(normalizeId(a.player.id))!; const bMarket = marketContext.get(normalizeId(b.player.id))!;
    const aFall = Math.min(currentOverallPick - aMarket.crackedIceRank, currentOverallPick - (a.player.yahooAdp ?? currentOverallPick));
    const bFall = Math.min(currentOverallPick - bMarket.crackedIceRank, currentOverallPick - (b.player.yahooAdp ?? currentOverallPick));
    return bFall - aFall || b.score.total - a.score.total;
  })[0];
  const strategyFit = [...candidates].sort((a, b) => b.score.total - a.score.total)[0];
  const lanes: DraftRecommendationLane[] = [
    { id: 'best-overall', label: 'Best overall', candidate: bestOverall },
    ...(bestRosterFit ? [{ id: 'best-roster-fit' as const, label: 'Best roster fit', candidate: bestRosterFit }] : []),
    ...(valueThatFell ? [{ id: 'value-that-fell' as const, label: 'Value that fell', candidate: valueThatFell }] : []),
    { id: 'strategy-fit', label: 'Strategy fit', candidate: strategyFit },
  ];
  const recommendations = new Map<string, DraftRecommendation>();
  lanes.forEach((lane) => { const id = normalizeId(lane.candidate.player.id); const existing = recommendations.get(id); if (existing) existing.labels.push(lane.label); else recommendations.set(id, { candidate: lane.candidate, labels: [lane.label] }); });
  return [...recommendations.values()];
}

export function assignDraftSlot(
  workspace: LeagueWorkspace,
  player: Pick<DraftPlayer, 'pos'>,
): string | undefined {
  const active = assignDraftActiveSlot(workspace, player);
  if (active) return active;
  const remaining = remainingDraftSlots(workspace);

  return (remaining.BN ?? 0) > 0 ? 'BN' : undefined;
}

export function currentDraftRound(workspace: LeagueWorkspace): number {
  return Math.floor(workspace.draftSession.picks.length / Math.max(2, workspace.numberOfTeams)) + 1;
}

export function isDrafted(workspace: LeagueWorkspace, playerId: string): boolean {
  const normalized = normalizeId(playerId);
  return workspace.draftSession.picks.some((pick) => normalizeId(pick.playerId) === normalized);
}

export function syncDraftRoster(
  workspace: LeagueWorkspace,
  draftSession: LeagueWorkspace['draftSession'] = workspace.draftSession,
): LeagueWorkspace['roster'] {
  const previousMineIds = new Set(workspace.draftSession.picks
    .filter((pick) => pick.status === 'mine')
    .map((pick) => normalizeId(pick.playerId)));
  const nextMine = draftSession.picks.filter((pick) => pick.status === 'mine');
  const nextMineIds = new Set(nextMine.map((pick) => normalizeId(pick.playerId)));
  const nextRoster = workspace.roster.filter((entry) => {
    const id = normalizeId(entry.playerId);
    return !previousMineIds.has(id) || nextMineIds.has(id) || entry.keeper || entry.protected;
  });
  const rosterById = new Map(nextRoster.map((entry, index) => [normalizeId(entry.playerId), index]));

  for (const pick of nextMine) {
    const id = normalizeId(pick.playerId);
    const existingIndex = rosterById.get(id);
    const draftEntry = {
      playerId: id,
      fullName: pick.fullName,
      team: pick.team,
      positions: [...pick.positions],
      slot: pick.slot,
      keeper: false,
      protected: false,
      undroppable: false,
    };
    if (existingIndex === undefined) {
      rosterById.set(id, nextRoster.length);
      nextRoster.push(draftEntry);
    } else {
      nextRoster[existingIndex] = { ...nextRoster[existingIndex], ...draftEntry };
    }
  }

  return nextRoster;
}
