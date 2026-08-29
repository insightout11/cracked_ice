import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace, DraftStrategyPresetId } from './leagueWorkspace';
import { DRAFT_STRATEGY_PRESETS } from './leagueWorkspace';
import { buildFantasySeasonOpportunity, buildMatchupWeeks, type SeasonScheduleData } from './schedulePlanning';
import { simulateDailyLineup } from './acquisitionAnalysis';
import { applyImportedProjectionOverrides, buildNextSeasonProjectionMap, type NextSeasonProjection, type ProjectionConfidence, type ProjectionTrajectory, type ProjectionVolatility } from './draftProjection';
import { activeProjectionLabel, projectionSelectionValue } from './projectionImport';
import { SEASON_GAMES_PER_TEAM } from './season';

export type DraftScoreKey = 'production' | 'regularSeason' | 'playoffs' | 'positionValue';

export interface PositionValuation {
  valueOverReplacement: number;
  replacementFppg: number;
  replacementPosition: string | null;
  marketPosition: string | null;
  marketScarcity: number;
  flexibilityBonus: number;
  positionValue: number;
}

export interface DraftCandidateScore {
  playerId: string;
  total: number;
  components: Record<DraftScoreKey, number>;
  contributions: Record<DraftScoreKey, number>;
  metrics: {
    fppg: number;
    projectedFppg: number;
    projectionDeltaPercent: number;
    projectionTrajectory: ProjectionTrajectory;
    projectionConfidence: ProjectionConfidence;
    projectionVolatility: ProjectionVolatility;
    projectionReasons: string[];
    projectedGames: number;
    sampleGames: number;
    productionReliability: number;
    regularGames: number;
    regularOffNights: number;
    regularUsableStarts: number;
    regularAddedStarts: number;
    regularBlockedStarts: number;
    playoffGames: number;
    playoffOffNights: number;
    playoffUsableStarts: number;
    playoffAddedStarts: number;
    playoffBlockedStarts: number;
    fantasySeasonGames: number;
    fantasySeasonUsableStarts: number;
    fantasySeasonAddedStarts: number;
    projectedFantasyPoints: number;
    marginalProjectedPoints: number;
    postFantasyGames: number;
    playoffWeeks: PlayoffWeekScore[];
    championshipWeek: PlayoffWeekScore;
    valueOverReplacement: number;
    replacementFppg: number;
    replacementPosition: string | null;
    marketPosition: string | null;
    marketScarcity: number;
    flexibilityBonus: number;
    manualAdjustment?: number;
  };
}

export interface PlayoffWeekScore {
  index: number;
  label: string;
  start: string;
  end: string;
  games: number;
  offNights: number;
  usableStarts: number;
  isChampionship: boolean;
}

export interface DraftStrategyComparison {
  strategyLabel: string;
  winnerId: string | null;
  verdict: string;
  explanation: string;
  optionA: DraftCandidateScore;
  optionB: DraftCandidateScore;
}

export interface RankedDraftCandidate {
  player: DraftPlayer;
  score: DraftCandidateScore;
}

interface LineupBaseline {
  starts: number;
  points: number;
}

interface DraftScoringBaselines {
  regular: LineupBaseline;
  playoffs: LineupBaseline;
}

const COMPONENT_LABELS: Record<DraftScoreKey, string> = {
  production: 'projected fantasy-season value',
  regularSeason: 'regular-season schedule',
  playoffs: 'fantasy-playoff schedule',
  positionValue: 'position value over replacement',
};

const MARKET_POSITIONS = ['C', 'LW', 'RW', 'D', 'G'] as const;
const INACTIVE_MARKET_SLOTS = new Set(['IR', 'IR+', 'IR-LT', 'NA']);

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function workspaceProjectionMap(directory: DraftPlayer[], workspace: LeagueWorkspace): Map<string, NextSeasonProjection> {
  const base = buildNextSeasonProjectionMap(directory, workspace.season.start);
  if (!workspace.projections.activeSourceId) return base;
  const overrides = Object.fromEntries([...base.entries()].map(([id, projection]) => {
    const selected = projectionSelectionValue(workspace, id, projection);
    return [id, { projectedFppg: selected.projectedFppg, projectedGames: selected.projectedGames }];
  }));
  return applyImportedProjectionOverrides(base, overrides, activeProjectionLabel(workspace));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function sampleGames(player: DraftPlayer): number {
  return player.nhlGamesPlayed ?? player.scoringBreakdown?.gamesPlayed ?? 0;
}

function goalieWorkloadRate(player: DraftPlayer, projection?: NextSeasonProjection): number {
  if (!player.pos.includes('G')) return 1;
  return Math.max(0.1, Math.min(0.78, (projection?.projectedGames ?? sampleGames(player)) / SEASON_GAMES_PER_TEAM));
}

function selectExpectedGames<T>(games: T[], expectedGames: number): T[] {
  const count = Math.max(0, Math.min(games.length, Math.round(expectedGames)));
  if (count === 0) return [];
  if (count === games.length) return games;
  return Array.from({ length: count }, (_, index) => games[Math.floor(((index + 0.5) * games.length) / count)]);
}

function percentile(values: number[], value: number): number {
  if (values.length === 0) return 50;
  const below = values.filter((candidate) => candidate < value).length;
  const equal = values.filter((candidate) => candidate === value).length;
  return clamp(((below + (equal * 0.5)) / values.length) * 100);
}

function rangeScore(values: number[], value: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (quantile: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * quantile)))] ?? 0;
  const low = at(0.1);
  const high = at(1);
  if (high <= low) return 50;
  return clamp(((value - low) / (high - low)) * 100);
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function playerAsRoster(player: DraftPlayer): RosterPlayer {
  return {
    id: player.id,
    full_name: player.name,
    team: player.team,
    positions: player.pos,
    current_slot: 'BN',
    games_played: 0,
    blendedFppg: player.blendedFppg ?? 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
  };
}

function buildWindowProjections(
  players: RosterPlayer[],
  directory: DraftPlayer[],
  outlooks: Map<string, NextSeasonProjection>,
  schedule: SeasonScheduleData,
  start: string,
  end: string,
): Record<string, PlayerProjection> {
  const directoryById = new Map(directory.map((player) => [normalizeId(player.id), player]));
  return Object.fromEntries(players.map((player) => {
    const source = directoryById.get(normalizeId(player.id));
    const fppg = outlooks.get(normalizeId(player.id))?.projectedFppg ?? source?.blendedFppg ?? player.blendedFppg ?? player.seasonFppg ?? 0;
    const teamGames = (schedule.games[player.team] ?? []).filter((game) => game.date >= start && game.date <= end);
    const sourceProjection = outlooks.get(normalizeId(player.id));
    const workloadRate = goalieWorkloadRate(source ?? { ...player, pos: player.positions } as DraftPlayer, sourceProjection);
    const games = player.positions.includes('G')
      ? selectExpectedGames(teamGames, Math.round(teamGames.length * workloadRate))
      : teamGames;
    return [normalizeId(player.id), {
      fppg,
      starts: games.length,
      gamesAvailable: games.length,
      projectedPoints: fppg * games.length,
      offNightRate: games.length ? games.filter((game) => game.isOffNight).length / games.length : 0,
      strengthOfSchedule: 5,
      gamesByDate: Object.fromEntries(games.map((game) => [game.date, {
        opponent: game.opponent,
        isHome: game.isHome,
        isOffNight: Boolean(game.isOffNight),
        startTime: game.startTime ?? `${game.date}T00:00:00Z`,
      }])),
    } satisfies PlayerProjection];
  }));
}

function marketSlot(slot: string): string {
  return slot.toUpperCase().replace(/-\d+$/, '');
}

function canFillMarketSlot(positions: readonly string[], rawSlot: string): boolean {
  const slot = marketSlot(rawSlot);
  const eligible = positions.map((position) => position.toUpperCase());
  if (eligible.includes(slot)) return true;
  if (slot === 'W') return eligible.some((position) => position === 'LW' || position === 'RW' || position === 'W');
  if (slot === 'F') return eligible.some((position) => ['C', 'LW', 'RW', 'W', 'F'].includes(position));
  if (['UTIL', 'U', 'FLEX'].includes(slot)) return eligible.some((position) => position !== 'G');
  return slot === 'BN';
}

function emptyPositionValuation(): PositionValuation {
  return {
    valueOverReplacement: 0,
    replacementFppg: 0,
    replacementPosition: null,
    marketPosition: null,
    marketScarcity: 0,
    flexibilityBonus: 0,
    positionValue: 0,
  };
}

/**
 * Models the end-of-draft free-agent market once across the whole league. Players
 * can occupy only one projected roster spot, while W/F/UTIL/BN demand is shared
 * across every eligible position. Drafted players and keepers consume demand
 * before the remaining pool is projected.
 */
export function buildPositionValuations(
  directory: DraftPlayer[],
  workspace: LeagueWorkspace,
  outlooks = workspaceProjectionMap(directory, workspace),
): Map<string, PositionValuation> {
  const valuationFppg = (candidate: DraftPlayer) => outlooks.get(normalizeId(candidate.id))?.projectedFppg ?? candidate.blendedFppg ?? 0;
  const capacities = Object.fromEntries(Object.entries(workspace.rosterRules.slots)
    .map(([slot, count]) => [marketSlot(slot), Math.max(0, count * workspace.numberOfTeams)] as const)
    .filter(([slot, count]) => count > 0 && !INACTIVE_MARKET_SLOTS.has(slot)));
  const initialCapacities = { ...capacities };
  const committed = new Map<string, { positions: string[]; slot?: string }>();
  workspace.roster.filter((entry) => entry.keeper).forEach((entry) => committed.set(normalizeId(entry.playerId), { positions: entry.positions, slot: entry.slot }));
  workspace.draftSession.picks.forEach((pick) => committed.set(normalizeId(pick.playerId), { positions: pick.positions, slot: pick.slot }));

  const chooseSlot = (positions: readonly string[], preferred?: string): string | undefined => {
    const normalizedPreferred = preferred ? marketSlot(preferred) : undefined;
    if (normalizedPreferred && (capacities[normalizedPreferred] ?? 0) > 0 && canFillMarketSlot(positions, normalizedPreferred)) return normalizedPreferred;
    const exact = MARKET_POSITIONS
      .filter((position) => positions.includes(position) && (capacities[position] ?? 0) > 0)
      .sort((a, b) => (capacities[b] ?? 0) - (capacities[a] ?? 0))[0];
    if (exact) return exact;
    return ['W', 'F', 'UTIL', 'U', 'FLEX', 'BN'].find((slot) => (capacities[slot] ?? 0) > 0 && canFillMarketSlot(positions, slot));
  };
  committed.forEach(({ positions, slot }) => {
    const assigned = chooseSlot(positions, slot);
    if (assigned) capacities[assigned] -= 1;
  });

  const available = directory
    .filter((candidate) => candidate.blendedFppg !== null && !committed.has(normalizeId(candidate.id)))
    .sort((a, b) => valuationFppg(b) - valuationFppg(a) || a.name.localeCompare(b.name));
  const selected = new Set<string>();
  const supply = (position: string) => available.filter((player) => player.pos.includes(position)).length;
  const exactOrder = MARKET_POSITIONS
    .filter((position) => (capacities[position] ?? 0) > 0)
    .sort((a, b) => ((capacities[b] ?? 0) / Math.max(1, supply(b))) - ((capacities[a] ?? 0) / Math.max(1, supply(a))));
  exactOrder.forEach((position) => {
    const count = capacities[position] ?? 0;
    available
      .filter((player) => !selected.has(normalizeId(player.id)) && player.pos.includes(position))
      .slice(0, count)
      .forEach((player) => selected.add(normalizeId(player.id)));
    capacities[position] = 0;
  });
  ['W', 'F', 'UTIL', 'U', 'FLEX', 'BN'].forEach((slot) => {
    const count = capacities[slot] ?? 0;
    available
      .filter((player) => !selected.has(normalizeId(player.id)) && canFillMarketSlot(player.pos, slot))
      .slice(0, count)
      .forEach((player) => selected.add(normalizeId(player.id)));
    capacities[slot] = 0;
  });

  const projectedFreeAgents = available.filter((player) => !selected.has(normalizeId(player.id)));
  const positionHasDemand = (position: string) => Object.entries(initialCapacities)
    .some(([slot, count]) => count > 0 && canFillMarketSlot([position], slot));
  const replacementByPosition = new Map<string, number>();
  const rawScarcityByPosition = new Map<string, number>();
  MARKET_POSITIONS.forEach((position) => {
    if (!positionHasDemand(position)) return;
    const positionPool = available.filter((candidate) => candidate.pos.includes(position));
    const replacement = projectedFreeAgents.find((candidate) => candidate.pos.includes(position));
    const fallback = positionPool[positionPool.length - 1];
    const replacementValue = replacement ? valuationFppg(replacement) : fallback ? valuationFppg(fallback) : 0;
    replacementByPosition.set(position, replacementValue || 0);
    rawScarcityByPosition.set(position, positionPool.length
      ? 100 - percentile(positionPool.map(valuationFppg), replacementValue || 0)
      : 0);
  });
  const skaterScarcityValues = MARKET_POSITIONS
    .filter((position) => position !== 'G')
    .map((position) => rawScarcityByPosition.get(position))
    .filter((value): value is number => value !== undefined);
  const marketScarcityByPosition = new Map<string, number>(MARKET_POSITIONS.map((position) => {
    const raw = rawScarcityByPosition.get(position);
    if (raw === undefined) return [position, 0];
    return [position, position === 'G' ? 50 : rangeScore(skaterScarcityValues, raw)];
  }));

  const valuations = new Map<string, PositionValuation>(directory.map((player) => {
    const fppg = valuationFppg(player);
    const eligible = MARKET_POSITIONS
      .filter((position) => player.pos.includes(position) && replacementByPosition.has(position))
      .map((position) => ({
        position,
        replacement: replacementByPosition.get(position) ?? 0,
        scarcity: marketScarcityByPosition.get(position) ?? 0,
      }));
    if (!eligible.length) return [normalizeId(player.id), emptyPositionValuation()];
    const bestReplacement = [...eligible].sort((a, b) => (fppg - b.replacement) - (fppg - a.replacement) || b.scarcity - a.scarcity)[0];
    const bestMarket = [...eligible].sort((a, b) => b.scarcity - a.scarcity || a.replacement - b.replacement)[0];
    const flexibilityBonus = Math.min(6, Math.max(0, eligible.length - 1) * 3);
    return [normalizeId(player.id), {
      valueOverReplacement: fppg - bestReplacement.replacement,
      replacementFppg: bestReplacement.replacement,
      replacementPosition: bestReplacement.position,
      marketPosition: bestMarket.position,
      marketScarcity: bestMarket.scarcity,
      flexibilityBonus,
      positionValue: 0,
    }];
  }));
  const skaterVor = directory
    .filter((player) => !player.pos.includes('G'))
    .map((player) => valuations.get(normalizeId(player.id))?.valueOverReplacement ?? 0);
  const goalieVor = directory
    .filter((player) => player.pos.includes('G'))
    .map((player) => valuations.get(normalizeId(player.id))?.valueOverReplacement ?? 0);

  return new Map(directory.map((player) => {
    const id = normalizeId(player.id);
    const valuation = valuations.get(id) ?? emptyPositionValuation();
    if (!valuation.replacementPosition) return [id, valuation];
    const pool = player.pos.includes('G') ? goalieVor : skaterVor;
    return [id, {
      ...valuation,
      positionValue: clamp(rangeScore(pool, valuation.valueOverReplacement) + valuation.flexibilityBonus),
    }];
  }));
}

function scheduleComponent(
  player: DraftPlayer,
  roster: RosterPlayer[],
  directory: DraftPlayer[],
  outlooks: Map<string, NextSeasonProjection>,
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
  start: string,
  end: string,
  baseline?: LineupBaseline,
): { score: number; games: number; offNights: number; usableStarts: number; addedStarts: number; addedPoints: number; usableDates: string[] } {
  const teamRows = Object.values(schedule.games).map((games) => {
    const inWindow = games.filter((game) => game.date >= start && game.date <= end);
    return { games: inWindow.length, offNights: inWindow.filter((game) => game.isOffNight).length };
  });
  const teamPlayerGames = (schedule.games[player.team] ?? []).filter((game) => game.date >= start && game.date <= end);
  const workloadRate = goalieWorkloadRate(player, outlooks.get(normalizeId(player.id)));
  const playerGames = player.pos.includes('G')
    ? selectExpectedGames(teamPlayerGames, Math.round(teamPlayerGames.length * workloadRate))
    : teamPlayerGames;
  const expectedGames = playerGames.length;
  const rawOffNights = playerGames.filter((game) => game.isOffNight).length;
  const offNights = rawOffNights;
  // Keep every position on the same volume scale. Normalizing goalies only
  // against other goalies made a low-workload but fully usable goalie appear
  // more schedule-friendly than a skater who added more actual lineup starts.
  const maxGames = Math.max(1, ...teamRows.map((row) => row.games));
  const maxOffNights = Math.max(1, ...teamRows.map((row) => row.offNights));
  const scheduleScore = ((expectedGames / maxGames) * 90)
    + ((offNights / maxOffNights) * 10);

  if (roster.length === 0) return {
    score: scheduleScore,
    games: expectedGames,
    offNights,
    usableStarts: expectedGames,
    addedStarts: expectedGames,
    addedPoints: expectedGames * (outlooks.get(normalizeId(player.id))?.projectedFppg ?? player.blendedFppg ?? 0),
    usableDates: playerGames.map((game) => game.date),
  };
  const candidate = playerAsRoster(player);
  const scenarioRoster = [...roster.filter((item) => normalizeId(item.id) !== normalizeId(candidate.id)), candidate];
  const projections = buildWindowProjections(scenarioRoster, directory, outlooks, schedule, start, end);
  const rosterBaseline = baseline ?? simulateDailyLineup(workspace, roster, projections);
  const scenario = simulateDailyLineup(workspace, scenarioRoster, projections);
  const usableDates = scenario.startDatesByPlayer[normalizeId(candidate.id)] ?? [];
  const usableStarts = usableDates.length;
  const addedStarts = Math.max(0, scenario.starts - rosterBaseline.starts);
  const addedPoints = Math.max(0, scenario.points - rosterBaseline.points);
  const lineupFit = expectedGames ? Math.min(100, (addedStarts / expectedGames) * 100) : 0;
  return { score: (scheduleScore * 0.4) + (lineupFit * 0.6), games: expectedGames, offNights, usableStarts, addedStarts, addedPoints, usableDates };
}

function buildPlayoffWeekScores(
  player: DraftPlayer,
  projection: NextSeasonProjection | undefined,
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
  usableDates: string[],
): PlayoffWeekScore[] {
  const usable = new Set(usableDates);
  const allGames = (schedule.games[player.team] ?? []).filter((game) => game.date >= workspace.schedule.playoffs.start && game.date <= workspace.schedule.playoffs.end);
  const workloadRate = goalieWorkloadRate(player, projection);
  const playableGames = player.pos.includes('G')
    ? selectExpectedGames(allGames, Math.round(allGames.length * workloadRate))
    : allGames;
  return buildMatchupWeeks(workspace.schedule.playoffs.start, workspace.schedule.playoffs.end).map((week) => {
    const games = playableGames.filter((game) => game.date >= week.start && game.date <= week.end);
    return {
      ...week,
      games: games.length,
      offNights: games.filter((game) => game.isOffNight).length,
      usableStarts: games.filter((game) => usable.has(game.date)).length,
    };
  });
}

function scoreCandidate(
  player: DraftPlayer,
  directory: DraftPlayer[],
  roster: RosterPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
  outlooks: Map<string, NextSeasonProjection>,
  positionValues: Map<string, PositionValuation>,
  baselines?: DraftScoringBaselines,
): DraftCandidateScore {
  const peerPool = directory.filter((candidate) => candidate.blendedFppg !== null);
  const outlook = outlooks.get(normalizeId(player.id)) ?? buildNextSeasonProjectionMap([player], workspace.season.start).get(normalizeId(player.id))!;
  const regularEnd = previousDate(workspace.schedule.playoffs.start) < workspace.season.start
    ? workspace.season.end
    : previousDate(workspace.schedule.playoffs.start);
  const regular = scheduleComponent(player, roster, directory, outlooks, workspace, schedule, workspace.season.start, regularEnd, baselines?.regular);
  const playoffs = scheduleComponent(player, roster, directory, outlooks, workspace, schedule, workspace.schedule.playoffs.start, workspace.schedule.playoffs.end, baselines?.playoffs);
  const opportunities = buildFantasySeasonOpportunity(schedule, workspace);
  const fantasySeasonGames = regular.games + playoffs.games;
  const fantasySeasonUsableStarts = regular.usableStarts + playoffs.usableStarts;
  const fantasySeasonAddedStarts = regular.addedStarts + playoffs.addedStarts;
  const projectedFantasyPoints = outlook.projectedFppg * fantasySeasonUsableStarts;
  const marginalProjectedPoints = regular.addedPoints + playoffs.addedPoints;
  const peerProjectedPoints = peerPool.map((candidate) => {
    const projection = outlooks.get(normalizeId(candidate.id));
    const candidateFppg = projection?.projectedFppg ?? candidate.blendedFppg ?? 0;
    const relevantGames = opportunities[candidate.team]?.fantasyRelevantGames ?? 0;
    return candidateFppg * Math.round(relevantGames * goalieWorkloadRate(candidate, projection));
  });
  const production = rangeScore(peerProjectedPoints, projectedFantasyPoints);
  const postFantasyGames = Math.round((opportunities[player.team]?.afterFantasySeason ?? 0) * goalieWorkloadRate(player, outlook));
  const playoffWeeks = buildPlayoffWeekScores(player, outlook, workspace, schedule, playoffs.usableDates);
  const championshipWeek = playoffWeeks[playoffWeeks.length - 1] ?? {
    index: 1,
    label: 'Championship',
    start: workspace.schedule.playoffs.start,
    end: workspace.schedule.playoffs.end,
    games: 0,
    offNights: 0,
    usableStarts: 0,
    isChampionship: true,
  };
  const valuation = positionValues.get(normalizeId(player.id)) ?? emptyPositionValuation();
  const valueOverReplacement = valuation.valueOverReplacement;
  const positionValue = valuation.positionValue;
  const components = { production, regularSeason: regular.score, playoffs: playoffs.score, positionValue };
  const weights = workspace.draftStrategy.weights;
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 100;
  const contributions = Object.fromEntries((Object.keys(components) as DraftScoreKey[]).map((key) => [key, (components[key] * weights[key]) / weightTotal])) as Record<DraftScoreKey, number>;
  const manualAdjustment = workspace.draftSession.rankAdjustments[normalizeId(player.id)] ?? 0;
  const total = Object.values(contributions).reduce((sum, contribution) => sum + contribution, 0) + manualAdjustment;
  return {
    playerId: player.id,
    total: Number(total.toFixed(1)),
    components: Object.fromEntries((Object.keys(components) as DraftScoreKey[]).map((key) => [key, Number(components[key].toFixed(1))])) as Record<DraftScoreKey, number>,
    contributions,
    metrics: {
      fppg: player.blendedFppg ?? 0,
      projectedFppg: outlook.projectedFppg,
      projectionDeltaPercent: outlook.deltaPercent,
      projectionTrajectory: outlook.trajectory,
      projectionConfidence: outlook.confidence,
      projectionVolatility: outlook.volatility,
      projectionReasons: outlook.reasons,
      projectedGames: outlook.projectedGames,
      sampleGames: sampleGames(player),
      productionReliability: outlook.reliability,
      regularGames: regular.games,
      regularOffNights: regular.offNights,
      regularUsableStarts: regular.usableStarts,
      regularAddedStarts: regular.addedStarts,
      regularBlockedStarts: Math.max(0, regular.games - regular.usableStarts),
      playoffGames: playoffs.games,
      playoffOffNights: playoffs.offNights,
      playoffUsableStarts: playoffs.usableStarts,
      playoffAddedStarts: playoffs.addedStarts,
      playoffBlockedStarts: Math.max(0, playoffs.games - playoffs.usableStarts),
      fantasySeasonGames,
      fantasySeasonUsableStarts,
      fantasySeasonAddedStarts,
      projectedFantasyPoints: Number(projectedFantasyPoints.toFixed(1)),
      marginalProjectedPoints: Number(marginalProjectedPoints.toFixed(1)),
      postFantasyGames,
      playoffWeeks,
      championshipWeek,
      valueOverReplacement: Number(valueOverReplacement.toFixed(2)),
      replacementFppg: Number(valuation.replacementFppg.toFixed(2)),
      replacementPosition: valuation.replacementPosition,
      marketPosition: valuation.marketPosition,
      marketScarcity: Number(valuation.marketScarcity.toFixed(1)),
      flexibilityBonus: Number(valuation.flexibilityBonus.toFixed(1)),
      manualAdjustment,
    },
  };
}

function buildDraftScoringBaselines(
  roster: RosterPlayer[],
  directory: DraftPlayer[],
  outlooks: Map<string, NextSeasonProjection>,
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
): DraftScoringBaselines | undefined {
  if (roster.length === 0) return undefined;
  const regularEnd = previousDate(workspace.schedule.playoffs.start) < workspace.season.start
    ? workspace.season.end
    : previousDate(workspace.schedule.playoffs.start);
  const build = (start: string, end: string): LineupBaseline => {
    const projections = buildWindowProjections(roster, directory, outlooks, schedule, start, end);
    const result = simulateDailyLineup(workspace, roster, projections);
    return { starts: result.starts, points: result.points };
  };
  return {
    regular: build(workspace.season.start, regularEnd),
    playoffs: build(workspace.schedule.playoffs.start, workspace.schedule.playoffs.end),
  };
}

function strategyLabel(presetId: DraftStrategyPresetId): string {
  return presetId === 'custom' ? 'Custom strategy' : DRAFT_STRATEGY_PRESETS[presetId].label;
}

export function compareDraftCandidates(
  playerA: DraftPlayer,
  playerB: DraftPlayer,
  directory: DraftPlayer[],
  roster: RosterPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
): DraftStrategyComparison {
  const outlooks = workspaceProjectionMap(directory, workspace);
  const positionValues = buildPositionValuations(directory, workspace, outlooks);
  const baselines = buildDraftScoringBaselines(roster, directory, outlooks, workspace, schedule);
  const optionA = scoreCandidate(playerA, directory, roster, workspace, schedule, outlooks, positionValues, baselines);
  const optionB = scoreCandidate(playerB, directory, roster, workspace, schedule, outlooks, positionValues, baselines);
  const difference = optionA.total - optionB.total;
  const winner = Math.abs(difference) < 0.1 ? null : difference > 0 ? optionA : optionB;
  const winnerPlayer = winner === optionA ? playerA : playerB;
  const loserPlayer = winner === optionA ? playerB : playerA;
  const label = strategyLabel(workspace.draftStrategy.presetId);
  if (!winner) return {
    strategyLabel: label,
    winnerId: null,
    verdict: `${playerA.name} and ${playerB.name} are tied for ${label}`,
    explanation: 'Their weighted production, schedule, and positional value are effectively equal.',
    optionA,
    optionB,
  };

  const loser = winner === optionA ? optionB : optionA;
  const componentEdges = (Object.keys(winner.components) as DraftScoreKey[])
    .map((key) => ({ key, edge: winner.components[key] - loser.components[key] }))
    .sort((a, b) => b.edge - a.edge);
  const strengths = componentEdges.filter((item) => item.edge > 2).slice(0, 2).map((item) => COMPONENT_LABELS[item.key]);
  const tradeoff = [...componentEdges].reverse().find((item) => item.edge < -2);
  const explanation = `${winnerPlayer.name} leads by ${Math.abs(difference).toFixed(1)} strategy points${strengths.length ? ` on ${strengths.join(' and ')}` : ''}.`
    + (tradeoff ? ` ${loserPlayer.name} still has the stronger ${COMPONENT_LABELS[tradeoff.key]}.` : '');
  return {
    strategyLabel: label,
    winnerId: winnerPlayer.id,
    verdict: `Draft ${winnerPlayer.name} over ${loserPlayer.name}`,
    explanation,
    optionA,
    optionB,
  };
}

export function rankDraftCandidates(
  candidates: DraftPlayer[],
  directory: DraftPlayer[],
  roster: RosterPlayer[],
  workspace: LeagueWorkspace,
  schedule: SeasonScheduleData,
): RankedDraftCandidate[] {
  const outlooks = workspaceProjectionMap(directory, workspace);
  const positionValues = buildPositionValuations(directory, workspace, outlooks);
  const baselines = buildDraftScoringBaselines(roster, directory, outlooks, workspace, schedule);
  return candidates
    .map((player) => ({ player, score: scoreCandidate(player, directory, roster, workspace, schedule, outlooks, positionValues, baselines) }))
    .sort((a, b) => b.score.total - a.score.total || (b.player.blendedFppg ?? 0) - (a.player.blendedFppg ?? 0) || a.player.name.localeCompare(b.player.name));
}
