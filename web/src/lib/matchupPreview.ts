import type { RosterPlayer } from './coachSchemas';
import { activeSlotCapacities } from './acquisitionAnalysis';
import type { LeagueWorkspace } from './leagueWorkspace';
import { bestDailyLineup, isOut } from './weekPlanner';

export interface MatchupSide {
  /** Skaters who can start (a game, not out, and a lineup spot for them). */
  skaterStarts: number;
  goalieGames: number;
  /** Skater lineup spots left empty. Streams fill these. */
  openSkaterSpots: number;
  points: number;
}

export interface MatchupDay {
  date: string;
  past: boolean;
  mine: MatchupSide;
  theirs: MatchupSide;
}

export interface MatchupPreview {
  days: MatchupDay[];
  /** Totals over the days still to play. */
  remaining: { mine: MatchupSide; theirs: MatchupSide };
}

const isGoalie = (player: RosterPlayer) => player.positions.length > 0 && player.positions.every((position) => position.toUpperCase() === 'G');
const fppg = (player: RosterPlayer) => player.blendedFppg ?? player.seasonFppg ?? 0;
const empty = (): MatchupSide => ({ skaterStarts: 0, goalieGames: 0, openSkaterSpots: 0, points: 0 });

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function side(workspace: LeagueWorkspace, roster: RosterPlayer[], teamGames: Record<string, string[]>, date: string, skaterSpots: number): MatchupSide {
  const playing = roster.filter((player) => !isOut(player) && player.current_slot?.toUpperCase().startsWith('IR') !== true && (teamGames[player.team] ?? []).includes(date));
  const skaters = playing.filter((player) => !isGoalie(player));
  const goalies = playing.filter(isGoalie);
  const lineup = bestDailyLineup(workspace, skaters, fppg);
  // Goalies: count games up to the goalie spots (not every game is a start).
  const goalieSpots = Object.entries(activeSlotCapacities(workspace)).filter(([slot]) => slot.toUpperCase() === 'G').reduce((sum, [, count]) => sum + count, 0);
  const goalieGames = Math.min(goalies.length, goalieSpots);
  const bestGoalies = goalies.map(fppg).sort((a, b) => b - a).slice(0, goalieGames);
  return {
    skaterStarts: lineup.started.length,
    goalieGames,
    openSkaterSpots: Math.max(0, skaterSpots - lineup.started.length),
    points: lineup.points + bestGoalies.reduce((sum, value) => sum + value, 0),
  };
}

/**
 * Both teams' matchup week from the NHL schedule: for each day, who can start
 * (the best lineup of players with a game), how many skater spots sit empty,
 * and projected points from season averages. Days before today are marked past.
 */
export function matchupPreview(
  workspace: LeagueWorkspace,
  mine: RosterPlayer[],
  theirs: RosterPlayer[],
  teamGames: Record<string, string[]>,
  week: { start: string; end: string; today: string },
): MatchupPreview {
  const skaterSpots = Object.entries(activeSlotCapacities(workspace)).filter(([slot]) => slot.toUpperCase() !== 'G').reduce((sum, [, count]) => sum + count, 0);
  const days: MatchupDay[] = [];
  for (let date = week.start; date <= week.end; date = addDays(date, 1)) {
    days.push({ date, past: date < week.today, mine: side(workspace, mine, teamGames, date, skaterSpots), theirs: side(workspace, theirs, teamGames, date, skaterSpots) });
  }
  const total = (key: 'mine' | 'theirs') => days.filter((day) => !day.past).reduce((sum, day) => ({
    skaterStarts: sum.skaterStarts + day[key].skaterStarts,
    goalieGames: sum.goalieGames + day[key].goalieGames,
    openSkaterSpots: sum.openSkaterSpots + day[key].openSkaterSpots,
    points: sum.points + day[key].points,
  }), empty());
  return { days, remaining: { mine: total('mine'), theirs: total('theirs') } };
}
