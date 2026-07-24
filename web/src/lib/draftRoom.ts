import type { DraftPlayer } from './playerSearch';
import type { RankedDraftCandidate } from './draftStrategy';
import type { LeagueWorkspace } from './leagueWorkspace';

const RESERVE_SLOTS = new Set(['BN', 'IR', 'IR+']);

export interface DraftTier {
  number: number;
  label: string;
  candidates: RankedDraftCandidate[];
}

export interface DraftCandidateContext {
  tier: number;
  similarAtPosition: number;
  dropToNextAtPosition: number;
  advice: 'take-now' | 'can-wait' | 'balanced';
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

export function buildDraftTiers(rankings: RankedDraftCandidate[], gapThreshold = 2.75): DraftTier[] {
  const tiers: DraftTier[] = [];
  for (const candidate of rankings) {
    const activeTier = tiers[tiers.length - 1];
    const previous = activeTier?.candidates[activeTier.candidates.length - 1];
    const shouldStartTier = !previous
      || previous.score.total - candidate.score.total >= gapThreshold
      || (activeTier?.candidates.length ?? 0) >= 8;
    if (shouldStartTier) {
      const number = tiers.length + 1;
      tiers.push({ number, label: `Tier ${number}`, candidates: [candidate] });
    } else {
      activeTier.candidates.push(candidate);
    }
  }
  return tiers;
}

export function buildDraftCandidateContext(rankings: RankedDraftCandidate[]): Map<string, DraftCandidateContext> {
  const tiers = buildDraftTiers(rankings);
  const tierById = new Map(tiers.flatMap((tier) => tier.candidates.map((candidate) => [normalizeId(candidate.player.id), tier.number] as const)));
  return new Map(rankings.map((candidate, index) => {
    const laterAtPosition = rankings.slice(index + 1).filter((other) =>
      other.player.pos.some((position) => candidate.player.pos.includes(position)));
    const next = laterAtPosition[0];
    const drop = next ? Math.max(0, candidate.score.total - next.score.total) : candidate.score.total;
    const similar = laterAtPosition.filter((other) => candidate.score.total - other.score.total <= 2.75).length;
    return [normalizeId(candidate.player.id), {
      tier: tierById.get(normalizeId(candidate.player.id)) ?? 1,
      similarAtPosition: similar,
      dropToNextAtPosition: Number(drop.toFixed(1)),
      advice: drop >= 4 || similar === 0 ? 'take-now' : similar >= 3 ? 'can-wait' : 'balanced',
    }];
  }));
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
