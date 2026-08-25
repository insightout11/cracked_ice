import type { DraftPlayer } from './playerSearch';
import type { RankedDraftCandidate } from './draftStrategy';
import type { LeagueWorkspace } from './leagueWorkspace';

const RESERVE_SLOTS = new Set(['BN', 'IR', 'IR+']);

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

export function assignDraftSlot(
  workspace: LeagueWorkspace,
  player: Pick<DraftPlayer, 'pos'>,
): string | undefined {
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

  const eligible = [
    ...player.pos,
    player.pos.some((position) => ['C', 'LW', 'RW'].includes(position)) ? 'F' : undefined,
    'UTIL',
    'BN',
  ].filter((slot): slot is string => Boolean(slot));
  return eligible.find((slot) => (remaining[slot] ?? 0) > 0);
}

export function currentDraftRound(workspace: LeagueWorkspace): number {
  return Math.floor(workspace.draftSession.picks.length / Math.max(2, workspace.numberOfTeams)) + 1;
}

export function isDrafted(workspace: LeagueWorkspace, playerId: string): boolean {
  const normalized = normalizeId(playerId);
  return workspace.draftSession.picks.some((pick) => normalizeId(pick.playerId) === normalized);
}
