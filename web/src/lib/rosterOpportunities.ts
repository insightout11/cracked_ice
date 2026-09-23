import type { LeagueProfile, RosterPlayer } from './coachSchemas';
import type { ScheduleData } from './rosterGapsUtils';

const INACTIVE_LINEUP_SLOTS = new Set(['BN', 'BENCH', 'IR', 'IR+', 'IR-LT', 'NA']);
const UNAVAILABLE_ROSTER_SLOTS = new Set(['IR', 'IR+', 'IR-LT', 'NA']);
const FORWARD_POSITIONS = new Set(['C', 'LW', 'RW', 'W', 'F']);

export interface ScheduleRosterPlayer {
  id: string;
  team: string;
  positions: string[];
  currentSlot?: string;
}

export interface ScheduleOpportunityRecommendation {
  team: string;
  teamGames: number;
  addedOpportunities: number;
  blockedGames: number;
  standaloneGames: number;
  opportunityDates: string[];
  blockedDates: string[];
  standaloneDates: string[];
}

export interface ScheduleOpportunityAnalysis {
  unusedSlotsByDate: Record<string, Record<string, number>>;
  leagueGameDates: number;
  totalOpenDates: number;
  totalOpenSlotOpportunities: number;
  unfilledActiveSlots: Record<string, number>;
  unfilledBenchSlots: number;
  recommendations: Record<string, ScheduleOpportunityRecommendation[]>;
}

export type ScheduleFitLabel = 'Best fit' | 'Tied best' | 'Worst fit' | 'Tied worst' | null;

/**
 * Labels only meaningful differences in added lineup capacity. Secondary sort
 * fields keep the table stable, but never manufacture a unique winner or loser.
 */
export function getScheduleFitLabel(
  recommendations: ScheduleOpportunityRecommendation[],
  recommendation: ScheduleOpportunityRecommendation,
): ScheduleFitLabel {
  if (recommendations.length < 2) return null;
  const openingCounts = recommendations.map((item) => item.addedOpportunities);
  const best = Math.max(...openingCounts);
  const worst = Math.min(...openingCounts);
  if (best === worst) return null;
  if (recommendation.addedOpportunities === best) {
    return openingCounts.filter((count) => count === best).length > 1 ? 'Tied best' : 'Best fit';
  }
  if (recommendation.addedOpportunities === worst) {
    return openingCounts.filter((count) => count === worst).length > 1 ? 'Tied worst' : 'Worst fit';
  }
  return null;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'L') return 'LW';
  if (normalized === 'R') return 'RW';
  if (normalized === 'U' || normalized === 'FLEX') return 'UTIL';
  return normalized;
}

function normalizePositions(positions: string[]): string[] {
  return positions.flatMap((position) => position.split(/[/,]/)).map(normalizePosition).filter(Boolean);
}

function canFillSlot(positions: string[], rawSlot: string): boolean {
  const normalized = normalizePositions(positions);
  const slot = normalizePosition(rawSlot);
  const isForward = normalized.some((position) => FORWARD_POSITIONS.has(position));
  const isSkater = normalized.some((position) => position !== 'G');
  if (slot === 'F') return isForward;
  if (slot === 'W') return normalized.some((position) => ['LW', 'RW', 'W'].includes(position));
  if (slot === 'UTIL') return isSkater;
  return normalized.includes(slot);
}

function activeSlotEntries(lineupSlots: Record<string, number>): Array<[string, number]> {
  return Object.entries(lineupSlots)
    .map(([slot, count]) => [normalizePosition(slot), Number(count)] as [string, number])
    .filter(([slot, count]) => count > 0 && Number.isFinite(count) && !INACTIVE_LINEUP_SLOTS.has(slot));
}

interface AssignmentResult {
  filled: number;
  usedBySlot: Record<string, number>;
}

/**
 * Maximum-cardinality lineup assignment. Production and projected participation
 * are intentionally absent: this answers only whether the schedule and legal
 * eligibility create room for another start.
 */
function solveMaximumAssignments(
  players: ScheduleRosterPlayer[],
  lineupSlots: Record<string, number>,
): AssignmentResult {
  const slots = activeSlotEntries(lineupSlots);
  const slotInstances = slots.flatMap(([slot, count]) => Array.from({ length: count }, () => slot));
  const eligible = players
    .map((player) => ({ player, slotIndexes: slots.flatMap(([slot], index) => canFillSlot(player.positions, slot) ? [index] : []) }))
    .filter(({ slotIndexes }) => slotIndexes.length > 0)
    .sort((a, b) => a.slotIndexes.length - b.slotIndexes.length || a.player.id.localeCompare(b.player.id));
  const instanceTypeIndexes = slotInstances.map((slot) => slots.findIndex(([slotType]) => slotType === slot));
  const matchedPlayerByInstance = Array.from({ length: slotInstances.length }, () => -1);
  const playerInstance = Array.from({ length: eligible.length }, () => -1);

  const assign = (playerIndex: number, visited: Set<number>): boolean => {
    const eligibleTypeIndexes = new Set(eligible[playerIndex].slotIndexes);
    for (let instanceIndex = 0; instanceIndex < slotInstances.length; instanceIndex += 1) {
      if (!eligibleTypeIndexes.has(instanceTypeIndexes[instanceIndex]) || visited.has(instanceIndex)) continue;
      visited.add(instanceIndex);
      const occupyingPlayer = matchedPlayerByInstance[instanceIndex];
      if (occupyingPlayer === -1 || assign(occupyingPlayer, visited)) {
        matchedPlayerByInstance[instanceIndex] = playerIndex;
        playerInstance[playerIndex] = instanceIndex;
        return true;
      }
    }
    return false;
  };

  eligible.forEach((_, playerIndex) => assign(playerIndex, new Set()));
  const usedBySlot: Record<string, number> = {};
  playerInstance.forEach((instanceIndex) => {
    if (instanceIndex < 0) return;
    const slot = slotInstances[instanceIndex];
    usedBySlot[slot] = (usedBySlot[slot] ?? 0) + 1;
  });
  return { filled: playerInstance.filter((instanceIndex) => instanceIndex >= 0).length, usedBySlot };
}

function scheduleGames(scheduleData: ScheduleData, team: string, start: string, end: string): string[] {
  return (scheduleData.games[team.toUpperCase()] ?? [])
    .map((game) => game.date)
    .filter((date) => date >= start && date <= end)
    .sort();
}

function candidatePositions(position: string): string[] {
  const normalized = normalizePosition(position);
  // A generic F recommendation measures the dedicated forward slot. Giving
  // the synthetic candidate C/LW/RW eligibility would let it fill a specific
  // position too and overstate its schedule value.
  if (normalized === 'F') return ['F'];
  if (normalized === 'W') return ['LW', 'RW'];
  return [normalized];
}

export function structuralVacancyApplies(position: string, vacancies: Record<string, number>): boolean {
  const normalized = normalizePosition(position);
  if ((vacancies[normalized] ?? 0) > 0) return true;
  if (normalized !== 'G' && (vacancies.UTIL ?? 0) > 0) return true;
  if (['C', 'LW', 'RW', 'F'].includes(normalized) && (vacancies.F ?? 0) > 0) return true;
  if (['LW', 'RW'].includes(normalized) && (vacancies.W ?? 0) > 0) return true;
  return false;
}

function analysisPositions(lineupSlots: Record<string, number>): string[] {
  const slots = new Set(activeSlotEntries(lineupSlots).map(([slot]) => slot));
  const result: string[] = [];
  if (slots.has('C') || slots.has('UTIL')) result.push('C');
  if (slots.has('LW') || slots.has('W') || slots.has('UTIL')) result.push('LW');
  if (slots.has('RW') || slots.has('W') || slots.has('UTIL')) result.push('RW');
  if (slots.has('F')) result.push('F');
  if (slots.has('D') || slots.has('UTIL')) result.push('D');
  if (slots.has('G')) result.push('G');
  return result;
}

function isInactiveRosterPlayer(player: ScheduleRosterPlayer): boolean {
  return player.currentSlot ? UNAVAILABLE_ROSTER_SLOTS.has(normalizePosition(player.currentSlot.split('-')[0])) : false;
}

function rosterVacancies(roster: ScheduleRosterPlayer[], lineupSlots: Record<string, number>) {
  const occupied = new Map<string, number>();
  roster.forEach((player) => {
    if (!player.currentSlot) return;
    const slot = normalizePosition(player.currentSlot.split('-')[0]);
    occupied.set(slot, (occupied.get(slot) ?? 0) + 1);
  });
  const unfilledActiveSlots = Object.fromEntries(activeSlotEntries(lineupSlots)
    .map(([slot, count]) => [slot, Math.max(0, count - (occupied.get(slot) ?? 0))] as const)
    .filter(([, count]) => count > 0));
  const benchSlots = Object.entries(lineupSlots)
    .filter(([slot]) => ['BN', 'BENCH'].includes(normalizePosition(slot)))
    .reduce((sum, [, count]) => sum + Math.max(0, Number(count) || 0), 0);
  const occupiedBenchSlots = (occupied.get('BN') ?? 0) + (occupied.get('BENCH') ?? 0);
  return { unfilledActiveSlots, unfilledBenchSlots: Math.max(0, benchSlots - occupiedBenchSlots) };
}

export function toScheduleRosterPlayers(roster: RosterPlayer[]): ScheduleRosterPlayer[] {
  return roster.map((player) => ({
    id: player.id,
    team: player.team,
    positions: player.positions,
    currentSlot: player.current_slot,
  }));
}

export function calculateScheduleOpportunities({
  roster,
  leagueProfile,
  scheduleData,
  start,
  end,
  excludedPlayerId,
}: {
  roster: ScheduleRosterPlayer[];
  leagueProfile: Pick<LeagueProfile, 'lineup_slots'>;
  scheduleData: ScheduleData;
  start: string;
  end: string;
  excludedPlayerId?: string | null;
}): ScheduleOpportunityAnalysis {
  const activeRoster = roster.filter((player) => player.id !== excludedPlayerId && !isInactiveRosterPlayer(player));
  const gameDatesByTeam = new Map(Object.keys(scheduleData.games).map((team) => [team, new Set(scheduleGames(scheduleData, team, start, end))]));
  const allDates = [...new Set([...gameDatesByTeam.values()].flatMap((dates) => [...dates]))].sort();
  const baselineByDate = new Map<string, AssignmentResult>();
  const availableRosterByDate = new Map<string, ScheduleRosterPlayer[]>();
  const unusedSlotsByDate: Record<string, Record<string, number>> = {};
  const slots = activeSlotEntries(leagueProfile.lineup_slots);

  allDates.forEach((date) => {
    const available = activeRoster.filter((player) => gameDatesByTeam.get(player.team.toUpperCase())?.has(date));
    const baseline = solveMaximumAssignments(available, leagueProfile.lineup_slots);
    availableRosterByDate.set(date, available);
    baselineByDate.set(date, baseline);
    const unused = Object.fromEntries(slots
      .map(([slot, count]) => [slot, count - (baseline.usedBySlot[slot] ?? 0)] as const)
      .filter(([, count]) => count > 0));
    if (Object.keys(unused).length > 0) unusedSlotsByDate[date] = unused;
  });

  const recommendations: Record<string, ScheduleOpportunityRecommendation[]> = {};
  analysisPositions(leagueProfile.lineup_slots).forEach((position) => {
    const relevantRoster = activeRoster.filter((player) => candidatePositions(position).some((candidatePosition) => canFillSlot(player.positions, candidatePosition)));
    recommendations[position] = Object.keys(scheduleData.games).map((team) => {
      const games = scheduleGames(scheduleData, team, start, end);
      const opportunityDates: string[] = [];
      const blockedDates: string[] = [];
      const standaloneDates: string[] = [];
      const candidate: ScheduleRosterPlayer = { id: `candidate:${team}:${position}`, team, positions: candidatePositions(position) };

      games.forEach((date) => {
        const baseline = baselineByDate.get(date) ?? { filled: 0, usedBySlot: {} };
        const withCandidate = solveMaximumAssignments([...(availableRosterByDate.get(date) ?? []), candidate], leagueProfile.lineup_slots);
        if (withCandidate.filled > baseline.filled) opportunityDates.push(date);
        else blockedDates.push(date);
        if (!relevantRoster.some((player) => gameDatesByTeam.get(player.team.toUpperCase())?.has(date))) standaloneDates.push(date);
      });

      return {
        team,
        teamGames: games.length,
        addedOpportunities: opportunityDates.length,
        blockedGames: blockedDates.length,
        standaloneGames: standaloneDates.length,
        opportunityDates,
        blockedDates,
        standaloneDates,
      };
    }).sort((a, b) => b.addedOpportunities - a.addedOpportunities || b.standaloneGames - a.standaloneGames || a.team.localeCompare(b.team));
  });

  const totalOpenSlotOpportunities = Object.values(unusedSlotsByDate)
    .reduce((total, slotsForDate) => total + Object.values(slotsForDate).reduce((sum, count) => sum + count, 0), 0);
  const vacancies = rosterVacancies(activeRoster, leagueProfile.lineup_slots);

  return {
    unusedSlotsByDate,
    leagueGameDates: allDates.length,
    totalOpenDates: Object.keys(unusedSlotsByDate).length,
    totalOpenSlotOpportunities,
    ...vacancies,
    recommendations,
  };
}
