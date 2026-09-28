import { describe, expect, it } from 'vitest';
import type { RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { busyNights, startSitDecision, startSitText } from './startSit';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const player = (id: string, team: string, positions: string[], fppg: number, extra: Partial<RosterPlayer> = {}): RosterPlayer => ({ id, full_name: id, team, positions, games_played: 10, stats, blendedFppg: fppg, ...extra });
const game = (date: string, opponent: string, isHome = true, isOffNight = false) => ({ date, opponent, isHome, isOffNight, startTime: `${date}T23:00:00Z` });
const fppg = (p: RosterPlayer) => p.blendedFppg ?? 0;

describe('start/sit decision', () => {
  const base = createDefaultLeagueWorkspace({ id: 'ss', timezone: 'UTC' });
  const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, LW: 1, RW: 1, D: 1, BN: 3 } }, schedule: { ...base.schedule, matchupWeekStart: 'monday' as const } };
  const TUE = '2026-10-06';
  const schedule = {
    TOR: [game('2026-10-05', 'MTL'), game(TUE, 'MTL', true, true), game('2026-10-08', 'BOS')],
    CHI: [game(TUE, 'BOS', false)],
    ANA: [game(TUE, 'SJS'), game('2026-10-09', 'LAK')],
    DAL: [game(TUE, 'STL')],
    STL: [game(TUE, 'DAL', false)],
    WSH: [game(TUE, 'NYR')],
    VAN: [game('2026-10-07', 'CGY')],
  };

  it('puts a benched player and the starters he could replace on one ballot', () => {
    // Gauthier sits. Bedard is the only LW, so he's locked in; the choice is Nylander or Gauthier at C.
    const roster = [
      player('Nylander', 'TOR', ['C'], 2.3),
      player('Bedard', 'CHI', ['C', 'LW'], 2.2),
      player('Gauthier', 'ANA', ['C'], 2.0),
      player('Harley', 'DAL', ['D'], 1.3),
      player('Hurt', 'DAL', ['C'], 3, { injuryStatus: 'O' }),
      player('Idle', 'VAN', ['C'], 3),
    ];
    const decision = startSitDecision(workspace, roster, schedule, TUE, fppg)!;
    expect(decision.groups).toHaveLength(1);
    expect(decision.groups[0].contenders.map((c) => [c.letter, c.player.id, c.suggestedSit])).toEqual([['A', 'Nylander', false], ['B', 'Gauthier', true]]);
    expect(decision.groups[0]).toMatchObject({ label: 'forwards', sits: 1, spots: 1 });
    expect(decision.locked.map((p) => p.id).sort()).toEqual(['Bedard', 'Harley']);
    // Toronto plays Mon, Tue and Thu that week.
    expect(decision.groups[0].contenders[0].weekGames).toBe(3);
  });

  it('keeps a wing decision and a defence decision apart', () => {
    const roster = [
      player('Kucherov', 'TOR', ['RW'], 3.2),
      player('Snuggerud', 'STL', ['RW'], 1.5),
      player('Hutson', 'WSH', ['D'], 1.4),
      player('Buium', 'DAL', ['D'], 0.8),
    ];
    const decision = startSitDecision(workspace, roster, schedule, TUE, fppg)!;
    expect(decision.groups.map((group) => [group.label, group.contenders.map((c) => c.player.id)])).toEqual([
      ['forwards', ['Kucherov', 'Snuggerud']],
      ['defence', ['Hutson', 'Buium']],
    ]);
    expect(decision.sits).toBe(2);
  });

  it('has no decision when everyone fits, and lists the busy nights', () => {
    const roster = [player('Nylander', 'TOR', ['C'], 2.3), player('Gauthier', 'ANA', ['C'], 2.0), player('Harley', 'DAL', ['D'], 1.3)];
    expect(startSitDecision(workspace, roster, schedule, '2026-10-05', fppg)).toBeNull();
    expect(busyNights(workspace, roster, schedule, '2026-10-05', 5, fppg)).toEqual([{ date: TUE, sits: 1 }]);
  });

  it('writes the question as text for comment threads', () => {
    const roster = [player('Nylander', 'TOR', ['C'], 2.3), player('Gauthier', 'ANA', ['C'], 2.0)];
    const group = startSitDecision(workspace, roster, schedule, TUE, fppg)!.groups[0];
    const text = startSitText(TUE, group, { showPick: true });
    expect(text.split('\n')[0]).toBe('Start/sit, Tue, Oct 6 (forwards): 2 players, 1 sits');
    expect(text).toContain('A) Nylander (TOR vs MTL');
    expect(text).toContain('2.30 pts/game, 3 games this week, off-night');
    expect(text).toContain('Who sits?');
    expect(text).toContain('My tool says sit B.');
    expect(text.endsWith('(via crackedicehockey.com)')).toBe(true);
    expect(startSitText(TUE, group, { credit: false })).not.toContain('crackedicehockey');
  });
});
