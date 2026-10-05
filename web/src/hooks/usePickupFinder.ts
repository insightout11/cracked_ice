import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { LeagueWorkspace } from '../lib/leagueWorkspace';
import { loadSeasonSchedule } from '../lib/schedulePlanning';
import { likelyOwnedPlayerIds } from '../lib/pickupCandidateDiscovery';
import { useInjuries, withInjuries } from '../lib/injuries';
import { adviseAdds, finderDays, findPickups, openSpots, toFinderRosterPlayer, type AddAdvice, type DaySpots, type FinderInput, type Pickup } from '../lib/pickupFinder';
import type { PlayerSearchResult } from '../types';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');

export interface PickupFinderResult {
  status: 'loading' | 'working' | 'ready' | 'error';
  days: string[];
  spots: DaySpots[];
  pickups: Pickup[];
  /** This week's adds: how many to use now, and the plan that makes them. */
  advice: AddAdvice | null;
  input: FinderInput | null;
}

/**
 * Pickups for a set of days, and this week's add advice, from the league-scored player
 * directory and the NHL schedule. Shared by My Team and the home page so they agree.
 * Long ranges take a moment, so the work runs after the page has painted.
 */
export function usePickupFinder({ workspace, directory, days }: { workspace: LeagueWorkspace; directory: PlayerSearchResult[] | undefined; days: string[] }): PickupFinderResult {
  const injuries = useInjuries();
  const [teamGames, setTeamGames] = useState<Record<string, string[]> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadSeasonSchedule()
      .then((schedule) => { if (!cancelled) setTeamGames(Object.fromEntries(Object.entries(schedule.games).map(([team, games]) => [team, games.map((game) => game.date)]))); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const input = useMemo<FinderInput | null>(() => {
    if (!directory?.length || !teamGames) return null;
    const byId = new Map(directory.map((player) => [normalizeId(player.id), player]));
    const roster = withInjuries(workspace.roster.map((entry) => {
      const known = byId.get(normalizeId(entry.playerId));
      const base = known ? toFinderRosterPlayer(known) : toFinderRosterPlayer({ id: entry.playerId, name: entry.fullName, team: entry.team, pos: entry.positions, aliases: [], blendedFppg: 0 });
      return { ...base, id: entry.playerId, team: entry.team, current_slot: entry.slot };
    }), injuries);
    const taken = workspace.candidates.filter((candidate) => candidate.status === 'taken').map((candidate) => candidate.playerId);
    return {
      workspace,
      roster,
      directory: directory.map((player) => (injuries ? { ...player, injuryStatus: withInjuries([toFinderRosterPlayer(player)], injuries)[0].injuryStatus ?? player.injuryStatus } : player)),
      teamGames,
      ownedIds: [...likelyOwnedPlayerIds(workspace, directory), ...taken],
    };
  }, [directory, injuries, teamGames, workspace]);

  const deferredInput = useDeferredValue(input);
  const daysKey = days.join(',');
  const [computed, setComputed] = useState<{ key: string; spots: DaySpots[]; pickups: Pickup[]; advice: AddAdvice | null } | null>(null);
  const key = deferredInput ? `${daysKey}|${deferredInput.workspace.updatedAt}|${deferredInput.directory.length}|${deferredInput.ownedIds.length}` : '';
  useEffect(() => {
    if (!deferredInput || !daysKey) return undefined;
    // Let the page paint first: a season-long range takes a second or two.
    const timer = window.setTimeout(() => {
      const range = daysKey.split(',');
      const pickups = findPickups(deferredInput, range, range.length > 21 ? 120 : 200);
      const weekDays = finderDays(deferredInput.workspace, 'week');
      const weekPickups = weekDays.join(',') === daysKey ? pickups : findPickups(deferredInput, weekDays);
      setComputed({ key, spots: openSpots(deferredInput, range), pickups, advice: adviseAdds(deferredInput, weekPickups) });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [daysKey, deferredInput, key]);

  if (failed) return { status: 'error', days, spots: [], pickups: [], advice: null, input };
  if (!input) return { status: 'loading', days, spots: [], pickups: [], advice: null, input };
  if (!computed) return { status: 'working', days, spots: [], pickups: [], advice: null, input };
  return { status: computed.key === key ? 'ready' : 'working', days, spots: computed.spots, pickups: computed.pickups, advice: computed.advice, input };
}
