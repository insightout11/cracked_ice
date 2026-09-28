import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { applyTransactions, mirrorOnRoster, parseYahooTransactions } from './transactionsImport';

// Copied from a Yahoo league's Transactions page; the last entry (an add/drop) is completed by hand.
const pasted = `Open chat
Transactions
Recent Transactions
All Teams

All Transactions

Added Players

Dropped Players

Trades

FAB Offers

Eetu Luostarinen FLA - LW
Free Agent
Industry Beauts
Sep 27, 2:03 pm
 logo

Joseph Woll PHI - G
Free Agent
CrackedOnIce
Sep 27, 12:17 pm
 logo

Easton Cowan TOR - LW
Free Agent
CrackedOnIce
Sep 27, 4:02 am
 logo


Sean Walker CAR - D
Free Agent
Teuvo Teravainen CHI - LW,RW
To Waivers
Goon Squad
Sep 26, 9:15 pm
 logo`;

const player = (id: string, name: string, team: string, pos: string[]): PlayerSearchResult => ({ id, name, team, pos, aliases: [], blendedFppg: 2 });
const directory = [
  player('nhl:1', 'Eetu Luostarinen', 'FLA', ['LW']),
  player('nhl:2', 'Joseph Woll', 'PHI', ['G']),
  player('nhl:3', 'Easton Cowan', 'TOR', ['LW']),
  player('nhl:4', 'Sean Walker', 'CAR', ['D']),
  player('nhl:5', 'Teuvo Teravainen', 'CHI', ['LW', 'RW']),
];

describe('pasted Yahoo transactions', () => {
  it('reads adds and drops per entry, oldest first', () => {
    const entries = parseYahooTransactions(pasted, '2026-09-28');
    expect(entries.map((entry) => [entry.fantasyTeam, entry.date, entry.moves.map((move) => `${move.kind} ${move.name}`)])).toEqual([
      ['Goon Squad', '2026-09-26', ['add Sean Walker', 'drop Teuvo Teravainen']],
      ['CrackedOnIce', '2026-09-27', ['add Easton Cowan']],
      ['CrackedOnIce', '2026-09-27', ['add Joseph Woll']],
      ['Industry Beauts', '2026-09-27', ['add Eetu Luostarinen']],
    ]);
  });

  it('dates in December read in January belong to last year', () => {
    const entries = parseYahooTransactions('Easton Cowan TOR - LW\nFree Agent\nCrackedOnIce\nDec 30, 1:00 pm', '2027-01-02');
    expect(entries[0].date).toBe('2026-12-30');
  });

  it('moves players between league rosters, reports your own moves, and replays safely', () => {
    const base = createDefaultLeagueWorkspace({ id: 'tx' });
    const workspace = {
      ...base,
      leagueRosters: {
        updatedAt: '2026-09-20T00:00:00.000Z',
        teams: [
          { name: 'Goon Squad', mine: false, playerIds: ['nhl:5'] },
          { name: 'CrackedOnIce', mine: true, playerIds: [] },
          { name: 'Industry Beauts', mine: false, playerIds: [] },
        ],
      },
    };
    const entries = parseYahooTransactions(pasted, '2026-09-28');
    const once = applyTransactions(workspace, directory, entries, '2026-09-28T12:00:00.000Z');
    expect(once.applied).toBe(5);
    expect(once.workspace.leagueRosters?.teams.map((team) => [team.name, team.playerIds])).toEqual([
      ['Goon Squad', ['nhl:4']],
      ['CrackedOnIce', ['nhl:3', 'nhl:2']],
      ['Industry Beauts', ['nhl:1']],
    ]);
    expect(once.mine.added.map((entry) => entry.name)).toEqual(['Easton Cowan', 'Joseph Woll']);
    const roster = mirrorOnRoster([{ playerId: 'nhl:9', fullName: 'Kept', team: 'VAN', positions: ['C'], keeper: false, protected: false, undroppable: false }], once.mine);
    expect(roster.map((entry) => [entry.playerId, entry.slot])).toEqual([['nhl:9', undefined], ['nhl:3', 'BN'], ['nhl:2', 'BN']]);
    const twice = applyTransactions(once.workspace, directory, entries, '2026-09-28T13:00:00.000Z');
    expect(twice.workspace.leagueRosters?.teams).toEqual(once.workspace.leagueRosters?.teams);
  });

  it('a later drop beats an earlier add of the same player on your team', () => {
    const base = createDefaultLeagueWorkspace({ id: 'tx3' });
    const workspace = { ...base, leagueRosters: { updatedAt: '2026-09-20T00:00:00.000Z', teams: [{ name: 'CrackedOnIce', mine: true, playerIds: [] }] } };
    const text = `Easton Cowan TOR - LW
To Waivers
CrackedOnIce
Sep 28, 9:00 am
Easton Cowan TOR - LW
Free Agent
CrackedOnIce
Sep 27, 4:02 am`;
    const result = applyTransactions(workspace, directory, parseYahooTransactions(text, '2026-09-28'), '2026-09-28T12:00:00.000Z');
    expect(result.mine.added).toEqual([]);
    expect(result.mine.dropped.map((player) => player.name)).toEqual(['Easton Cowan']);
    expect(result.workspace.leagueRosters?.teams[0].playerIds).toEqual([]);
  });

  it("flags teams that aren't in your league instead of applying them", () => {
    const base = createDefaultLeagueWorkspace({ id: 'tx2' });
    const workspace = { ...base, leagueRosters: { updatedAt: '2026-09-20T00:00:00.000Z', teams: [{ name: 'The Kim Kazzamz', mine: true, playerIds: [] }] } };
    const result = applyTransactions(workspace, directory, parseYahooTransactions(pasted, '2026-09-28'), '2026-09-28T12:00:00.000Z');
    expect(result.applied).toBe(0);
    expect(result.unknownTeams.sort()).toEqual(['CrackedOnIce', 'Goon Squad', 'Industry Beauts']);
  });
});
