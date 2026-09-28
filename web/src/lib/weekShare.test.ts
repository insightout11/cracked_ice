import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { weekShare } from './weekShare';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const player = (id: string, team: string, positions: string[], fppg: number, extra: Partial<RosterPlayer> = {}): RosterPlayer => ({ id, full_name: id, team, positions, games_played: 10, stats, blendedFppg: fppg, ...extra });
const game = (date: string, isOffNight = false) => ({ date, opponent: 'BOS', isHome: true, isOffNight });

describe('week share', () => {
  const base = createDefaultLeagueWorkspace({ id: 'week', timezone: 'UTC' });
  const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, D: 1, BN: 2 } }, schedule: { ...base.schedule, matchupWeekStart: 'monday' as const } };

  it('marks starts, bench nights and off-night starts across the matchup week', () => {
    const schedule = {
      TOR: [game('2026-10-05', true), game('2026-10-06')],
      ANA: [game('2026-10-06'), game('2026-10-08', true)],
      DAL: [game('2026-10-06')],
    };
    const roster = [player('Nylander', 'TOR', ['C'], 2.3), player('Gauthier', 'ANA', ['C'], 2.0), player('Harley', 'DAL', ['D'], 1.3), player('Hurt', 'DAL', ['C'], 3, { injuryStatus: 'O' })];
    const week = weekShare(workspace, roster, schedule, '2026-10-07', (p) => p.blendedFppg ?? 0);
    expect(week.start).toBe('2026-10-05');
    const cells = Object.fromEntries(week.rows.map((row) => [row.player.id, row.cells.slice(0, 4)]));
    expect(cells).toEqual({
      Nylander: ['off-start', 'start', null, null],
      Gauthier: [null, 'bench', null, 'off-start'],
      Harley: [null, 'start', null, null],
    });
    expect(week).toMatchObject({ games: 5, starts: 4, offNightStarts: 2, busyNights: 1 });
  });
});
