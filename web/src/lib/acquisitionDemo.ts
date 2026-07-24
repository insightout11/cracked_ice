import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { LeagueWorkspace } from './leagueWorkspace';
import { SEASON } from './season';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };

function dateAtOffset(offset: number): string {
  const date = new Date(`${SEASON.regularSeasonStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function player(id: string, name: string, currentSlot?: string): RosterPlayer {
  return { id, full_name: name, team: 'TEST', positions: ['RW'], current_slot: currentSlot, games_played: 0, stats };
}

function projection(fppg: number, offsets: number[]): PlayerProjection {
  const dates = offsets.map(dateAtOffset);
  return {
    fppg,
    starts: dates.length,
    gamesAvailable: dates.length,
    projectedPoints: fppg * dates.length,
    offNightRate: 0.5,
    strengthOfSchedule: 50,
    startsByDate: Object.fromEntries(dates.map((date) => [date, 1])),
    gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'TEST', isHome: true, isOffNight: true, startTime: '' }])),
  };
}

export function createAcquisitionDemo(workspace: LeagueWorkspace) {
  const anchor = player('demo-anchor', 'Protected anchor', 'RW');
  const current = player('demo-current', 'Current RW', 'BN');
  const candidate = player('demo-candidate', 'Candidate RW');
  const demoWorkspace: LeagueWorkspace = {
    ...workspace,
    rosterRules: { ...workspace.rosterRules, slots: { RW: 1, BN: 1 } },
    roster: [
      { playerId: anchor.id, fullName: anchor.full_name, team: anchor.team, positions: anchor.positions, slot: 'RW', keeper: false, protected: true, undroppable: false },
      { playerId: current.id, fullName: current.full_name, team: current.team, positions: current.positions, slot: 'BN', keeper: false, protected: false, undroppable: false },
    ],
  };

  return {
    workspace: demoWorkspace,
    roster: [anchor, current],
    candidates: [candidate],
    projections: {
      [anchor.id]: projection(7, [0, 2, 4, 7, 9, 12]),
      [current.id]: projection(3, [1, 3, 6, 8, 9, 12]),
      [candidate.id]: projection(4, [0, 1, 3, 5, 8, 10, 12]),
    },
    expected: { candidateStarts: 5, candidateGames: 7, blockedGames: 2, startsDelta: 1, pointsDelta: 8 },
    window: { start: dateAtOffset(0), end: dateAtOffset(13) },
  };
}
