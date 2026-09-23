import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { simulateDailyLineup } from './acquisitionAnalysis';
import { acquisitionMovesRemaining, type LeagueWorkspace } from './leagueWorkspace';

export const ACQUISITION_CALCULATION_VERSION = 'acquisition-scenario-v1' as const;

export type AcquisitionLane = 'fill-roster' | 'this-week' | 'add-and-hold' | 'streaming';
export type ScenarioOutcome = 'recommend' | 'conditional' | 'below-threshold' | 'no-positive-improvement';
export type ParticipationStatus = 'supported' | 'uncertain' | 'unsupported';
export type DropProtectionStatus = 'not-needed' | 'passed' | 'warning' | 'unavailable';

export interface ParticipationEvidence {
  source?: string;
  expectedGames?: number;
  marketRank?: number;
  confirmedRole?: boolean;
}

export interface AcquisitionScenarioOptions {
  lane?: AcquisitionLane;
  analysisStart?: string;
  analysisEnd?: string;
  calculatedAt?: string;
  projectionSource?: string;
  availabilityStatus?: 'available' | 'taken' | 'unknown';
  availabilityEvidence?: string;
  availabilityObservedAt?: string;
  availabilityExpiresAt?: string;
  discoverySource?: 'confirmed' | 'automatic' | 'user-selected' | 'schedule-fit';
  transactionType?: 'free-agent' | 'waiver' | 'unknown';
  selectedDropId?: string;
  productionBasis?: 'upcoming-projection' | 'last-season' | 'mixed' | 'unknown';
  participation?: ParticipationEvidence;
  maxDropCandidates?: number;
}

export interface AcquisitionScenario {
  id: string;
  calculationFingerprint: string;
  calculationVersion: typeof ACQUISITION_CALCULATION_VERSION;
  leagueId: string;
  rosterFingerprint: string;
  lane: AcquisitionLane;
  analysis: { start: string; end: string; calculatedAt: string; projectionSource: string };
  addition: RosterPlayer;
  drop: RosterPlayer | null;
  baseline: { projectedPoints: number; usableStarts: number };
  result: { projectedPoints: number; usableStarts: number };
  impact: {
    projectedPointsDelta: number;
    usableStartsDelta: number;
    candidateGames: number;
    candidateStarts: number;
    candidateStartDates: string[];
    candidateBlockedDates: string[];
    dropStarts: number;
    dropCost: number;
  };
  transaction: {
    legal: boolean;
    effectiveDate: string;
    movesRequired: number;
    assumptions: string[];
  };
  availability: {
    status: 'available' | 'taken' | 'unknown';
    evidence: string;
    observedAt?: string;
    expiresAt?: string;
    freshness: 'current' | 'stale' | 'unknown';
  };
  participation: { status: ParticipationStatus; reason: string };
  dropProtection: { status: DropProtectionStatus; reason: string };
  materiality: { threshold: number; outcome: ScenarioOutcome; reason: string };
}

export interface AcquisitionScenarioEvaluation {
  status: 'ready' | 'missing-inputs' | 'no-legal-move';
  baseline: { projectedPoints: number; usableStarts: number };
  scenarios: AcquisitionScenario[];
  issues: string[];
}

const INACTIVE_SLOTS = new Set(['IR', 'IR+', 'IR-LT', 'NA']);

function normalizeId(id: string): string {
  return id.replace(/^nhl:/, '');
}

function projectionFor(projections: Record<string, PlayerProjection>, playerId: string): PlayerProjection | undefined {
  const id = normalizeId(playerId);
  return projections[playerId] ?? projections[id] ?? projections[`nhl:${id}`];
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  const input = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function regularRosterCapacity(workspace: LeagueWorkspace): number {
  return Object.entries(workspace.rosterRules.slots)
    .filter(([slot]) => !INACTIVE_SLOTS.has(slot.toUpperCase()))
    .reduce((total, [, count]) => total + Math.max(0, count), 0);
}

function regularRosterCount(workspace: LeagueWorkspace, roster: RosterPlayer[]): number {
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  return roster.filter((player) => {
    const slot = (entryById.get(normalizeId(player.id))?.slot ?? player.current_slot ?? 'BN').toUpperCase();
    return !INACTIVE_SLOTS.has(slot);
  }).length;
}

function droppablePlayers(workspace: LeagueWorkspace, roster: RosterPlayer[]): RosterPlayer[] {
  const entryById = new Map(workspace.roster.map((entry) => [normalizeId(entry.playerId), entry]));
  return roster.filter((player) => {
    const entry = entryById.get(normalizeId(player.id));
    const slot = (entry?.slot ?? player.current_slot ?? '').toUpperCase();
    return !entry?.keeper && !entry?.protected && !entry?.undroppable && !INACTIVE_SLOTS.has(slot);
  });
}

function windowDates(projections: Record<string, PlayerProjection>): string[] {
  return [...new Set(Object.values(projections).flatMap((projection) => Object.keys(projection.gamesByDate ?? {})))].sort();
}

function projectionAfterDate(projection: PlayerProjection, effectiveDate: string): PlayerProjection {
  const gamesByDate = Object.fromEntries(Object.entries(projection.gamesByDate ?? {}).filter(([date]) => date >= effectiveDate));
  const startsByDate = projection.startsByDate
    ? Object.fromEntries(Object.entries(projection.startsByDate).filter(([date]) => date >= effectiveDate))
    : undefined;
  const gamesAvailable = Object.keys(gamesByDate).length;
  return {
    ...projection,
    gamesByDate,
    startsByDate,
    gamesAvailable,
    starts: startsByDate ? Object.values(startsByDate).reduce((sum, starts) => sum + starts, 0) : gamesAvailable,
    projectedPoints: projection.fppg * gamesAvailable,
  };
}

function participationAssessment(
  candidate: RosterPlayer,
  candidateGames: number,
  options: AcquisitionScenarioOptions,
): { status: ParticipationStatus; reason: string } {
  if (candidateGames === 0) return { status: 'unsupported', reason: 'No eligible games remain after transaction timing is applied.' };
  if (candidate.positions.includes('G') && !options.participation?.confirmedRole) {
    return { status: 'uncertain', reason: 'Goalie team games are known, but future goalie participation is not confirmed.' };
  }
  const hasParticipationEvidence = Boolean(
    options.participation?.confirmedRole
    || (options.participation?.expectedGames ?? 0) > 0
    || (options.participation?.marketRank ?? 0) > 0,
  );
  if ((candidate.games_played ?? 0) === 0 && options.discoverySource === 'automatic' && !hasParticipationEvidence) {
    return { status: 'unsupported', reason: 'Automatic target has no NHL sample or documented participation evidence.' };
  }
  if ((candidate.games_played ?? 0) === 0 && !hasParticipationEvidence) {
    return { status: 'uncertain', reason: 'Participation evidence is missing for a player without an NHL sample.' };
  }
  return { status: 'supported', reason: options.participation?.source ?? 'Projection and schedule include usable participation evidence.' };
}

function medianPositive(values: number[]): number {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function materialityThreshold(roster: RosterPlayer[], projections: Record<string, PlayerProjection>, movesRequired: number): number {
  const medianFppg = medianPositive(roster.map((player) => projectionFor(projections, player.id)?.fppg ?? 0));
  return Number((Math.max(0.5, medianFppg * 0.25) * Math.max(1, movesRequired)).toFixed(2));
}

function dropProtectionAssessment(
  candidateProjection: PlayerProjection,
  dropProjection: PlayerProjection | undefined,
  drop: RosterPlayer | null,
  options: AcquisitionScenarioOptions,
): { status: DropProtectionStatus; reason: string } {
  if (!drop) return { status: 'not-needed', reason: 'The roster has legal capacity, so no player needs to be dropped.' };
  if (!dropProjection || options.productionBasis !== 'upcoming-projection') {
    return { status: 'unavailable', reason: 'Comparable forward-looking evidence is unavailable for the longer-term drop check.' };
  }
  if (dropProjection.fppg > candidateProjection.fppg * 1.1) {
    return { status: 'warning', reason: `${drop.full_name} has a meaningfully stronger forward projected scoring rate.` };
  }
  return { status: 'passed', reason: 'The proposed drop does not have a meaningfully stronger forward projected scoring rate.' };
}

function scenarioOutcome(
  delta: number,
  threshold: number,
  transactionAssumptions: string[],
  participation: ParticipationStatus,
  dropProtection: DropProtectionStatus,
  availabilityStatus: 'available' | 'taken' | 'unknown',
  availabilityFreshness: 'current' | 'stale' | 'unknown',
): { outcome: ScenarioOutcome; reason: string } {
  if (delta <= 0) return { outcome: 'no-positive-improvement', reason: 'The evaluated roster does not improve on the no-move baseline.' };
  if (participation === 'unsupported') return { outcome: 'conditional', reason: 'The apparent gain depends on unsupported participation.' };
  if (availabilityStatus !== 'available' || availabilityFreshness !== 'current') {
    return { outcome: 'conditional', reason: 'The gain is conditional until current availability is confirmed.' };
  }
  if (participation === 'uncertain' || dropProtection === 'warning' || dropProtection === 'unavailable' || transactionAssumptions.length > 0) {
    return { outcome: 'conditional', reason: 'The gain is positive, but at least one material assumption still needs review.' };
  }
  if (delta < threshold) return { outcome: 'below-threshold', reason: `The ${delta.toFixed(1)}-point gain is below the ${threshold.toFixed(1)}-point recommendation threshold.` };
  return { outcome: 'recommend', reason: 'The legal move clears the documented materiality threshold and the no-move baseline.' };
}

// Every candidate is compared against the same no-move lineup; solve it once per
// workspace, roster and projection set rather than once per candidate.
const baselineCache = new WeakMap<object, WeakMap<object, WeakMap<object, ReturnType<typeof simulateDailyLineup>>>>();
function cachedBaseline(workspace: LeagueWorkspace, roster: RosterPlayer[], projections: Record<string, PlayerProjection>) {
  let byRoster = baselineCache.get(projections);
  if (!byRoster) baselineCache.set(projections, byRoster = new WeakMap());
  let byWorkspace = byRoster.get(roster);
  if (!byWorkspace) byRoster.set(roster, byWorkspace = new WeakMap());
  let result = byWorkspace.get(workspace);
  if (!result) byWorkspace.set(workspace, result = simulateDailyLineup(workspace, roster, projections));
  return result;
}

export function evaluateAcquisitionScenarios(
  workspace: LeagueWorkspace,
  roster: RosterPlayer[],
  candidate: RosterPlayer,
  projections: Record<string, PlayerProjection>,
  options: AcquisitionScenarioOptions = {},
): AcquisitionScenarioEvaluation {
  const dates = windowDates(projections);
  const analysisStart = options.analysisStart ?? dates[0] ?? workspace.season.start;
  const analysisEnd = options.analysisEnd ?? dates[dates.length - 1] ?? workspace.season.end;
  const baselineResult = cachedBaseline(workspace, roster, projections);
  const baseline = { projectedPoints: baselineResult.points, usableStarts: baselineResult.starts };
  const issues: string[] = [];
  const candidateProjection = projectionFor(projections, candidate.id);
  if (!candidateProjection?.gamesByDate) {
    return { status: 'missing-inputs', baseline, scenarios: [], issues: ['Candidate schedule projection is unavailable.'] };
  }
  if (options.availabilityStatus === 'taken') {
    return { status: 'no-legal-move', baseline, scenarios: [], issues: ['Candidate is marked taken.'] };
  }
  const movesRemaining = acquisitionMovesRemaining(workspace, options.calculatedAt ?? Date.now());
  if (movesRemaining === 0) {
    return { status: 'no-legal-move', baseline, scenarios: [], issues: ['No acquisitions remain in the configured period.'] };
  }

  const transactionAssumptions: string[] = [];
  if (movesRemaining === null) transactionAssumptions.push('No acquisition limit is configured.');
  let delayDays = workspace.acquisitions.addTiming === 'next-day' ? 1 : 0;
  if (options.transactionType === 'waiver') delayDays += workspace.acquisitions.waiverDelayDays;
  // An unknown pickup follows the league's pickup method: in free-agent leagues only
  // recently dropped players wait out waivers; in waiver leagues every add does.
  if ((options.transactionType ?? 'unknown') === 'unknown' && workspace.acquisitions.waiverDelayDays > 0) {
    const days = `${workspace.acquisitions.waiverDelayDays} day${workspace.acquisitions.waiverDelayDays === 1 ? '' : 's'}`;
    if (workspace.acquisitions.pickupMethod === 'waivers') {
      delayDays += workspace.acquisitions.waiverDelayDays;
      transactionAssumptions.push(`Every add is a waiver claim in this league (${days}).`);
    } else {
      transactionAssumptions.push(`Treated as a free agent; a player on waivers becomes usable ${days} later.`);
    }
  }
  const effectiveDate = addDays(analysisStart, delayDays);
  if (effectiveDate > analysisEnd) {
    return { status: 'no-legal-move', baseline, scenarios: [], issues: ['The transaction cannot become effective inside the analysis window.'] };
  }

  const hasOpenCapacity = regularRosterCount(workspace, roster) < regularRosterCapacity(workspace);
  let possibleDrops: Array<RosterPlayer | null> = hasOpenCapacity ? [null] : droppablePlayers(workspace, roster);
  if (options.selectedDropId) {
    possibleDrops = [...possibleDrops].sort((left, right) => {
      const selected = normalizeId(options.selectedDropId!);
      return Number(normalizeId(right?.id ?? '') === selected) - Number(normalizeId(left?.id ?? '') === selected);
    });
  }
  if (options.maxDropCandidates && possibleDrops.length > options.maxDropCandidates) {
    const selected = options.selectedDropId ? normalizeId(options.selectedDropId) : null;
    possibleDrops = [...possibleDrops]
      .sort((left, right) => {
        const leftSelected = selected !== null && normalizeId(left?.id ?? '') === selected;
        const rightSelected = selected !== null && normalizeId(right?.id ?? '') === selected;
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
        const leftRate = left ? projectionFor(projections, left.id)?.fppg ?? Number.POSITIVE_INFINITY : -1;
        const rightRate = right ? projectionFor(projections, right.id)?.fppg ?? Number.POSITIVE_INFINITY : -1;
        return leftRate - rightRate || (left?.full_name ?? '').localeCompare(right?.full_name ?? '');
      })
      .slice(0, options.maxDropCandidates);
  }
  if (possibleDrops.length === 0) {
    return { status: 'no-legal-move', baseline, scenarios: [], issues: ['The roster is full and has no legal drop candidate.'] };
  }

  const timedCandidateProjection = projectionAfterDate(candidateProjection, effectiveDate);
  const timedProjections = { ...projections, [candidate.id]: timedCandidateProjection, [normalizeId(candidate.id)]: timedCandidateProjection };
  const calculatedAt = options.calculatedAt ?? new Date().toISOString();
  const availabilityFreshness = options.availabilityExpiresAt
    ? (new Date(options.availabilityExpiresAt).getTime() > new Date(calculatedAt).getTime() ? 'current' as const : 'stale' as const)
    : 'unknown' as const;
  const rosterFingerprint = fingerprint(workspace.roster.map((entry) => ({
    id: normalizeId(entry.playerId),
    slot: entry.slot,
    keeper: entry.keeper,
    protected: entry.protected,
    undroppable: entry.undroppable,
  })));
  const scenarios = possibleDrops.map((drop): AcquisitionScenario => {
    const resultRoster = drop
      ? [...roster.filter((player) => normalizeId(player.id) !== normalizeId(drop.id)), candidate]
      : [...roster, candidate];
    const result = simulateDailyLineup(workspace, resultRoster, timedProjections);
    const candidateStartDates = result.startDatesByPlayer[normalizeId(candidate.id)] ?? [];
    const dropStartDates = drop ? baselineResult.startDatesByPlayer[normalizeId(drop.id)] ?? [] : [];
    const dropProjection = drop ? projectionFor(projections, drop.id) : undefined;
    const candidateGames = Object.keys(timedCandidateProjection.gamesByDate ?? {}).sort();
    const candidateStartSet = new Set(candidateStartDates);
    const participation = participationAssessment(candidate, candidateGames.length, options);
    const dropProtection = dropProtectionAssessment(candidateProjection, dropProjection, drop, options);
    const threshold = materialityThreshold(roster, projections, 1);
    const delta = result.points - baseline.projectedPoints;
    const materiality = scenarioOutcome(
      delta,
      threshold,
      transactionAssumptions,
      participation.status,
      dropProtection.status,
      options.availabilityStatus ?? 'unknown',
      availabilityFreshness,
    );
    const stableIdentity = {
      leagueId: workspace.id,
      lane: options.lane ?? (hasOpenCapacity ? 'fill-roster' : 'this-week'),
      addition: normalizeId(candidate.id),
      drop: drop ? normalizeId(drop.id) : null,
      analysisStart,
      analysisEnd,
    };
    const calculationInputs = {
      ...stableIdentity,
      calculationVersion: ACQUISITION_CALCULATION_VERSION,
      roster: workspace.roster.map((entry) => ({ id: normalizeId(entry.playerId), slot: entry.slot, keeper: entry.keeper, protected: entry.protected, undroppable: entry.undroppable })),
      rules: { roster: workspace.rosterRules, acquisitions: workspace.acquisitions },
      availability: {
        status: options.availabilityStatus ?? 'unknown',
        evidence: options.availabilityEvidence ?? 'none',
        observedAt: options.availabilityObservedAt,
        expiresAt: options.availabilityExpiresAt,
      },
      projectionSource: options.projectionSource ?? 'unknown',
      projections: Object.fromEntries([candidate, ...(drop ? [drop] : [])].map((player) => {
        const projection = projectionFor(projections, player.id);
        return [normalizeId(player.id), projection ? { fppg: projection.fppg, dates: Object.keys(projection.gamesByDate ?? {}).sort() } : null];
      })),
    };
    return {
      id: `acq-${fingerprint(stableIdentity)}`,
      calculationFingerprint: fingerprint(calculationInputs),
      calculationVersion: ACQUISITION_CALCULATION_VERSION,
      leagueId: workspace.id,
      rosterFingerprint,
      lane: stableIdentity.lane,
      analysis: {
        start: analysisStart,
        end: analysisEnd,
        calculatedAt,
        projectionSource: options.projectionSource ?? 'unknown',
      },
      addition: candidate,
      drop,
      baseline,
      result: { projectedPoints: result.points, usableStarts: result.starts },
      impact: {
        projectedPointsDelta: delta,
        usableStartsDelta: result.starts - baseline.usableStarts,
        candidateGames: candidateGames.length,
        candidateStarts: candidateStartDates.length,
        candidateStartDates,
        candidateBlockedDates: candidateGames.filter((date) => !candidateStartSet.has(date)),
        dropStarts: dropStartDates.length,
        dropCost: dropStartDates.length * (dropProjection?.fppg ?? 0),
      },
      transaction: { legal: true, effectiveDate, movesRequired: 1, assumptions: transactionAssumptions },
      availability: {
        status: options.availabilityStatus ?? 'unknown',
        evidence: options.availabilityEvidence ?? 'none',
        observedAt: options.availabilityObservedAt,
        expiresAt: options.availabilityExpiresAt,
        freshness: availabilityFreshness,
      },
      participation,
      dropProtection,
      materiality: { threshold, ...materiality },
    };
  }).sort((left, right) => {
    if (options.selectedDropId) {
      const selected = normalizeId(options.selectedDropId);
      const leftSelected = normalizeId(left.drop?.id ?? '') === selected;
      const rightSelected = normalizeId(right.drop?.id ?? '') === selected;
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    }
    return right.impact.projectedPointsDelta - left.impact.projectedPointsDelta
      || right.impact.usableStartsDelta - left.impact.usableStartsDelta
      || (left.drop?.full_name ?? '').localeCompare(right.drop?.full_name ?? '');
  });

  return { status: 'ready', baseline, scenarios, issues };
}
