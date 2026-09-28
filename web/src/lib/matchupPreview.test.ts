import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { matchupPreview } from './matchupPreview';

const player = (id: string, team: string, positions: string[], fppg = 2, extra: Partial<RosterPlayer> = {}): RosterPlayer => ({
  id, full_name: id, team, positions, games_played: 10, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 }, blendedFppg: fppg, ...extra,
});

describe('matchup preview', () => {
  const workspace = { ...createDefaultLeagueWorkspace({ id: 'matchup' }), rosterRules: { ...createDefaultLeagueWorkspace({ id: 'x' }).rosterRules, slots: { C: 1, D: 1, G: 1, BN: 3 } } };
  const teamGames = { VAN: ['2026-10-06', '2026-10-08'], EDM: ['2026-10-06'], CGY: ['2026-10-07', '2026-10-08'] };
  const week = { start: '2026-10-05', end: '2026-10-11', today: '2026-10-07' };

  it('counts starts per day with the best lineup, empty spots and goalie games', () => {
    const mine = [player('c1', 'VAN', ['C'], 3), player('c2', 'EDM', ['C'], 2), player('g1', 'VAN', ['G'], 4)];
    const theirs = [player('d1', 'CGY', ['D'], 1), player('out', 'CGY', ['C'], 5, { injuryStatus: 'IR' })];
    const preview = matchupPreview(workspace, mine, theirs, teamGames, week);
    const tuesday = preview.days.find((day) => day.date === '2026-10-06')!;
    // Two centres, one C spot: one starts, the D spot sits empty.
    expect(tuesday.mine).toEqual({ skaterStarts: 1, goalieGames: 1, openSkaterSpots: 1, points: 7 });
    expect(tuesday.past).toBe(true);
    // Remaining (Wed on): Thursday for me, Wednesday and Thursday for them; the injured player never counts.
    expect(preview.remaining.mine).toMatchObject({ skaterStarts: 1, goalieGames: 1 });
    expect(preview.remaining.theirs).toMatchObject({ skaterStarts: 2, goalieGames: 0, openSkaterSpots: 8 });
  });
});
