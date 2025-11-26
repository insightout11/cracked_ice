import { loadUserContext } from './data-loader';
import { buildProjection, DateWindow } from './scoring';
import { simulateLineup } from './simulation';
import { getTeamScheduleDates } from '../../context/schedules';
import type { ScheduleContext } from '../../context/schedules';
import type { StatsContext } from '../../context/stats';
import type { TeamStatsContext } from '../../context/teamStats';
import {
  CoachResponse,
  PlayerProjection,
  Recommendation,
  Player,
  FreeAgent
} from './types';
import {
  REQUEST_TIMEOUT_MS,
  MAX_DROP_CANDIDATES
} from './constants';

const BADGE_LABELS = {
  offNight: 'off-night boost',
  ceiling: 'ceiling play',
  volume: 'volume stream',
  neutral: 'steady'
} as const;

function deriveBadge(
  add: PlayerProjection,
  drop: PlayerProjection,
  deltaPoints: number,
  deltaGp: number
): string {
  if (add.offNightRate >= 0.6 && deltaGp > 0) {
    return BADGE_LABELS.offNight;
  }
  if (deltaPoints >= 4 && add.fppg >= drop.fppg + 0.4) {
    return BADGE_LABELS.ceiling;
  }
  if (deltaGp >= 2) {
    return BADGE_LABELS.volume;
  }
  return BADGE_LABELS.neutral;
}

function cloneWithout<T extends PlayerProjection>(
  projections: PlayerProjection[],
  playerId: string
): PlayerProjection[] {
  return projections.filter((projection) => projection.base.id !== playerId);
}

function computeDropPriority(projection: PlayerProjection): number {
  const slot = projection.base.current_slot?.toUpperCase() ?? '';
  const isBench = slot === 'BN' || slot === 'BENCH';
  const isUtility = slot === 'UTIL' || slot === 'FLEX';
  const isIR = slot === 'IR' || slot === 'IR+' || slot === 'IR-LT';
  const isDropEligible = projection.base.is_drop_eligible ?? false;

  // IR players should never be drop candidates - they don't occupy active roster slots
  if (isIR) {
    return Infinity;
  }

  let priority = projection.fppg; // lower fppg -> better drop candidate

  if (!isBench && !isUtility) {
    priority += 200; // strongly prefer bench players first
  }

  if (!isDropEligible) {
    priority += 100; // deprioritise locked players
  }

  return priority;
}

function mapUnusedSlots(unusedSlotsByDate: Map<string, Record<string, number>>): Record<string, Record<string, number>> {
  return Object.fromEntries(Array.from(unusedSlotsByDate.entries()));
}
export function mergeUpcomingGames<T extends Player | FreeAgent>(
  player: T,
  scheduleContext?: ScheduleContext | null,
  window?: DateWindow
): T {
  if (!scheduleContext) {
    return player;
  }

  const scheduleDates = getTeamScheduleDates(player.team, scheduleContext);
  if (!scheduleDates.length) {
    return player;
  }

  const filteredDates = window
    ? scheduleDates.filter(date => date >= window.start && date <= window.end)
    : scheduleDates;

  const merged = new Set<string>(player.upcoming_games);
  for (const date of filteredDates) {
    merged.add(date);
  }

  const combined = Array.from(merged).sort();
  const unchanged =
    combined.length === player.upcoming_games.length &&
    player.upcoming_games.every((date, index) => date === combined[index]);

  if (unchanged) {
    return player;
  }

  return {
    ...player,
    upcoming_games: combined
  } as T;
}

export function generateCoachRecommendations(
  userId: string,
  window: DateWindow,
  scheduleContext?: ScheduleContext | null,
  statsContext?: StatsContext | null,
  teamStatsContext?: TeamStatsContext | null
): CoachResponse {
  const startedAt = Date.now();
  const context = loadUserContext(userId);

  const roster = context.roster.map((player) =>
    mergeUpcomingGames(player, scheduleContext, window)
  );
  const freeAgents = context.free_agents.map((agent) =>
    mergeUpcomingGames(agent, scheduleContext, window)
  );

  const rosterProjections = roster.map((player) =>
    buildProjection(player, context.league_profile, window, statsContext, scheduleContext, teamStatsContext)
  );

  const freeAgentProjections = freeAgents.map((agent) =>
    buildProjection(agent, context.league_profile, window, statsContext, scheduleContext, teamStatsContext)
  );
  const baseline = simulateLineup(
    rosterProjections,
    window,
    context.league_profile.lineup_slots
  );
  const baselineUnusedSlots = mapUnusedSlots(baseline.unusedSlotsByDate);

  const dropCandidates = rosterProjections
    .map((projection) => ({ projection, priority: computeDropPriority(projection) }))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_DROP_CANDIDATES)
    .map((entry) => entry.projection);

  const recommendations: Recommendation[] = [];

  for (const drop of dropCandidates) {
    const trimmedRoster = cloneWithout(rosterProjections, drop.base.id);
    const baselineDropStarts = baseline.startsByPlayer.get(drop.base.id) ?? 0;
    const dropStartRecords = baseline.startRecords.filter((record) => record.playerId === drop.base.id);
    const dropPlayerStartDates = dropStartRecords.map((record) => record.date);
    const dropPlayerStartCount = dropPlayerStartDates.length;
    const dropPlayerPoints = Number(dropStartRecords.reduce((total, record) => total + record.fppg, 0).toFixed(2));

    for (const add of freeAgentProjections) {
      const combination = [...trimmedRoster, add];
      const simulated = simulateLineup(
        combination,
        window,
        context.league_profile.lineup_slots
      );

      const deltaPoints = Number((simulated.totalPoints - baseline.totalPoints).toFixed(2));
      const addStarts = simulated.startsByPlayer.get(add.base.id) ?? 0;
      const deltaGp = addStarts - baselineDropStarts;

      // Filter out recommendations where add player only fills slots freed by the drop.
      // The add should fill at least one unused baseline slot on dates they have games.
      const addStartRecords = simulated.startRecords.filter((record) => record.playerId === add.base.id);
      const addPlayerStartDates = addStartRecords.map((record) => record.date);
      const addUpcomingGames = add.upcomingGamesInWindow || [];

      // Check if add ONLY starts on dates where baseline has unused slots that they're eligible for.
      // If add starts on a date with no unused baseline slots matching their position eligibility,
      // they're just replacing another player, not filling a gap - which means the value comes
      // from the drop, not the add.
      let startsOnlyOnUnusedSlotDates = true;
      for (const date of addPlayerStartDates) {
        const baselineUnused = baseline.unusedSlotsByDate.get(date) ?? {};

        // Check if player is eligible for any of the unused slot types on this date
        const canFillUnusedSlot = Object.entries(baselineUnused).some(([position, count]) => {
          if (count <= 0) return false;

          // Check if add player is eligible for this unused position slot
          const positions = add.base.position.split('/').map(p => p.trim().toUpperCase());
          const slot = position.toUpperCase();

          // Direct position match
          if (positions.includes(slot)) return true;

          // Check flex position eligibility
          const isForward = positions.some((pos) => pos === 'C' || pos === 'LW' || pos === 'RW' || pos === 'W' || pos === 'F');
          const isSkater = positions.some((pos) => pos !== 'G');

          if (slot === 'F' && isForward) return true;
          if (slot === 'W' && positions.some((pos) => pos === 'LW' || pos === 'RW' || pos === 'W')) return true;
          if ((slot === 'UTIL' || slot === 'U' || slot === 'FLEX') && isSkater) return true;

          return false;
        });

        if (!canFillUnusedSlot) {
          // Add starts on a date where they can't fill any unused baseline slots
          startsOnlyOnUnusedSlotDates = false;
          break;
        }
      }

      // Skip recommendations where add provides no value or doesn't fill unused baseline slots
      if ((deltaPoints <= 0 && deltaGp <= 0) || !startsOnlyOnUnusedSlotDates) {
        continue;
      }

      const badge = deriveBadge(add, drop, deltaPoints, deltaGp);
      const addPlayerPoints = Number(addStartRecords.reduce((total, record) => total + record.fppg, 0).toFixed(2));
      const addPlayerStartCount = addPlayerStartDates.length;
      const addPlayerBlockedDates = addUpcomingGames.filter((date) => !addPlayerStartDates.includes(date));
      const unusedSlotsAfterSwap = mapUnusedSlots(simulated.unusedSlotsByDate);

      // Build a map of date -> slot type for the add player's starts
      const addPlayerSlotsByDate: Record<string, string> = {};
      for (const record of addStartRecords) {
        addPlayerSlotsByDate[record.date] = record.position;
      }

      recommendations.push({
        add_player: { ...add, source: 'free_agent' },
        drop_player: { ...drop, source: 'roster' },
        delta_points: deltaPoints,
        delta_gp: deltaGp,
        badge,
        add_player_start_dates: addPlayerStartDates,
        add_player_points: addPlayerPoints,
        add_player_start_count: addPlayerStartCount,
        add_player_blocked_dates: addPlayerBlockedDates,
        add_player_slots_by_date: addPlayerSlotsByDate,
        drop_player_start_dates: dropPlayerStartDates,
        drop_player_start_count: dropPlayerStartCount,
        drop_player_points: dropPlayerPoints,
        unused_slots_by_date: unusedSlotsAfterSwap
      });

      if (Date.now() - startedAt > REQUEST_TIMEOUT_MS) {
        throw new Error('Recommendation generation exceeded 1s budget');
      }
    }
  }

  recommendations.sort((a, b) => b.delta_points - a.delta_points || b.delta_gp - a.delta_gp);

  return {
    baseline_points: baseline.totalPoints,
    baseline_unused_slots: baselineUnusedSlots,
    recommendations,
    window: { ...window }
  };
}

