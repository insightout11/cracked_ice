import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace, type LeagueWorkspace } from './leagueWorkspace';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };

function demoPlayer(id: string, name: string, fppg: number, dates: string[]) {
  const player: RosterPlayer = {
    id,
    full_name: name,
    team: 'DEMO',
    positions: ['C'],
    games_played: 0,
    stats,
  };
  const projection: PlayerProjection = {
    fppg,
    starts: dates.length,
    gamesAvailable: dates.length,
    projectedPoints: fppg * dates.length,
    offNightRate: 0.5,
    strengthOfSchedule: 50,
    startsByDate: Object.fromEntries(dates.map((date) => [date, 1])),
    gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'DEMO', isHome: true, isOffNight: true, startTime: '' }])),
  };
  return { player, projection };
}

export function createStreamingDemo(baseWorkspace?: LeagueWorkspace) {
  const workspace = baseWorkspace
    ? structuredClone(baseWorkspace)
    : createDefaultLeagueWorkspace({ now: '2026-07-22T00:00:00.000Z', timezone: 'UTC' });
  const start = '2026-10-01';
  const end = '2026-10-07';
  workspace.rosterRules.slots = { C: 1, BN: 3 };
  workspace.rosterRules.lockingMode = 'daily';
  workspace.acquisitions = { limit: 3, movesUsed: 0, period: 'matchup', addTiming: 'same-day', waiverDelayDays: 0 };

  const base = demoPlayer('demo-base', 'Current center', 1, ['2026-10-01']);
  const first = demoPlayer('demo-first', 'Thursday-Friday target', 5, ['2026-10-01', '2026-10-02']);
  const second = demoPlayer('demo-second', 'Weekend target', 5, ['2026-10-03', '2026-10-04']);
  const third = demoPlayer('demo-third', 'Monday-Tuesday target', 5, ['2026-10-05', '2026-10-06']);
  const candidates = [first, second, third];

  workspace.roster = [{
    playerId: base.player.id,
    fullName: base.player.full_name,
    team: base.player.team,
    positions: base.player.positions,
    slot: 'C',
    keeper: false,
    protected: false,
    undroppable: false,
  }];
  workspace.candidates = candidates.map(({ player }) => ({
    playerId: player.id,
    availability: 'user-confirmed' as const,
    observedAt: '2026-09-30T12:00:00.000Z',
    expiresAt: '2026-10-01T12:00:00.000Z',
  }));

  return {
    workspace,
    roster: [base.player],
    candidates: candidates.map(({ player }) => player),
    projections: Object.fromEntries([base, ...candidates].map(({ player, projection }) => [player.id, projection])) as Record<string, PlayerProjection>,
    window: { start, end },
  };
}
