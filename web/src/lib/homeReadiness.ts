import type { LeagueWorkspace } from './leagueWorkspace';
import type { SeasonScheduleData } from './schedulePlanning';
import { NHL_TEAM_CODES, NHL_TEAM_CODE_SET } from './nhlTeams';
import { SEASON_END, SEASON_GAMES_PER_TEAM, SEASON_START } from './season';
import { canPositionsFillSlot, hasSupportedPlayerPositions, isInactiveRosterSlot, SUPPORTED_LINEUP_SLOTS } from './rosterEligibility';

export type RosterReadinessState = 'none' | 'incomplete' | 'ready' | 'needs-review';
export type ScheduleReadinessState = 'loading' | 'available' | 'incomplete' | 'unavailable';
export type PersonalizedAnalysisState = 'blocked-setup' | 'blocked-schedule' | 'capacity-ready' | 'weekly-limited';

export function rosterRevision(workspace: LeagueWorkspace): string {
  const roster = workspace.roster.map((entry) => ({
    id: entry.playerId.replace(/^nhl:/, ''),
    team: entry.team,
    positions: [...entry.positions].sort(),
    slot: entry.slot ?? '',
  })).sort((a, b) => a.id.localeCompare(b.id));
  const slots = Object.entries(workspace.rosterRules.slots).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ season: workspace.season.id, roster, slots, lockingMode: workspace.rosterRules.lockingMode });
}

function activeSlotTypes(workspace: LeagueWorkspace): string[] {
  return Object.entries(workspace.rosterRules.slots)
    .filter(([slot, count]) => count > 0 && !isInactiveRosterSlot(slot))
    .map(([slot]) => slot);
}

function rosterConfigurationIsUsable(workspace: LeagueWorkspace): boolean {
  const slots = activeSlotTypes(workspace);
  const ids = workspace.roster.map((entry) => entry.playerId.replace(/^nhl:/, ''));
  if (workspace.season.id !== workspace.freshness.sourceSeason || new Set(ids).size !== ids.length || slots.length === 0) return false;
  if (Object.entries(workspace.rosterRules.slots).some(([slot, count]) => count > 0 && !SUPPORTED_LINEUP_SLOTS.has(slot.toUpperCase()))) return false;
  return workspace.roster.every((entry) =>
    Boolean(entry.playerId)
    && NHL_TEAM_CODE_SET.has(entry.team.toUpperCase())
    && hasSupportedPlayerPositions(entry.positions)
    && (!entry.slot || SUPPORTED_LINEUP_SLOTS.has(entry.slot.replace(/-\d+$/, '').toUpperCase()))
    && slots.some((slot) => canPositionsFillSlot(entry.positions, slot)),
  );
}

export function selectRosterReadiness(workspace: LeagueWorkspace): RosterReadinessState {
  if (workspace.roster.length === 0) return 'none';
  if (!rosterConfigurationIsUsable(workspace)) return 'needs-review';
  if (workspace.source.kind === 'provider' && workspace.freshness.syncedAt) return 'ready';
  if (workspace.rosterReadinessConfirmation?.revision === rosterRevision(workspace)) return 'ready';
  const activeSlots = Object.entries(workspace.rosterRules.slots).reduce((sum, [slot, count]) => sum + (isInactiveRosterSlot(slot) ? 0 : count), 0);
  return workspace.roster.length < activeSlots ? 'incomplete' : 'needs-review';
}

export function canConfirmRosterReadiness(workspace: LeagueWorkspace): boolean {
  return workspace.roster.length > 0 && rosterConfigurationIsUsable(workspace);
}

export function confirmRosterReadiness(workspace: LeagueWorkspace, now = new Date().toISOString()): LeagueWorkspace {
  if (!canConfirmRosterReadiness(workspace)) return workspace;
  return { ...workspace, rosterReadinessConfirmation: { revision: rosterRevision(workspace), confirmedAt: now }, updatedAt: now };
}

export function selectScheduleReadiness(schedule: SeasonScheduleData | null, failed: boolean): ScheduleReadinessState {
  if (failed) return 'unavailable';
  if (!schedule) return 'loading';
  const complete = NHL_TEAM_CODES.every((team) => {
    const games = schedule.games[team];
    return games?.length === SEASON_GAMES_PER_TEAM && games.every((game) =>
      game.date >= SEASON_START
      && game.date <= SEASON_END
      && NHL_TEAM_CODE_SET.has(game.opponent)
      && game.opponent !== team,
    );
  });
  return complete ? 'available' : 'incomplete';
}

export function selectPersonalizedAnalysisState(workspace: LeagueWorkspace, roster: RosterReadinessState, schedule: ScheduleReadinessState): PersonalizedAnalysisState {
  if (roster !== 'ready') return 'blocked-setup';
  if (schedule !== 'available') return 'blocked-schedule';
  return workspace.rosterRules.lockingMode === 'weekly' ? 'weekly-limited' : 'capacity-ready';
}
