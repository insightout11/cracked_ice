import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace } from './leagueWorkspace';
import { isLeagueCandidateCurrent } from './leagueWorkspace';
import { rankAddDropPairs, simulateDailyLineup } from './acquisitionAnalysis';
import { buildNextSeasonProjectionMap } from './draftProjection';
import { projectionSelectionValue } from './projectionImport';
import { SEASON_GAMES_PER_TEAM } from './season';

export type ComparisonContext = 'draft' | 'pickup' | 'roster';
export type ComparisonAvailability = 'owned' | 'confirmed' | 'stale' | 'unknown';
export type ComparisonProductionMode = 'last-season' | 'projection';

export interface ComparisonScheduleGame {
  date: string;
  opponent: string;
  isHome: boolean;
  isOffNight: boolean;
  usable: boolean;
}

export interface ComparisonOption {
  player: RosterPlayer;
  fppg: number;
  iceScore: number | null;
  games: number;
  usableStarts: number;
  blockedGames: number;
  offNightStarts: number;
  usablePoints: number;
  teamPointsDelta: number;
  drop: RosterPlayer | null;
  availability: ComparisonAvailability;
  transactionEligible: boolean;
  rosterConstraint: 'keeper' | 'protected' | 'undroppable' | null;
  schedule: ComparisonScheduleGame[];
}

export interface PlayerComparisonAnalysis {
  context: ComparisonContext;
  optionA: ComparisonOption;
  optionB: ComparisonOption;
  winnerId: string | null;
  verdict: string;
  explanation: string;
  pointsEdge: number;
  startsEdge: number;
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function projectionFor(projections: Record<string, PlayerProjection>, id: string): PlayerProjection | undefined {
  const normalized = normalizeId(id);
  return projections[id] ?? projections[normalized] ?? projections[`nhl:${normalized}`];
}

/**
 * Reconciles the two projection feeds used by the comparison page.
 *
 * The player directory is the canonical scoring source because it is calculated
 * for every player from the active League Workspace profile. The lineup API can
 * still enrich those records with ICE and opponent context, but a partial API
 * response must not erase the complete season schedule loaded by the client.
 */
export function reconcileComparisonProjections(
  scheduleProjections: Record<string, PlayerProjection>,
  lineupProjections: Record<string, PlayerProjection>,
  directory: Pick<DraftPlayer, 'id' | 'blendedFppg'>[],
): Record<string, PlayerProjection> {
  const scoredFppg = new Map(directory.map((player) => [normalizeId(player.id), player.blendedFppg]));
  const ids = new Set([
    ...Object.keys(scheduleProjections).map(normalizeId),
    ...Object.keys(lineupProjections).map(normalizeId),
  ]);

  return Object.fromEntries([...ids].map((id) => {
    const schedule = projectionFor(scheduleProjections, id);
    const lineup = projectionFor(lineupProjections, id);
    if (!schedule && lineup) {
      const fppg = scoredFppg.get(id) ?? lineup.fppg;
      return [id, { ...lineup, fppg, projectedPoints: fppg * lineup.gamesAvailable }];
    }
    if (!schedule) return [id, lineup as PlayerProjection];

    const fppg = scoredFppg.get(id) ?? schedule.fppg;
    const scheduleGames = schedule.gamesByDate ?? {};
    const lineupGames = lineup?.gamesByDate ?? {};
    const gamesByDate = Object.fromEntries(Object.entries(scheduleGames).map(([date, game]) => [
      date,
      { ...game, ...(lineupGames[date] ?? {}) },
    ]));
    const gamesAvailable = Object.keys(gamesByDate).length;
    const lineupHasCompleteSchedule = Object.keys(lineupGames).length >= gamesAvailable && gamesAvailable > 0;

    return [id, {
      ...schedule,
      ...(lineup ?? {}),
      fppg,
      gamesByDate,
      gamesAvailable,
      projectedPoints: fppg * gamesAvailable,
      starts: lineupHasCompleteSchedule ? (lineup?.starts ?? schedule.starts) : schedule.starts,
      startsByDate: lineupHasCompleteSchedule ? lineup?.startsByDate : schedule.startsByDate,
      offNightRate: schedule.offNightRate,
    }];
  }));
}

export function applyComparisonProductionMode(
  projections: Record<string, PlayerProjection>,
  directory: DraftPlayer[],
  workspace: LeagueWorkspace,
  mode: ComparisonProductionMode,
): Record<string, PlayerProjection> {
  const players = new Map(directory.map((player) => [normalizeId(player.id), player]));
  const nextSeason = mode === 'projection' ? buildNextSeasonProjectionMap(directory, workspace.season.start) : null;

  return Object.fromEntries(Object.entries(projections).map(([rawId, projection]) => {
    const id = normalizeId(rawId);
    const player = players.get(id);
    const actualFppg = player?.blendedFppg ?? projection.fppg;
    const ciProjection = nextSeason?.get(id);
    const selected = mode === 'projection'
      ? projectionSelectionValue(workspace, id, {
        projectedFppg: ciProjection?.projectedFppg ?? actualFppg,
        projectedGames: ciProjection?.projectedGames ?? projection.gamesAvailable,
      })
      : null;
    const fppg = selected?.projectedFppg ?? actualFppg;
    const allGames = Object.entries(projection.gamesByDate ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const expectedWindowGames = selected
      ? Math.max(0, Math.min(allGames.length, Math.round(allGames.length * (selected.projectedGames / SEASON_GAMES_PER_TEAM))))
      : allGames.length;
    const selectedGames = expectedWindowGames === allGames.length
      ? allGames
      : Array.from({ length: expectedWindowGames }, (_, index) => allGames[Math.floor(((index + 0.5) * allGames.length) / expectedWindowGames)]);
    const gamesByDate = Object.fromEntries(selectedGames);
    const selectedDates = new Set(selectedGames.map(([date]) => date));
    const startsByDate = projection.startsByDate
      ? Object.fromEntries(Object.entries(projection.startsByDate).filter(([date]) => selectedDates.has(date)))
      : undefined;
    const starts = selectedGames.length;
    return [id, { ...projection, fppg, gamesByDate, startsByDate, gamesAvailable: starts, starts, projectedPoints: fppg * starts }];
  }));
}

function samePlayer(a: RosterPlayer, b: RosterPlayer): boolean {
  return normalizeId(a.id) === normalizeId(b.id);
}

function rosterEntryFor(workspace: LeagueWorkspace, player: RosterPlayer) {
  return workspace.roster.find((entry) => normalizeId(entry.playerId) === normalizeId(player.id));
}

function availabilityFor(workspace: LeagueWorkspace, player: RosterPlayer, now: number): ComparisonAvailability {
  if (rosterEntryFor(workspace, player)) return 'owned';
  const candidate = workspace.candidates.find((entry) => normalizeId(entry.playerId) === normalizeId(player.id));
  if (!candidate) return 'unknown';
  if (!isLeagueCandidateCurrent(candidate, now)) return 'stale';
  return candidate.availability === 'unknown' ? 'unknown' : 'confirmed';
}

function rosterConstraintFor(workspace: LeagueWorkspace, player: RosterPlayer): ComparisonOption['rosterConstraint'] {
  const entry = rosterEntryFor(workspace, player);
  if (entry?.keeper) return 'keeper';
  if (entry?.protected) return 'protected';
  if (entry?.undroppable) return 'undroppable';
  return null;
}

function buildSchedule(projection: PlayerProjection | undefined, usableDates: string[]): ComparisonScheduleGame[] {
  const usable = new Set(usableDates);
  return Object.entries(projection?.gamesByDate ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([date, game]) => ({
    date,
    opponent: game.opponent,
    isHome: game.isHome,
    isOffNight: game.isOffNight,
    usable: usable.has(date),
  }));
}

function optionFromScenario(
  player: RosterPlayer,
  projection: PlayerProjection | undefined,
  usableDates: string[],
  teamPointsDelta: number,
  drop: RosterPlayer | null,
  availability: ComparisonAvailability,
  transactionEligible: boolean,
  rosterConstraint: ComparisonOption['rosterConstraint'],
): ComparisonOption {
  const schedule = buildSchedule(projection, usableDates);
  const fppg = projection?.fppg ?? player.blendedFppg ?? player.seasonFppg ?? 0;
  const usableStarts = usableDates.length;
  return {
    player,
    fppg,
    iceScore: projection?.iceScore ?? null,
    games: schedule.length,
    usableStarts,
    blockedGames: Math.max(0, schedule.length - usableStarts),
    offNightStarts: schedule.filter((game) => game.usable && game.isOffNight).length,
    usablePoints: fppg * usableStarts,
    teamPointsDelta,
    drop,
    availability,
    transactionEligible,
    rosterConstraint,
    schedule,
  };
}

export function analyzePlayerComparison(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  playerA: RosterPlayer,
  playerB: RosterPlayer,
  projections: Record<string, PlayerProjection>,
  now = Date.now(),
  forcedContext?: ComparisonContext,
): PlayerComparisonAnalysis {
  const rosterIds = new Set(roster.map((player) => normalizeId(player.id)));
  const aOwned = forcedContext === 'draft' ? false : rosterIds.has(normalizeId(playerA.id));
  const bOwned = forcedContext === 'draft' ? false : rosterIds.has(normalizeId(playerB.id));
  const baseline = simulateDailyLineup(workspace, roster, projections);
  const baselineDates = baseline.startDatesByPlayer;
  const availabilityA = availabilityFor(workspace, playerA, now);
  const availabilityB = availabilityFor(workspace, playerB, now);
  const constraintA = rosterConstraintFor(workspace, playerA);
  const constraintB = rosterConstraintFor(workspace, playerB);
  let context: ComparisonContext = 'draft';
  let optionA: ComparisonOption;
  let optionB: ComparisonOption;

  if (aOwned && bOwned) {
    context = 'roster';
    const withoutA = simulateDailyLineup(workspace, roster.filter((player) => !samePlayer(player, playerA)), projections);
    const withoutB = simulateDailyLineup(workspace, roster.filter((player) => !samePlayer(player, playerB)), projections);
    optionA = optionFromScenario(playerA, projectionFor(projections, playerA.id), baselineDates[normalizeId(playerA.id)] ?? [], baseline.points - withoutA.points, null, availabilityA, false, constraintA);
    optionB = optionFromScenario(playerB, projectionFor(projections, playerB.id), baselineDates[normalizeId(playerB.id)] ?? [], baseline.points - withoutB.points, null, availabilityB, false, constraintB);
  } else if (aOwned !== bOwned) {
    context = 'pickup';
    const owned = aOwned ? playerA : playerB;
    const candidate = aOwned ? playerB : playerA;
    const postSwapRoster = [...roster.filter((player) => !samePlayer(player, owned)), candidate];
    const postSwap = simulateDailyLineup(workspace, postSwapRoster, projections);
    const ownedConstraint = rosterConstraintFor(workspace, owned);
    const candidateAvailability = availabilityFor(workspace, candidate, now);
    const canRecommendSwap = candidateAvailability === 'confirmed' && ownedConstraint === null;
    const ownedOption = optionFromScenario(owned, projectionFor(projections, owned.id), baselineDates[normalizeId(owned.id)] ?? [], 0, null, 'owned', false, ownedConstraint);
    const candidateOption = optionFromScenario(candidate, projectionFor(projections, candidate.id), postSwap.startDatesByPlayer[normalizeId(candidate.id)] ?? [], postSwap.points - baseline.points, canRecommendSwap ? owned : null, candidateAvailability, canRecommendSwap, null);
    optionA = aOwned ? ownedOption : candidateOption;
    optionB = bOwned ? ownedOption : candidateOption;
  } else {
    context = forcedContext === 'draft' ? 'draft' : roster.length > 0 && (availabilityA === 'confirmed' || availabilityB === 'confirmed') ? 'pickup' : 'draft';
    const buildCandidateOption = (player: RosterPlayer): ComparisonOption => {
      const playerAvailability = forcedContext === 'draft' ? 'unknown' : availabilityFor(workspace, player, now);
      const mayRecommendTransaction = context === 'pickup' && playerAvailability === 'confirmed';
      const recommendation = roster.length > 0 && mayRecommendTransaction ? rankAddDropPairs(workspace, roster, [player], projections)[0] : undefined;
      const scenarioRoster = recommendation
        ? [...roster.filter((item) => !samePlayer(item, recommendation.drop)), player]
        : [...roster.filter((item) => !samePlayer(item, player)), player];
      const scenario = simulateDailyLineup(workspace, scenarioRoster, projections);
      return optionFromScenario(
        player,
        projectionFor(projections, player.id),
        scenario.startDatesByPlayer[normalizeId(player.id)] ?? [],
        scenario.points - baseline.points,
        recommendation?.drop ?? null,
        playerAvailability,
        Boolean(recommendation),
        null,
      );
    };
    optionA = buildCandidateOption(playerA);
    optionB = buildCandidateOption(playerB);
  }

  const comparisonValue = context === 'pickup' || context === 'draft' ? (option: ComparisonOption) => option.teamPointsDelta : (option: ComparisonOption) => option.usablePoints;
  const valueA = comparisonValue(optionA);
  const valueB = comparisonValue(optionB);
  const difference = valueA - valueB;
  const winner = Math.abs(difference) < 0.05 ? null : difference > 0 ? optionA : optionB;
  const loser = winner === optionA ? optionB : optionA;
  const pointsEdge = Math.abs(difference);
  const startsEdge = winner ? winner.usableStarts - loser.usableStarts : 0;
  let verdict = `${playerA.full_name} and ${playerB.full_name} are effectively tied`;
  if (winner) {
    if (context === 'roster') verdict = `Keep ${winner.player.full_name} over ${loser.player.full_name}`;
    else if (context === 'draft') verdict = `Draft ${winner.player.full_name} over ${loser.player.full_name}`;
    else if (winner.availability === 'owned') verdict = `Keep ${winner.player.full_name}`;
    else if (winner.transactionEligible && winner.drop) verdict = `Add ${winner.player.full_name} and drop ${winner.drop.full_name}`;
    else if (winner.availability === 'confirmed') verdict = `${winner.player.full_name} is the better pickup`;
    else verdict = `${winner.player.full_name} is the better fit if available`;
  }
  let explanation = !winner
    ? 'Their projected usable value is nearly identical in this window.'
    : `${winner.player.full_name} projects for ${pointsEdge.toFixed(1)} more usable fantasy points${startsEdge === 0 ? '' : ` and ${Math.abs(startsEdge)} ${startsEdge > 0 ? 'more' : 'fewer'} usable start${Math.abs(startsEdge) === 1 ? '' : 's'}`} in this context.`;
  if (context === 'pickup' && winner && winner.availability !== 'owned' && winner.availability !== 'confirmed') {
    explanation += ` ${winner.player.full_name}'s league availability is ${winner.availability === 'stale' ? 'stale' : 'not confirmed'}, so this is a what-if comparison, not an add recommendation.`;
  }
  const ownedConstraint = optionA.rosterConstraint ?? optionB.rosterConstraint;
  if (context === 'pickup' && ownedConstraint) {
    explanation += ` The roster player is marked ${ownedConstraint} and is not recommended as a drop.`;
  }

  return { context, optionA, optionB, winnerId: winner?.player.id ?? null, verdict, explanation, pointsEdge, startsEdge };
}
