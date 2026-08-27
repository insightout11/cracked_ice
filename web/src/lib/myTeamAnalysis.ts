import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace, LeagueWorkspaceRosterEntry } from './leagueWorkspace';

const RESERVE_SLOTS = new Set(['BN', 'IR', 'IR+']);

function normalizedSlotType(slot: string | undefined): string {
  const normalized = (slot ?? '').toUpperCase();
  if (normalized.startsWith('IR+')) return 'IR+';
  return normalized.replace(/-\d+$/, '');
}

export function assignImportedRosterSlots(
  existing: RosterPlayer[],
  imported: RosterPlayer[],
  lineupSlots: Record<string, number>,
): RosterPlayer[] {
  const usage = existing.reduce<Record<string, number>>((counts, player) => {
    const slot = normalizedSlotType(player.current_slot);
    if (slot) counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {});

  return imported.map((player) => {
    const positions = player.positions.map((position) => position.toUpperCase());
    const candidates = [
      ...positions,
      positions.some((position) => ['C', 'LW', 'RW'].includes(position)) ? 'F' : undefined,
      positions.some((position) => ['C', 'LW', 'RW', 'D'].includes(position)) ? 'UTIL' : undefined,
    ].filter((slot): slot is string => Boolean(slot));
    const activeSlot = candidates.find((slot) => (usage[slot] ?? 0) < (lineupSlots[slot] ?? 0));
    const slot = activeSlot ?? 'BN';
    usage[slot] = (usage[slot] ?? 0) + 1;
    return { ...player, current_slot: slot };
  });
}

export interface MyTeamAnalysis {
  activeSlotCapacity: number;
  emptyActiveSlots: number;
  projectedBenchGames: number;
  unusedLineupOpportunities: number;
  gapNights: number;
  offNightStarts: number;
  backToBacks: number;
  positionNeeds: Array<{ position: string; count: number }>;
  keeperCount: number;
  protectedCount: number;
  movesRemaining: number | null;
}

export interface KeeperRosterPlan {
  keeperCount: number;
  maximumKeepers: number | null;
  remainingKeeperSlots: number | null;
  occupiedActiveSlots: number;
  positionNeeds: Array<{ position: string; count: number }>;
}

export function reconcileWorkspaceRoster(
  existing: LeagueWorkspaceRosterEntry[],
  roster: RosterPlayer[],
): LeagueWorkspaceRosterEntry[] {
  const existingById = new Map(existing.map((entry) => [entry.playerId, entry]));
  return roster.map((player) => {
    const saved = existingById.get(player.id);
    return {
      playerId: player.id,
      providerPlayerId: saved?.providerPlayerId,
      fullName: player.full_name,
      team: player.team,
      positions: player.positions,
      slot: player.current_slot,
      keeper: saved?.keeper ?? false,
      keeperCost: saved?.keeperCost,
      protected: saved?.protected ?? false,
      undroppable: saved?.undroppable ?? false,
    };
  });
}

export function rosterPlayersFromWorkspace(workspace: LeagueWorkspace): RosterPlayer[] {
  return workspace.roster.map((entry) => ({
    id: entry.playerId,
    full_name: entry.fullName,
    team: entry.team,
    positions: entry.positions,
    current_slot: entry.slot,
    games_played: 0,
    stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 },
  }));
}

export function enrichWorkspaceRosterPlayers(
  workspace: LeagueWorkspace,
  legacyRoster: RosterPlayer[],
  preferHydratedPositions = false,
): RosterPlayer[] {
  const legacyById = new Map(legacyRoster.map((player) => [player.id.replace(/^nhl:/, ''), player]));
  return rosterPlayersFromWorkspace(workspace).map((saved) => {
    const enriched = legacyById.get(saved.id.replace(/^nhl:/, ''));
    return enriched ? {
      ...enriched,
      id: saved.id,
      full_name: saved.full_name,
      team: saved.team,
      positions: preferHydratedPositions && enriched.positions.length ? enriched.positions : saved.positions,
      current_slot: saved.current_slot ?? enriched.current_slot,
    } : saved;
  });
}

export function shouldAdoptLegacyRoster(workspace: LeagueWorkspace, legacyRoster: RosterPlayer[]): boolean {
  return workspace.roster.length === 0
    && legacyRoster.length > 0
    && workspace.source.kind === 'default';
}

export function analyzeKeeperRosterPlan(workspace: LeagueWorkspace): KeeperRosterPlan {
  const remaining = Object.fromEntries(
    Object.entries(workspace.rosterRules.slots)
      .filter(([slot]) => !RESERVE_SLOTS.has(slot))
      .map(([slot, count]) => [slot, count]),
  );
  const keepers = workspace.roster.filter((entry) => entry.keeper);
  let occupiedActiveSlots = 0;

  for (const entry of keepers) {
    const explicitSlot = entry.slot?.replace(/-\d+$/, '');
    const eligible = [
      explicitSlot,
      ...entry.positions,
      entry.positions.some((position) => ['C', 'LW', 'RW'].includes(position)) ? 'F' : undefined,
      'UTIL',
    ].filter((slot): slot is string => Boolean(slot) && !RESERVE_SLOTS.has(slot!));
    const assigned = eligible.find((slot) => (remaining[slot] ?? 0) > 0);
    if (!assigned) continue;
    remaining[assigned] -= 1;
    occupiedActiveSlots += 1;
  }

  const maximumKeepers = workspace.keeperRules.maximumKeepers;
  return {
    keeperCount: keepers.length,
    maximumKeepers,
    remainingKeeperSlots: maximumKeepers === null ? null : Math.max(0, maximumKeepers - keepers.length),
    occupiedActiveSlots,
    positionNeeds: Object.entries(remaining)
      .filter(([, count]) => count > 0)
      .map(([position, count]) => ({ position, count })),
  };
}

function countBackToBacks(projection: PlayerProjection): number {
  const dates = Object.keys(projection.gamesByDate ?? {}).sort();
  let count = 0;
  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(`${dates[index - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${dates[index]}T00:00:00Z`).getTime();
    if (current - previous === 86_400_000) count += 1;
  }
  return count;
}

export function analyzeMyTeam(
  workspace: LeagueWorkspace,
  projections: Record<string, PlayerProjection>,
  unusedSlotsByDate: Record<string, Record<string, number>>,
): MyTeamAnalysis {
  const activeRules = Object.entries(workspace.rosterRules.slots)
    .filter(([slot]) => !RESERVE_SLOTS.has(slot));
  const activeSlotCapacity = activeRules.reduce((sum, [, count]) => sum + count, 0);
  const occupiedBySlot = workspace.roster.reduce<Record<string, number>>((counts, entry) => {
    const slot = normalizedSlotType(entry.slot);
    if (slot && !RESERVE_SLOTS.has(slot)) counts[slot] = (counts[slot] ?? 0) + 1;
    return counts;
  }, {});
  const occupiedActiveSlots = Object.values(occupiedBySlot).reduce((sum, count) => sum + count, 0);
  const positionNeeds = activeRules
    .map(([position, count]) => ({ position, count: Math.max(0, count - (occupiedBySlot[position] ?? 0)) }))
    .filter((need) => need.count > 0);
  const rosterProjections = workspace.roster
    .map((entry) => projections[entry.playerId])
    .filter((projection): projection is PlayerProjection => Boolean(projection));
  const unusedTotals = Object.values(unusedSlotsByDate).map((slots) =>
    Object.entries(slots)
      .filter(([slot]) => !RESERVE_SLOTS.has(slot))
      .reduce((sum, [, count]) => sum + count, 0));

  const movesRemaining = workspace.acquisitions.limit === null || workspace.acquisitions.movesUsed === null
    ? null
    : Math.max(0, workspace.acquisitions.limit - workspace.acquisitions.movesUsed);

  return {
    activeSlotCapacity,
    emptyActiveSlots: Math.max(0, activeSlotCapacity - occupiedActiveSlots),
    projectedBenchGames: rosterProjections.reduce((sum, projection) => sum + Math.max(0, projection.gamesAvailable - projection.starts), 0),
    unusedLineupOpportunities: unusedTotals.reduce((sum, count) => sum + count, 0),
    gapNights: unusedTotals.filter((count) => count > 0).length,
    offNightStarts: Math.round(rosterProjections.reduce((sum, projection) => sum + projection.starts * projection.offNightRate, 0)),
    backToBacks: rosterProjections.reduce((sum, projection) => sum + countBackToBacks(projection), 0),
    positionNeeds,
    keeperCount: workspace.roster.filter((entry) => entry.keeper).length,
    protectedCount: workspace.roster.filter((entry) => entry.protected).length,
    movesRemaining,
  };
}
