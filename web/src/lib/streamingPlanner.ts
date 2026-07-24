import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { simulateDailyLineup } from './acquisitionAnalysis';
import type { LeagueCandidate, LeagueWorkspace } from './leagueWorkspace';

const INACTIVE_SLOTS = new Set(['IR', 'IR+', 'IR-LT', 'NA']);

export interface StreamingPlannerMove {
  add: RosterPlayer;
  drop: RosterPlayer;
  actionDate: string;
  effectiveDate: string;
  pointsDeltaAtStep: number;
  startsDeltaAtStep: number;
  availability: LeagueCandidate['availability'] | 'unknown';
  observedAt?: string;
}

export interface StreamingPlannerDay {
  date: string;
  baselinePoints: number;
  plannedPoints: number;
  pointsDelta: number;
  baselineStarts: number;
  plannedStarts: number;
  startsDelta: number;
  moves: StreamingPlannerMove[];
}

export interface StreamingPlan {
  moveCount: number;
  moves: StreamingPlannerMove[];
  projectedPoints: number;
  projectedStarts: number;
  pointsDelta: number;
  startsDelta: number;
  remainingMoves: number | null;
  daily: StreamingPlannerDay[];
}

export interface StreamingPlannerResult {
  window: { start: string; end: string };
  baseline: StreamingPlan;
  plansByMoveCount: Record<number, StreamingPlan[]>;
  maxMoves: number;
  configuredMoveLimit: boolean;
  assumptions: string[];
}

interface TimelineResult {
  points: number;
  starts: number;
  daily: Array<{ date: string; points: number; starts: number }>;
}

interface SearchState {
  roster: RosterPlayer[];
  moves: StreamingPlannerMove[];
  usedCandidateIds: Set<string>;
  result: TimelineResult;
}

function projectedPointsInWindow(projection: PlayerProjection | undefined, start: string, end: string): number {
  if (!projection) return 0;
  return Object.keys(projection.gamesByDate ?? {})
    .filter((date) => date >= start && date <= end)
    .reduce((total, date) => total + projection.fppg * (projection.startsByDate?.[date] ?? 1), 0);
}

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function addUtcDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addUtcDays(date, 1)) dates.push(date);
  return dates;
}

function projectionFor(projections: Record<string, PlayerProjection>, playerId: string): PlayerProjection | undefined {
  const id = normalizeId(playerId);
  return projections[playerId] ?? projections[id] ?? projections[`nhl:${id}`];
}

function rosterAfterMoves(initialRoster: RosterPlayer[], moves: StreamingPlannerMove[], date: string): RosterPlayer[] {
  return moves
    .filter((move) => move.effectiveDate <= date)
    .reduce((current, move) => [
      ...current.filter((player) => normalizeId(player.id) !== normalizeId(move.drop.id)),
      move.add,
    ], initialRoster);
}

function simulateTimeline(
  workspace: LeagueWorkspace,
  initialRoster: RosterPlayer[],
  moves: StreamingPlannerMove[],
  projections: Record<string, PlayerProjection>,
  dates: string[],
): TimelineResult {
  const daily = dates.map((date) => {
    const result = simulateDailyLineup(workspace, rosterAfterMoves(initialRoster, moves, date), projections, [date]);
    return { date, points: result.points, starts: result.starts };
  });
  return {
    points: daily.reduce((sum, day) => sum + day.points, 0),
    starts: daily.reduce((sum, day) => sum + day.starts, 0),
    daily,
  };
}

function isDroppable(workspace: LeagueWorkspace, player: RosterPlayer): boolean {
  const entry = workspace.roster.find((item) => normalizeId(item.playerId) === normalizeId(player.id));
  if (!entry) return true;
  const slot = (entry.slot ?? player.current_slot ?? '').toUpperCase();
  return !entry.keeper && !entry.protected && !entry.undroppable && !INACTIVE_SLOTS.has(slot);
}

function toPlan(
  state: SearchState,
  baseline: TimelineResult,
  dates: string[],
  configuredRemaining: number | null,
): StreamingPlan {
  return {
    moveCount: state.moves.length,
    moves: state.moves,
    projectedPoints: state.result.points,
    projectedStarts: state.result.starts,
    pointsDelta: state.result.points - baseline.points,
    startsDelta: state.result.starts - baseline.starts,
    remainingMoves: configuredRemaining === null ? null : Math.max(0, configuredRemaining - state.moves.length),
    daily: dates.map((date, index) => ({
      date,
      baselinePoints: baseline.daily[index]?.points ?? 0,
      plannedPoints: state.result.daily[index]?.points ?? 0,
      pointsDelta: (state.result.daily[index]?.points ?? 0) - (baseline.daily[index]?.points ?? 0),
      baselineStarts: baseline.daily[index]?.starts ?? 0,
      plannedStarts: state.result.daily[index]?.starts ?? 0,
      startsDelta: (state.result.daily[index]?.starts ?? 0) - (baseline.daily[index]?.starts ?? 0),
      moves: state.moves.filter((move) => move.effectiveDate === date),
    })),
  };
}

export function planStreamingMoves(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  candidates: RosterPlayer[],
  projections: Record<string, PlayerProjection>,
  window: { start: string; end: string },
  options: { maxMoves?: number; beamWidth?: number; alternativesPerMoveCount?: number } = {},
): StreamingPlannerResult {
  const dates = enumerateDates(window.start, window.end);
  const configuredMoveLimit = workspace.acquisitions.limit !== null && workspace.acquisitions.movesUsed !== null;
  const configuredRemaining = configuredMoveLimit
    ? Math.max(0, (workspace.acquisitions.limit as number) - (workspace.acquisitions.movesUsed as number))
    : null;
  const requestedMaxMoves = Math.min(3, Math.max(0, options.maxMoves ?? 3));
  const maxMoves = Math.min(requestedMaxMoves, configuredRemaining ?? requestedMaxMoves);
  const beamWidth = Math.max(1, options.beamWidth ?? 8);
  const alternativesPerMoveCount = Math.max(1, options.alternativesPerMoveCount ?? 3);
  const transactionDelay = Math.max(
    workspace.acquisitions.addTiming === 'next-day' ? 1 : 0,
    workspace.acquisitions.waiverDelayDays,
  );
  const candidateMeta = new Map(workspace.candidates.map((candidate) => [normalizeId(candidate.playerId), candidate]));
  const initialRosterIds = new Set(roster.map((player) => normalizeId(player.id)));
  const eligibleCandidates = candidates
    .filter((candidate) => !initialRosterIds.has(normalizeId(candidate.id)) && projectionFor(projections, candidate.id)?.gamesByDate)
    .sort((a, b) => projectedPointsInWindow(projectionFor(projections, b.id), window.start, window.end)
      - projectedPointsInWindow(projectionFor(projections, a.id), window.start, window.end)
      || a.full_name.localeCompare(b.full_name))
    .slice(0, 10);

  const baselineResult = simulateTimeline(workspace, roster, [], projections, dates);
  const baselineState: SearchState = { roster, moves: [], usedCandidateIds: new Set(), result: baselineResult };
  const baseline = toPlan(baselineState, baselineResult, dates, configuredRemaining);
  const plansByMoveCount: Record<number, StreamingPlan[]> = { 0: [baseline] };
  let beam: SearchState[] = [baselineState];

  for (let depth = 1; depth <= maxMoves; depth += 1) {
    const nextStates: SearchState[] = [];
    beam.forEach((state) => {
      const lastEffectiveDate = state.moves[state.moves.length - 1]?.effectiveDate ?? window.start;
      const droppable = state.roster
        .filter((player) => isDroppable(workspace, player))
        .sort((a, b) => projectedPointsInWindow(projectionFor(projections, a.id), lastEffectiveDate, window.end)
          - projectedPointsInWindow(projectionFor(projections, b.id), lastEffectiveDate, window.end)
          || a.full_name.localeCompare(b.full_name))
        .slice(0, 6);

      eligibleCandidates.forEach((candidate) => {
        const candidateId = normalizeId(candidate.id);
        if (state.usedCandidateIds.has(candidateId) || state.roster.some((player) => normalizeId(player.id) === candidateId)) return;
        const gameDates = Object.keys(projectionFor(projections, candidate.id)?.gamesByDate ?? {})
          .filter((date) => date >= window.start && date <= window.end);
        const effectiveDates = workspace.rosterRules.lockingMode === 'weekly'
          ? [window.start]
          : [...new Set(gameDates)].sort();

        effectiveDates.forEach((effectiveDate) => {
          if (effectiveDate < lastEffectiveDate) return;
          const actionDate = addUtcDays(effectiveDate, -transactionDelay);
          droppable.forEach((drop) => {
            const dropAddedBy = state.moves.find((move) => normalizeId(move.add.id) === normalizeId(drop.id));
            if (dropAddedBy && dropAddedBy.effectiveDate >= effectiveDate) return;
            const meta = candidateMeta.get(candidateId);
            const partialMove: StreamingPlannerMove = {
              add: candidate,
              drop,
              actionDate,
              effectiveDate,
              pointsDeltaAtStep: 0,
              startsDeltaAtStep: 0,
              availability: meta?.availability ?? 'unknown',
              observedAt: meta?.observedAt,
            };
            const provisionalMoves = [...state.moves, partialMove];
            const result = simulateTimeline(workspace, roster, provisionalMoves, projections, dates);
            const move = {
              ...partialMove,
              pointsDeltaAtStep: result.points - state.result.points,
              startsDeltaAtStep: result.starts - state.result.starts,
            };
            nextStates.push({
              roster: [...state.roster.filter((player) => normalizeId(player.id) !== normalizeId(drop.id)), candidate],
              moves: [...state.moves, move],
              usedCandidateIds: new Set([...state.usedCandidateIds, candidateId]),
              result,
            });
          });
        });
      });
    });

    const deduped = new Map<string, SearchState>();
    nextStates.forEach((state) => {
      const key = state.moves.map((move) => `${normalizeId(move.add.id)}>${normalizeId(move.drop.id)}@${move.effectiveDate}`).join('|');
      const current = deduped.get(key);
      if (!current || state.result.points > current.result.points) deduped.set(key, state);
    });
    beam = [...deduped.values()]
      .sort((a, b) => b.result.points - a.result.points || b.result.starts - a.result.starts)
      .slice(0, beamWidth);
    plansByMoveCount[depth] = beam.slice(0, alternativesPerMoveCount)
      .map((state) => toPlan(state, baselineResult, dates, configuredRemaining));
    if (beam.length === 0) break;
  }

  const assumptions = [
    `${workspace.scoring.label} FPPG uses the current Cracked Ice season-stat snapshot; game dates use the loaded NHL schedule.`,
    `${workspace.rosterRules.lockingMode === 'weekly' ? 'Weekly' : 'Daily'} lineup locking in ${workspace.schedule.timezone}.`,
    transactionDelay === 0 ? 'Confirmed additions are usable the same day.' : `Adds are modeled with a ${transactionDelay}-day processing delay.`,
    configuredMoveLimit ? `${configuredRemaining} acquisition${configuredRemaining === 1 ? '' : 's'} remain in the configured ${workspace.acquisitions.period} limit.` : 'Transaction usage is not configured; results are scenarios capped at three moves.',
    'Future availability is an assumption and must be reconfirmed before each move.',
  ];

  return { window, baseline, plansByMoveCount, maxMoves, configuredMoveLimit, assumptions };
}
