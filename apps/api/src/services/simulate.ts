import { LeagueProfile, Player, SimulationResult, Window } from '../models/types';
import { getBlendedFppg, getStatsMap } from './stats';
import { getTeamGames, listWindowDates } from './schedule';

const POSITION_PRIORITY = ['C', 'LW', 'RW', 'D', 'G', 'UTIL'] as const;

type SlotState = Record<string, number>;

function cloneSlots(slots: Record<string, number>): SlotState {
  return POSITION_PRIORITY.reduce<SlotState>((acc, key) => {
    acc[key] = slots[key] ?? 0;
    return acc;
  }, {});
}

function ensureDailyMode(profile: LeagueProfile): void {
  if (profile.lineupMode !== 'daily') {
    throw new Error('Only daily lineup leagues supported in MVP');
  }
}

function buildScheduleCache(roster: Player[], window: Window): Map<string, Set<string>> {
  const cache = new Map<string, Set<string>>();
  for (const player of roster) {
    if (cache.has(player.team)) continue;
    cache.set(player.team, new Set(getTeamGames(player.team, window)));
  }
  return cache;
}

function teamPlaysOn(cache: Map<string, Set<string>>, team: string, date: string): boolean {
  return cache.get(team)?.has(date) ?? false;
}

export function fillLineup(
  roster: Player[],
  window: Window,
  profile: LeagueProfile
): SimulationResult {
  ensureDailyMode(profile);

  const scheduleCache = buildScheduleCache(roster, window);
  const playableGp: Record<string, number> = {};
  let totalPoints = 0;

  const dates = listWindowDates(window);
  const statsMap = getStatsMap();

  for (const day of dates) {
    const slots = cloneSlots(profile.rosterSlots);

    const playingToday = roster
      .filter((player) => teamPlaysOn(scheduleCache, player.team, day))
      .map((player) => ({
        player,
        fppg: statsMap.get(player.id)?.blendedFppg ?? getBlendedFppg(player.id)
      }))
      .sort((a, b) => b.fppg - a.fppg);

    for (const { player, fppg } of playingToday) {
      if (fppg <= 0) continue;

      let placed = false;

      for (const pos of player.pos) {
        if ((slots[pos] ?? 0) > 0) {
          slots[pos] -= 1;
          placed = true;
          break;
        }
      }

      if (!placed && (slots.UTIL ?? 0) > 0) {
        slots.UTIL -= 1;
        placed = true;
      }

      if (placed) {
        playableGp[player.id] = (playableGp[player.id] ?? 0) + 1;
        totalPoints += fppg;
      }
    }
  }

  return {
    playableGp,
    totalPoints: Number(totalPoints.toFixed(2))
  };
}

export function simulateSwap(
  roster: Player[],
  addPlayer: Player,
  dropPlayer: Player,
  window: Window,
  profile: LeagueProfile,
  baseline?: SimulationResult
): { deltaPoints: number; deltaGp: number; lostPoints: number; swapped: SimulationResult } {
  const currentBaseline = baseline ?? fillLineup(roster, window, profile);
  const swappedRoster = roster.filter((player) => player.id !== dropPlayer.id).concat(addPlayer);
  const swapped = fillLineup(swappedRoster, window, profile);

  const addGp = swapped.playableGp[addPlayer.id] ?? 0;
  const dropGp = currentBaseline.playableGp[dropPlayer.id] ?? 0;
  const dropFppg = getBlendedFppg(dropPlayer.id);

  const deltaPoints = Number((swapped.totalPoints - currentBaseline.totalPoints).toFixed(2));
  const deltaGp = addGp - dropGp;
  const lostPoints = Number((dropGp * dropFppg).toFixed(2));

  return { deltaPoints, deltaGp, lostPoints, swapped };
}
