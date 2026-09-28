import type { RosterPlayer } from './coachSchemas';
import type { PlayerSearchResult } from '../types';
import { activeSlotCapacities } from './acquisitionAnalysis';
import type { LeagueWorkspace } from './leagueWorkspace';
import { canPlaySoon } from './pickupCandidateDiscovery';
import { isOut } from './weekPlanner';

const normalizeId = (id: string) => id.replace(/^nhl:/, '');
const isGoalie = (positions: string[]) => positions.length > 0 && positions.every((position) => position.toUpperCase() === 'G');
const onIr = (player: RosterPlayer) => player.current_slot?.toUpperCase().startsWith('IR') === true;

export interface RosterGap {
  kind: 'goalies' | 'skaters';
  /** Healthy players who can fill these spots. */
  have: number;
  spots: number;
}

/**
 * Lineup spots the roster can't fill even when everyone plays: fewer healthy goalies
 * than G spots, or fewer healthy skaters than skater spots. Injured and IR players
 * don't count. The planner streams skaters, but these gaps need a real pickup.
 */
export function rosterGaps(workspace: LeagueWorkspace, roster: RosterPlayer[]): RosterGap[] {
  const capacities = Object.entries(activeSlotCapacities(workspace)).filter(([slot]) => !['BN', 'BENCH'].includes(slot.toUpperCase()));
  const goalieSpots = capacities.filter(([slot]) => slot.toUpperCase() === 'G').reduce((sum, [, count]) => sum + count, 0);
  const skaterSpots = capacities.filter(([slot]) => slot.toUpperCase() !== 'G').reduce((sum, [, count]) => sum + count, 0);
  const healthy = roster.filter((player) => !isOut(player) && !onIr(player));
  const goalies = healthy.filter((player) => isGoalie(player.positions)).length;
  const skaters = healthy.filter((player) => !isGoalie(player.positions)).length;
  const gaps: RosterGap[] = [];
  if (goalies < goalieSpots) gaps.push({ kind: 'goalies', have: goalies, spots: goalieSpots });
  if (skaters < skaterSpots) gaps.push({ kind: 'skaters', have: skaters, spots: skaterSpots });
  return gaps;
}

/** Share of his team's games a goalie starts, from his starts in the stats season. */
export function goalieStartShare(player: PlayerSearchResult): number {
  const starts = Number(player.stats?.games_started ?? player.stats?.gamesStarted ?? 0);
  const teamGames = player.teamGamesPlayed && player.teamGamesPlayed >= 20 ? player.teamGamesPlayed : 82;
  return Math.max(0.1, Math.min(0.75, starts > 0 ? starts / teamGames : 0.3));
}

/**
 * The best goalies nobody in the league has: healthy, on an NHL team, ranked by points
 * per team game (points per start times the share of games he starts), so a hot
 * backup doesn't outrank a starter.
 */
export function availableGoalies(players: PlayerSearchResult[], unavailableIds: Iterable<string>, limit = 3): Array<{ player: PlayerSearchResult; perTeamGame: number; startShare: number }> {
  const unavailable = new Set([...unavailableIds].map(normalizeId));
  return players
    .filter((player) => isGoalie(player.pos) && !unavailable.has(normalizeId(player.id)) && canPlaySoon(player) && (player.blendedFppg ?? 0) > 0)
    .map((player) => {
      const startShare = goalieStartShare(player);
      return { player, startShare, perTeamGame: (player.blendedFppg ?? 0) * startShare };
    })
    .sort((a, b) => b.perTeamGame - a.perTeamGame || a.player.name.localeCompare(b.player.name))
    .slice(0, limit);
}
