import type { LeagueWorkspace } from './leagueWorkspace';
import type { SeasonScheduleData } from './schedulePlanning';
import { SEASON_END, SEASON_START } from './season';
import { canPositionsFillSlot, isInactiveRosterSlot, isUnavailableRosterSlot } from './rosterEligibility';

export interface PublicMatchup { away: string; home: string; startTime?: string }
export interface SlateDay { date: string; gameCount: number }
export interface PublicBriefing {
  date: string;
  matchups: PublicMatchup[];
  gameCount: number;
  firstPuckDrop?: string;
  invalidStartTimes: number;
  nextGameDate?: string;
  nextGameCount?: number;
  nextLightDate?: string;
  week: SlateDay[];
  openingWeek: SlateDay[];
}

const DAY_MS = 86_400_000;

export function hockeyDateAt(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function seasonPhase(date: string): 'preseason' | 'regular-season' | 'outside-coverage' {
  return date < SEASON_START ? 'preseason' : date > SEASON_END ? 'outside-coverage' : 'regular-season';
}

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function scheduleDateFormatter(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (game: { date: string; startTime?: string }): string => {
    if (!game.startTime || Number.isNaN(new Date(game.startTime).getTime())) return game.date;
    const parts = formatter.formatToParts(new Date(game.startTime));
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  };
}

function indexMatchups(schedule: SeasonScheduleData, timezone: string): Map<string, Map<string, PublicMatchup>> {
  const byDate = new Map<string, Map<string, PublicMatchup>>();
  const displayDate = scheduleDateFormatter(timezone);
  for (const [team, games] of Object.entries(schedule.games)) {
    for (const game of games) {
      const date = displayDate(game);
      const found = byDate.get(date) ?? new Map<string, PublicMatchup>();
      const key = [team, game.opponent].sort().join(':');
      if (!found.has(key)) found.set(key, game.isHome ? { away: game.opponent, home: team, startTime: game.startTime } : { away: team, home: game.opponent, startTime: game.startTime });
      byDate.set(date, found);
    }
  }
  return byDate;
}

export function buildPublicBriefing(schedule: SeasonScheduleData, date: string, timezone = 'UTC'): PublicBriefing {
  const indexed = indexMatchups(schedule, timezone);
  const allDates = [...indexed.keys()].sort();
  const counts = new Map(allDates.map((day) => [day, indexed.get(day)?.size ?? 0]));
  const matchups = [...(indexed.get(date)?.values() ?? [])].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.away.localeCompare(b.away));
  const validStarts = matchups.map((game) => game.startTime).filter((value): value is string => Boolean(value && !Number.isNaN(new Date(value).getTime()))).sort();
  const nextGameDate = allDates.find((day) => day > date && (counts.get(day) ?? 0) > 0);
  const nextLightDate = allDates.find((day) => day >= date && (counts.get(day) ?? 0) > 0 && (counts.get(day) ?? 0) <= 8);
  return {
    date,
    matchups,
    gameCount: matchups.length,
    firstPuckDrop: validStarts[0],
    invalidStartTimes: matchups.filter((game) => game.startTime && Number.isNaN(new Date(game.startTime).getTime())).length,
    nextGameDate,
    nextGameCount: nextGameDate ? counts.get(nextGameDate) : undefined,
    nextLightDate,
    week: Array.from({ length: 7 }, (_, index) => { const day = addDays(date, index); return { date: day, gameCount: counts.get(day) ?? 0 }; }),
    openingWeek: allDates.filter((day) => day > date && (counts.get(day) ?? 0) > 0).slice(0, 7).map((day) => ({ date: day, gameCount: counts.get(day) ?? 0 })),
  };
}

export interface HomeCapacity {
  scheduledSkaters: number;
  skaterCapacity: number;
  conflict: number;
  goalieTeams: string[];
  actionable: boolean;
}

export function calculateHomeCapacity(workspace: LeagueWorkspace, schedule: SeasonScheduleData, date: string, timezone = workspace.schedule.timezone): HomeCapacity {
  const displayDate = scheduleDateFormatter(timezone);
  const scheduledTeams = new Set(Object.entries(schedule.games).filter(([, games]) => games.some((game) => displayDate(game) === date)).map(([team]) => team));
  const activeRoster = workspace.roster.filter((entry) => !isUnavailableRosterSlot(entry.slot));
  const skaters = activeRoster.filter((entry) => !entry.positions.includes('G') && scheduledTeams.has(entry.team));
  const goalieTeams = [...new Set(activeRoster.filter((entry) => entry.positions.includes('G') && scheduledTeams.has(entry.team)).map((entry) => entry.team))].sort();
  const slots = Object.entries(workspace.rosterRules.slots).flatMap(([slot, count]) => isInactiveRosterSlot(slot) || slot.toUpperCase() === 'G' ? [] : Array.from({ length: count }, (_, index) => `${slot}:${index}`));
  const assigned = new Map<number, number>();
  const match = (playerIndex: number, visited: Set<number>): boolean => {
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      if (visited.has(slotIndex) || !canPositionsFillSlot(skaters[playerIndex].positions, slots[slotIndex].split(':')[0])) continue;
      visited.add(slotIndex);
      const current = assigned.get(slotIndex);
      if (current === undefined || match(current, visited)) { assigned.set(slotIndex, playerIndex); return true; }
    }
    return false;
  };
  skaters.forEach((_, index) => match(index, new Set()));
  const skaterCapacity = assigned.size;
  return { scheduledSkaters: skaters.length, skaterCapacity, conflict: Math.max(0, skaters.length - skaterCapacity), goalieTeams, actionable: workspace.rosterRules.lockingMode === 'daily' };
}
