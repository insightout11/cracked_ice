import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace } from './leagueWorkspace';
import { configuredDraftRounds, draftTeamSlotAtPick, resolveDraftBoardPicks, resolvedDraftPosition } from './draftRoom';

export type OpponentSimulationScope = 'to-next-pick' | 'rest-of-draft';

export interface PlayerAvailabilityEstimate {
  playerId: string;
  name: string;
  yahooAdp: number | null;
  probability: number;
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function seededRandom(seed: number): () => number {
  let state = Math.max(1, Math.floor(seed)) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(random: () => number): number {
  const first = Math.max(Number.EPSILON, random());
  const second = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function simulatedMarketOrder(candidates: DraftPlayer[], seed: number): DraftPlayer[] {
  const random = seededRandom(seed);
  return candidates.map((player, index) => {
    const marketRank = player.yahooAdp ?? index + 1;
    const deviation = Math.max(3.5, Math.min(18, marketRank * 0.1));
    return { player, simulatedPick: Math.max(1, marketRank + (normalSample(random) * deviation)) };
  }).sort((a, b) => a.simulatedPick - b.simulatedPick || (a.player.yahooAdp ?? Number.POSITIVE_INFINITY) - (b.player.yahooAdp ?? Number.POSITIVE_INFINITY) || a.player.name.localeCompare(b.player.name))
    .map(({ player }) => player);
}

function openOpponentPicks(workspace: LeagueWorkspace, scope: OpponentSimulationScope): number[] {
  const myPosition = resolvedDraftPosition(workspace);
  if (!myPosition) return [];
  const occupied = new Set(resolveDraftBoardPicks(workspace).map(({ overallPick }) => overallPick));
  const totalPicks = configuredDraftRounds(workspace) * workspace.numberOfTeams;
  const open: number[] = [];
  for (let overallPick = 1; overallPick <= totalPicks; overallPick += 1) {
    if (occupied.has(overallPick)) continue;
    const teamSlot = draftTeamSlotAtPick(overallPick, workspace.numberOfTeams);
    if (teamSlot === myPosition) {
      if (scope === 'to-next-pick') break;
      continue;
    }
    open.push(overallPick);
  }
  return open;
}

export function simulateYahooOpponentPicks(
  workspace: LeagueWorkspace,
  candidates: DraftPlayer[],
  scope: OpponentSimulationScope,
  seed = workspace.draftSession.simulationSeed,
): LeagueWorkspace['draftSession']['picks'] {
  const draftedIds = new Set(workspace.draftSession.picks.map((pick) => normalizeId(pick.playerId)));
  const available = candidates.filter((player) => !draftedIds.has(normalizeId(player.id)));
  const marketOrder = simulatedMarketOrder(available, seed);
  const madeAt = new Date().toISOString();
  return openOpponentPicks(workspace, scope).flatMap((overallPick, index) => {
    const player = marketOrder[index];
    if (!player) return [];
    return [{
      playerId: normalizeId(player.id),
      fullName: player.name,
      team: player.team,
      positions: [...player.pos],
      status: 'taken' as const,
      overallPick,
      source: 'simulation' as const,
      madeAt,
    }];
  });
}

export function estimateNextPickAvailability(
  workspace: LeagueWorkspace,
  candidates: DraftPlayer[],
  displayCandidates: DraftPlayer[],
  runs = 200,
): PlayerAvailabilityEstimate[] {
  const safeRuns = Math.max(1, Math.min(1000, Math.floor(runs)));
  const counts = new Map(displayCandidates.map((player) => [normalizeId(player.id), 0]));
  for (let run = 0; run < safeRuns; run += 1) {
    const simulated = simulateYahooOpponentPicks(workspace, candidates, 'to-next-pick', workspace.draftSession.simulationSeed + run);
    const selected = new Set(simulated.map((pick) => normalizeId(pick.playerId)));
    displayCandidates.forEach((player) => {
      const id = normalizeId(player.id);
      if (!selected.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  }
  return displayCandidates.map((player) => ({
    playerId: normalizeId(player.id),
    name: player.name,
    yahooAdp: player.yahooAdp ?? null,
    probability: Math.round(((counts.get(normalizeId(player.id)) ?? 0) / safeRuns) * 100),
  }));
}
