import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { adviseAdds, findPickups, finderDays, openSpots, toFinderRosterPlayer, weeklySpots, type FinderInput } from './pickupFinder';

const player = (id: string, name: string, team: string, pos: string[], fppg: number, extra: Partial<PlayerSearchResult> = {}): PlayerSearchResult => ({ id, name, team, pos, aliases: [], blendedFppg: fppg, ...extra });

// Monday Oct 12 to Sunday Oct 18, 2026, planned from Monday noon.
const NOW = '2026-10-12T16:00:00Z';
const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];

function setup(limit: number | null = 2) {
  const base = createDefaultLeagueWorkspace({ id: 'l', name: 'Test' });
  const workspace = {
    ...base,
    schedule: { ...base.schedule, timezone: 'America/New_York', matchupWeekStart: 'monday' as const },
    rosterRules: { ...base.rosterRules, slots: { C: 1, D: 1, G: 1, BN: 1 } },
    acquisitions: { ...base.acquisitions, limit, period: 'week' as const, movesUsed: 0 },
    roster: [
      { playerId: 'nhl:1', fullName: 'Center Mine', team: 'TOR', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false },
      { playerId: 'nhl:2', fullName: 'Defence Mine', team: 'TOR', positions: ['D'], slot: 'D', keeper: true, protected: false, undroppable: false },
    ],
  };
  const directory = [
    player('nhl:1', 'Center Mine', 'TOR', ['C'], 3),
    player('nhl:2', 'Defence Mine', 'TOR', ['D'], 2),
    player('nhl:10', 'Goalie Free', 'NYR', ['G'], 6, { teamGamesPlayed: 10, recentSeasons: [{ season: '20262027', gamesPlayed: 6 }] } as Partial<PlayerSearchResult>),
    player('nhl:11', 'Center Free', 'NYR', ['C'], 2.5),
    player('nhl:12', 'Owned Star', 'NYR', ['C'], 9),
  ];
  const teamGames = { TOR: ['2026-10-12', '2026-10-14'], NYR: ['2026-10-13', '2026-10-15', '2026-10-17', '2026-10-18'] };
  const roster = workspace.roster.map((entry) => ({ ...toFinderRosterPlayer(directory.find((item) => item.id === entry.playerId)!), current_slot: entry.slot }));
  const input: FinderInput = { workspace, roster, directory, teamGames, ownedIds: ['nhl:12'], now: NOW };
  return { workspace, input };
}

describe('pickup finder', () => {
  it('covers the rest of this matchup week, or the next one', () => {
    const { workspace } = setup();
    expect(finderDays(workspace, 'week', NOW)).toEqual(week);
    expect(finderDays(workspace, 'next', NOW)[0]).toBe('2026-10-19');
    expect(finderDays(workspace, 'next', NOW)).toHaveLength(7);
  });

  it('shows the lineup spots your players leave open each day', () => {
    const { input } = setup();
    const spots = openSpots(input, week);
    expect(spots[0]).toMatchObject({ date: '2026-10-12', openTotal: 1, open: { G: 1 }, playing: 2 });
    expect(spots[1]).toMatchObject({ openTotal: 3, playing: 0 });
    expect(weeklySpots(input.workspace, spots)).toEqual([expect.objectContaining({ start: '2026-10-12', end: '2026-10-18', openTotal: 1 + 3 + 1 + 3 * 4 })]);
  });

  it('ranks unrostered players by the points they add on nights they would start', () => {
    const { input } = setup();
    const pickups = findPickups(input, week);
    expect(pickups.map((pickup) => pickup.player.name)).toEqual(['Goalie Free', 'Center Free']);
    const goalie = pickups[0];
    // Four games at a 60% start share: 2.4 expected starts, 6 points each.
    expect(goalie.games).toBe(4);
    expect(goalie.fills).toBeCloseTo(2.4);
    expect(goalie.gain).toBeCloseTo(4 * 6 * 0.6);
    // The bench is free, so nobody is dropped; owned players are never suggested.
    expect(goalie.drop).toBeNull();
  });

  it('holds an add when it gains less than keeping it, and uses adds on the last day', () => {
    const { input } = setup(2);
    const advice = adviseAdds(input, findPickups(input, week));
    expect(advice.remaining).toBe(2);
    expect(advice.use).toBeGreaterThanOrEqual(1);
    expect(advice.use + advice.hold).toBe(2);
    expect(advice.plan?.adds.map((add) => add.add.full_name)).toContain('Goalie Free');

    const sunday = { ...input, now: '2026-10-18T16:00:00Z' };
    const lastDay = adviseAdds(sunday, findPickups(sunday, ['2026-10-18']));
    expect(lastDay.holdValue).toBe(0);
  });
});
