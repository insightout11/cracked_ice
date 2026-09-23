import { useEffect, useMemo, useState } from 'react';
import type { LeagueProfile, PlayerProjection, RosterPlayer } from '../lib/coachSchemas';
import { planningWeek, type LeagueWorkspace } from '../lib/leagueWorkspace';
import { discoverPickupCandidates } from '../lib/pickupCandidateDiscovery';
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
}: {
  workspace: LeagueWorkspace;
  leagueProfile: LeagueProfile;
  roster: RosterPlayer[];
  recommendations: AcquisitionRecommendationResult;
  includeGoalies: boolean;
  horizon: PlannerHorizon;
}): { status: 'loading' | 'error' | 'ready'; result: WeekPlannerResult | null } {
  const injuries = useInjuries();
  const week = planningWeek(workspace);
  const monthEnd = new Date(`${week.firstPlanDate}T00:00:00Z`);
  monthEnd.setUTCDate(monthEnd.getUTCDate() + 29);
  const fetchEnd = [week.nextEnd, monthEnd.toISOString().slice(0, 10)].sort()[1];
  const window = useMemo(() => ({ start: week.start, end: fetchEnd }), [week.start, fetchEnd]);
  const { players, currentCandidates, unconfirmedShortlist } = recommendations;

  const pool = useMemo<PlannerCandidate[]>(() => {
    const discovered = discoverPickupCandidates(players, {
      rosterPlayerIds: roster.map((player) => player.id),
      existingCandidateIds: workspace.candidates.map((candidate) => candidate.playerId),
      excludedPlayerIds: [...workspace.draftSession.picks.map((pick) => pick.playerId), ...(workspace.draftSession.unavailablePlayerIds ?? [])],
      marketSource: workspace.draftSession.marketSource,
      limit: 36,
      maxPerPosition: 10,
    });
    const items: PlannerCandidate[] = [
      ...currentCandidates.map(({ rosterPlayer }) => ({ player: rosterPlayer, confirmed: true })),
      ...unconfirmedShortlist.map(({ rosterPlayer }) => ({ player: rosterPlayer, confirmed: false })),
      ...discovered.map(({ player }) => ({ player: toRosterPlayer(player), confirmed: false })),
    ];
    return [...new Map(items.reverse().map((item) => [normalizeId(item.player.id), item])).values()].reverse();
  }, [currentCandidates, players, roster, unconfirmedShortlist, workspace.candidates, workspace.draftSession]);

  const request = useMemo(() => [...new Map([
    ...roster.map((player) => ({ playerId: player.id, slot: player.current_slot ?? 'BN' })),
    ...pool.map(({ player }) => ({ playerId: player.id, slot: 'BN' })),
  ].map((entry) => [normalizeId(entry.playerId), entry])).values()], [pool, roster]);
  const key = useMemo(() => stableKey({ planner: true, league: workspace.id, profile: leagueProfile, window, source: workspace.projections.activeSourceId, roster: request.map((entry) => [normalizeId(entry.playerId), entry.slot]).sort() }), [leagueProfile, request, window, workspace.id, workspace.projections.activeSourceId]);

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
  const result = useMemo(() => {
    if (!current) return null;
    return planWeek(
      workspace,
      withInjuries(roster, injuries),
      pool.map((item) => ({ ...item, player: withInjuries([item.player], injuries)[0] })),
      current,
      { includeGoalies, horizon },
    );
  }, [current, horizon, includeGoalies, injuries, pool, roster, workspace]);

  if (error) return { status: 'error', result: null };
  return { status: result ? 'ready' : 'loading', result };
}
