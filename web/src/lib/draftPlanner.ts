import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace } from './leagueWorkspace';
import { configuredDraftRounds, draftOverallPickForTeam, draftTeamSlotAtPick, resolveDraftBoardPicks, resolvedDraftPosition } from './draftRoom';

export type OpponentSimulationScope = 'to-next-pick' | 'rest-of-draft';

export interface PlayerAvailabilityEstimate {
  playerId: string;
  name: string;
  team: string;
  positions: string[];
  yahooAdp: number | null;
  probability: number;
}

export interface PlannerPickTarget {
  overallPick: number;
  round: number;
}

export interface PlayerAvailabilityCurve {
  playerId: string;
  points: Array<PlannerPickTarget & { probability: number }>;
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function activeKeeperOverallPicks(workspace: LeagueWorkspace): number[] {
  const activeKeeperIds = new Set(workspace.roster.filter((entry) => entry.keeper || entry.protected).map((entry) => normalizeId(entry.playerId)));
  return workspace.draftSession.keeperPickAssignments.filter((assignment) => activeKeeperIds.has(normalizeId(assignment.playerId))).map(({ overallPick }) => overallPick);
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

function marketDeviation(marketRank: number, roomVolatility: number): number {
  // The opening picks are unusually stable: treating McDavid like a player at
  // pick 60 creates impossible-looking tails. Uncertainty expands gradually as
  // the player pool becomes flatter and human preferences matter more.
  const base = marketRank <= 5
    ? 0.35 + (marketRank * 0.08)
    : marketRank <= 15
      ? 2.3 + ((marketRank - 5) * 0.2)
      : marketRank <= 30
        ? 4.3 + ((marketRank - 15) * 0.18)
        : Math.min(20, 7 + ((marketRank - 30) * 0.08));
  return base * roomVolatility;
}

function reachProfile(marketRank: number, random: () => number): number {
  // Reaches exist, but a handful of late-player reaches should not regularly
  // push consensus top-two players out of the opening picks.
  if (marketRank <= 10) return 0;
  const reachChance = marketRank <= 30 ? 0.07 : marketRank <= 80 ? 0.11 : 0.17;
  if (random() >= reachChance) return 0;
  const maximumReach = marketRank <= 30
    ? Math.min(8, 1 + ((marketRank - 10) * 0.3))
    : Math.min(24, 4 + (Math.sqrt(marketRank) * 1.5));
  const ordinaryReach = 1 + (random() * maximumReach);
  const extremeReach = marketRank > 45 && random() < 0.025
    ? random() * Math.min(18, marketRank * 0.12)
    : 0;
  return ordinaryReach + extremeReach;
}

function playerSeed(id: string): number {
  let seed = 0;
  for (const character of normalizeId(id)) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return Math.abs(seed);
}

function simulatedDraftPosition(player: DraftPlayer, fallbackRank: number, seed: number): number {
  const marketRank = player.yahooAdp ?? fallbackRank;
  const random = seededRandom(seed + playerSeed(player.id));
  const profileRoll = random();
  const roomVolatility = profileRoll < 0.15 ? 1.45 : profileRoll < 0.6 ? 1 : 0.8;
  // ADP is the center of the market estimate. Volatility widens the range of
  // plausible selections without shifting every player's median later.
  return Math.max(1, marketRank + (normalSample(random) * marketDeviation(marketRank, roomVolatility)));
}

function simulatedMarketOrder(candidates: DraftPlayer[], seed: number): DraftPlayer[] {
  const random = seededRandom(seed);
  const profileRoll = random();
  const roomVolatility = profileRoll < 0.15 ? 1.45 : profileRoll < 0.6 ? 1 : 0.8;
  return candidates.map((player, index) => {
    const marketRank = player.yahooAdp ?? index + 1;
    const deviation = marketDeviation(marketRank, roomVolatility);
    const variance = normalSample(random);
    // ADP misses are asymmetric: players can slide several picks without an
    // equal number of later-ranked players all crashing the opening round.
    const marketMovement = variance < 0 ? variance * deviation * 0.45 : variance * deviation;
    return { player, simulatedPick: Math.max(1, marketRank + marketMovement - reachProfile(marketRank, random)) };
  }).sort((a, b) => a.simulatedPick - b.simulatedPick
    || (a.player.yahooAdp ?? Number.POSITIVE_INFINITY) - (b.player.yahooAdp ?? Number.POSITIVE_INFINITY)
    || a.player.name.localeCompare(b.player.name))
    .map(({ player }) => player);
}

function openOpponentPicks(workspace: LeagueWorkspace, scope: OpponentSimulationScope, targetOverallPick?: number): number[] {
  const myPosition = resolvedDraftPosition(workspace);
  if (!myPosition) return [];
  const occupied = new Set([
    ...resolveDraftBoardPicks(workspace).map(({ overallPick }) => overallPick),
    ...activeKeeperOverallPicks(workspace),
  ]);
  const totalPicks = configuredDraftRounds(workspace) * workspace.numberOfTeams;
  const limit = targetOverallPick ? Math.min(totalPicks + 1, targetOverallPick) : totalPicks + 1;
  const open: number[] = [];
  for (let overallPick = 1; overallPick < limit; overallPick += 1) {
    if (occupied.has(overallPick)) continue;
    const teamSlot = draftTeamSlotAtPick(overallPick, workspace.numberOfTeams, workspace.draftSession.orderType);
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

export function plannerPickTargets(workspace: LeagueWorkspace): PlannerPickTarget[] {
  const myPosition = resolvedDraftPosition(workspace);
  if (!myPosition) return [];
  const occupied = new Set([
    ...resolveDraftBoardPicks(workspace).map(({ overallPick }) => overallPick),
    ...activeKeeperOverallPicks(workspace),
  ]);
  return Array.from({ length: configuredDraftRounds(workspace) }, (_, index) => {
    const round = index + 1;
    return { round, overallPick: draftOverallPickForTeam(round, myPosition, workspace.numberOfTeams, workspace.draftSession.orderType) };
  }).filter(({ overallPick }) => !occupied.has(overallPick));
}

export function estimatePickAvailability(
  workspace: LeagueWorkspace,
  candidates: DraftPlayer[],
  displayCandidates: DraftPlayer[],
  targetOverallPick: number,
  runs = 500,
): PlayerAvailabilityEstimate[] {
  const safeRuns = Math.max(1, Math.min(1000, Math.floor(runs)));
  const counts = new Map(displayCandidates.map((player) => [normalizeId(player.id), 0]));
  const manualPicks = workspace.draftSession.picks.filter((pick) => pick.source !== 'simulation');
  const draftedIds = new Set(manualPicks.map((pick) => normalizeId(pick.playerId)));
  const availableCandidates = candidates.filter((player) => !draftedIds.has(normalizeId(player.id)));
  const fallbackRankById = new Map(availableCandidates.map((player, index) => [normalizeId(player.id), index + 1]));

  for (let run = 0; run < safeRuns; run += 1) {
    displayCandidates.forEach((player) => {
      const id = normalizeId(player.id);
      const simulatedPick = simulatedDraftPosition(player, fallbackRankById.get(id) ?? availableCandidates.length + 1, workspace.draftSession.simulationSeed + run);
      if (simulatedPick >= targetOverallPick) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  }

  return displayCandidates.map((player) => ({
    playerId: normalizeId(player.id),
    name: player.name,
    team: player.team,
    positions: [...player.pos],
    yahooAdp: player.yahooAdp ?? null,
    probability: Number(((((counts.get(normalizeId(player.id)) ?? 0) + 1) / (safeRuns + 2)) * 100).toFixed(1)),
  }));
}

export function estimateAvailabilityCurves(
  workspace: LeagueWorkspace,
  candidates: DraftPlayer[],
  displayCandidates: DraftPlayer[],
  targets: PlannerPickTarget[],
  runs = 500,
): PlayerAvailabilityCurve[] {
  const safeRuns = Math.max(1, Math.min(1000, Math.floor(runs)));
  if (!targets.length || !displayCandidates.length) return [];
  const manualPicks = workspace.draftSession.picks.filter((pick) => pick.source !== 'simulation');
  const draftedIds = new Set(manualPicks.map((pick) => normalizeId(pick.playerId)));
  const availableCandidates = candidates.filter((player) => !draftedIds.has(normalizeId(player.id)));
  const fallbackRankById = new Map(availableCandidates.map((player, index) => [normalizeId(player.id), index + 1]));
  const counts = new Map(displayCandidates.map((player) => [normalizeId(player.id), new Array(targets.length).fill(0) as number[]]));

  for (let run = 0; run < safeRuns; run += 1) {
    displayCandidates.forEach((player) => {
      const id = normalizeId(player.id);
      const playerCounts = counts.get(id);
      if (!playerCounts) return;
      const simulatedPick = simulatedDraftPosition(player, fallbackRankById.get(id) ?? availableCandidates.length + 1, workspace.draftSession.simulationSeed + run);
      targets.forEach(({ overallPick }, targetIndex) => {
        if (simulatedPick >= overallPick) playerCounts[targetIndex] += 1;
      });
    });
  }

  return displayCandidates.map((player) => ({
    playerId: normalizeId(player.id),
    points: targets.map((target, index) => ({
      ...target,
      probability: Number(((((counts.get(normalizeId(player.id))?.[index] ?? 0) + 1) / (safeRuns + 2)) * 100).toFixed(1)),
    })),
  }));
}

export function estimateNextPickAvailability(
  workspace: LeagueWorkspace,
  candidates: DraftPlayer[],
  displayCandidates: DraftPlayer[],
  runs = 500,
): PlayerAvailabilityEstimate[] {
  const target = plannerPickTargets(workspace)[0];
  return target ? estimatePickAvailability(workspace, candidates, displayCandidates, target.overallPick, runs) : [];
}
