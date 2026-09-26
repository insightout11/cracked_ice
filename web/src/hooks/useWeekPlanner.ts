import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import { planningWeek, type LeagueWorkspace } from '../lib/leagueWorkspace';
import { loadSeasonSchedule } from '../lib/schedulePlanning';
import { discoverPickupCandidates, likelyOwnedPlayerIds } from '../lib/pickupCandidateDiscovery';
import { useInjuries, withInjuries } from '../lib/injuries';
import { planWeek, type PlannerCandidate, type PlannerHorizon, type WeekPlannerResult } from '../lib/weekPlanner';
import { loadProjections, stableKey, toRosterPlayer, type AcquisitionRecommendationResult } from './useAcquisitionRecommendations';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');

/**
 * Inputs and result for the weekly transaction planner. Candidates are the players
 * marked available, the saved targets, and a wider automatic pool of likely-available
 * players (the planner keeps the ones with the most value in the window). Projections
 * cover 30 days plus the next week's first day, so switching the horizon needs no refetch.
 */
export function useWeekPlanner({
  workspace,
  leagueProfile,
  roster,
  recommendations,
  includeGoalies,
  horizon,
  poolOverride,
}: {
  workspace: LeagueWorkspace;
  leagueProfile: LeagueProfile;
  roster: RosterPlayer[];
  /** The pickup board's candidates and directory; not needed when `poolOverride` is given. */
  recommendations?: AcquisitionRecommendationResult;
  includeGoalies: boolean;
  horizon: PlannerHorizon;
  /** Plan with exactly these candidates (e.g. one NHL team's players) instead. */
  poolOverride?: PlannerCandidate[];
}): { status: 'loading' | 'error' | 'ready'; result: WeekPlannerResult | null } {
  const injuries = useInjuries();
  const week = planningWeek(workspace);
  const monthEnd = new Date(`${week.firstPlanDate}T00:00:00Z`);
  monthEnd.setUTCDate(monthEnd.getUTCDate() + 29);
  const fetchEnd = [week.nextEnd, monthEnd.toISOString().slice(0, 10)].sort()[1];
  const window = useMemo(() => ({ start: week.start, end: fetchEnd }), [week.start, fetchEnd]);
  const players = recommendations?.players;
  const currentCandidates = recommendations?.currentCandidates;
  const unconfirmedShortlist = recommendations?.unconfirmedShortlist;

  const pool = useMemo<PlannerCandidate[]>(() => {
    if (poolOverride) return poolOverride;
    if (!players || !currentCandidates || !unconfirmedShortlist) return [];
    const discovered = discoverPickupCandidates(players, {
      rosterPlayerIds: roster.map((player) => player.id),
      existingCandidateIds: workspace.candidates.map((candidate) => candidate.playerId),
      excludedPlayerIds: likelyOwnedPlayerIds(workspace, players),
      marketSource: workspace.draftSession.marketSource,
      limit: 36,
      maxPerPosition: 10,
    });
    const items: PlannerCandidate[] = [
      // "Not interested" players stay out even when marked available.
      ...currentCandidates.filter(({ candidate }) => !candidate.preference?.dismissed).map(({ rosterPlayer }) => ({ player: rosterPlayer, confirmed: true })),
      ...unconfirmedShortlist.map(({ rosterPlayer }) => ({ player: rosterPlayer, confirmed: false })),
      ...discovered.map(({ player }) => ({ player: toRosterPlayer(player), confirmed: false })),
    ];
    return [...new Map(items.reverse().map((item) => [normalizeId(item.player.id), item])).values()].reverse();
  }, [currentCandidates, players, poolOverride, roster, unconfirmedShortlist, workspace]);

  const request = useMemo(() => [...new Map([
    ...roster.map((player) => ({ playerId: player.id, slot: player.current_slot ?? 'BN' })),
    ...pool.map(({ player }) => ({ playerId: player.id, slot: 'BN' })),
  ].map((entry) => [normalizeId(entry.playerId), entry])).values()], [pool, roster]);
  const key = useMemo(() => stableKey({ planner: true, league: workspace.id, profile: leagueProfile, window, source: workspace.projections.activeSourceId, roster: request.map((entry) => [normalizeId(entry.playerId), entry.slot]).sort() }), [leagueProfile, request, window, workspace.id, workspace.projections.activeSourceId]);

  // Team schedules for team chains (the main planner only; a one-team pool doesn't need them).
  const [teamGames, setTeamGames] = useState<Record<string, string[]> | null>(null);
  useEffect(() => {
    if (poolOverride) return;
    let cancelled = false;
    loadSeasonSchedule()
      .then((schedule) => {
        if (!cancelled) setTeamGames(Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => [team, games.map((game) => game.date)])));
      })
      .catch(() => { /* The planner works without team chains. */ });
    return () => { cancelled = true; };
  }, [poolOverride]);

  const [projections, setProjections] = useState<{ key: string; value: Record<string, PlayerProjection> } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (request.length === 0) return;
    let cancelled = false;
    setError(false);
    loadProjections(key, leagueProfile, window, request)
      .then((value) => { if (!cancelled) setProjections((previous) => (previous?.key === key ? previous : { key, value })); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [key, leagueProfile, request, window]);

  const current = projections?.key === key ? projections.value : null;
  // Plan at low priority so toggles and roster edits respond first.
  const inputs = useMemo(() => (current ? { current, horizon, includeGoalies, injuries, pool, roster, workspace, teamGames } : null), [current, horizon, includeGoalies, injuries, pool, roster, workspace, teamGames]);
  const deferred = useDeferredValue(inputs);
  const result = useMemo(() => {
    if (!deferred) return null;
    return planWeek(
      deferred.workspace,
      withInjuries(deferred.roster, deferred.injuries),
      deferred.pool.map((item) => ({ ...item, player: withInjuries([item.player], deferred.injuries)[0] })),
      deferred.current,
      { includeGoalies: deferred.includeGoalies, horizon: deferred.horizon, teamGames: deferred.teamGames ?? undefined },
    );
  }, [deferred]);

  if (error) return { status: 'error', result: null };
  return { status: result ? 'ready' : 'loading', result };
}
