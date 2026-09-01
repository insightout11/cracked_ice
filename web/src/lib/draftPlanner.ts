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
  const profileRoll = random();
  const roomVolatility = profileRoll < 0.15 ? 1.85 : profileRoll < 0.6 ? 1.2 : 0.85;
  return candidates.map((player, index) => {
    const marketRank = player.yahooAdp ?? index + 1;
    const deviation = Math.max(5, Math.min(28, marketRank * 0.14)) * roomVolatility;
    const reaches = random() < 0.16;
    const extremeReach = random() < 0.025;
    const reachDistance = reaches ? 4 + (random() * Math.min(38, 10 + Math.sqrt(marketRank) * 3)) : 0;
    const outlierDistance = extremeReach ? 10 + (random() * Math.min(55, 18 + marketRank * 0.3)) : 0;
    return { player, simulatedPick: Math.max(1, marketRank + (normalSample(random) * deviation) - reachDistance - outlierDistance) };
  }).sort((a, b) => a.simulatedPick - b.simulatedPick
    || (a.player.yahooAdp ?? Number.POSITIVE_INFINITY) - (b.player.yahooAdp ?? Number.POSITIVE_INFINITY)
    || a.player.name.localeCompare(b.player.name))
    .map(({ player }) => player);
}

function openOpponentPicks(workspace: LeagueWorkspace, scope: OpponentSimulationScope, targetOverallPick?: number): number[] {
  const myPosition = resolvedDraftPosition(workspace);
  if (!myPosition) return [];
  const occupied = new Set(resolveDraftBoardPicks(workspace).map(({ overallPick }) => overallPick));
  const totalPicks = configuredDraftRounds(workspace) * workspace.numberOfTeams;
  const limit = targetOverallPick ? Math.min(totalPicks + 1, targetOverallPick) : totalPicks + 1;
  const open: number[] = [];
  for (let overallPick = 1; overallPick < limit; overallPick += 1) {
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

export function plannerPickTargets(workspace: LeagueWorkspace): PlannerPickTarget[] {
  const myPosition = resolvedDraftPosition(workspace);
  if (!myPosition) return [];
  const occupied = new Set(resolveDraftBoardPicks(workspace).map(({ overallPick }) => overallPick));
  return Array.from({ length: configuredDraftRounds(workspace) }, (_, index) => {
    const round = index + 1;
    return { round, overallPick: draftOverallPickForTeam(round, myPosition, workspace.numberOfTeams) };
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
  const simulationWorkspace = { ...workspace, draftSession: { ...workspace.draftSession, picks: manualPicks } };
  const draftedIds = new Set(manualPicks.map((pick) => normalizeId(pick.playerId)));
  const availableCandidates = candidates.filter((player) => !draftedIds.has(normalizeId(player.id)));
  const opponentPicks = openOpponentPicks(simulationWorkspace, 'rest-of-draft', targetOverallPick).length;

  for (let run = 0; run < safeRuns; run += 1) {
    const selected = new Set(simulatedMarketOrder(availableCandidates, workspace.draftSession.simulationSeed + run)
      .slice(0, opponentPicks)
      .map((player) => normalizeId(player.id)));
    displayCandidates.forEach((player) => {
      const id = normalizeId(player.id);
      if (!selected.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
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

export function estimateNextPickAvailability(
  workspace: LeagueWorkspace,
  candidates: DraftPlayer[],
  displayCandidates: DraftPlayer[],
  runs = 500,
): PlayerAvailabilityEstimate[] {
  const target = plannerPickTargets(workspace)[0];
  return target ? estimatePickAvailability(workspace, candidates, displayCandidates, target.overallPick, runs) : [];
}
