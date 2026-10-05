import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { likelyOwnedPlayerIds } from './pickupCandidateDiscovery';
import { applyStartingRosters, likelyOnWaivers, rostersAreFresh, guessMyStartingRosterTeam, matchStartingRosters, parseYahooStartingRosters, yahooLeagueIdFrom, yahooStartingRostersUrl } from './startingRostersImport';

// Trimmed from a real copy of the page, Yahoo's icon characters included.
const pasted = `Yahoo Sports Fantasy Hockey
Starting Rosters
Thu, Oct 1

Fri, Oct 2
Ladybugs 

Pos
Player
C\t
Connor McDavid
Connor McDavidPlayer Note
EDM - C
LW\t
Alex Ovechkin
Alex OvechkinPlayer Note
WSH - LW,RW
W, 5-2 @ CAR
G\t
--empty--
(Empty)
BN\t
Jesper Bratt
Jesper BrattNo new player Notes
NJ - LW,RW 
The Kim Kazzamz 

Pos
Player
C\t
Nick Suzuki
Nick SuzukiNo new player Notes
MTL - C 
D\t
Charlie McAvoy
Charlie McAvoyNANo new player Notes
BOS - D
IR\t
Brad Marchand
Brad MarchandIRPlayer Note
FLA - LW,RW
IR+\t
Aleksander Barkov
Aleksander BarkovDTDNew Player Note
FLA - C`;

const player = (id: string, name: string, team: string, pos: string[]): PlayerSearchResult => ({ id, name, team, pos, aliases: [], blendedFppg: 2 });
const directory = [
  player('nhl:1', 'Connor McDavid', 'EDM', ['C']),
  player('nhl:2', 'Alex Ovechkin', 'WSH', ['LW']),
  player('nhl:3', 'Jesper Bratt', 'NJD', ['LW']),
  player('nhl:4', 'Nick Suzuki', 'MTL', ['C']),
  player('nhl:5', 'Charlie McAvoy', 'BOS', ['D']),
  player('nhl:6', 'Brad Marchand', 'FLA', ['LW']),
  player('nhl:7', 'Aleksander Barkov', 'FLA', ['C']),
];

describe('pasted Yahoo Starting Rosters', () => {
  it('reads every team with each player\'s slot, NHL team, positions and status', () => {
    const teams = parseYahooStartingRosters(pasted);
    expect(teams.map((team) => team.name)).toEqual(['Ladybugs', 'The Kim Kazzamz']);
    expect(teams[0].players).toEqual([
      { slot: 'C', name: 'Connor McDavid', team: 'EDM', positions: ['C'], status: null },
      { slot: 'LW', name: 'Alex Ovechkin', team: 'WSH', positions: ['LW', 'RW'], status: null },
      { slot: 'BN', name: 'Jesper Bratt', team: 'NJ', positions: ['LW', 'RW'], status: null },
    ]);
    expect(teams[1].players.map((row) => [row.slot, row.name, row.status])).toEqual([
      ['C', 'Nick Suzuki', null],
      ['D', 'Charlie McAvoy', 'NA'],
      ['IR', 'Brad Marchand', 'IR'],
      ['IR+', 'Aleksander Barkov', 'DTD'],
    ]);
  });

  it('finds nothing in other Yahoo pages', () => {
    expect(parseYahooStartingRosters('Draft Results\nRound 1\n1.\tConnor McDavid\n(EDM - C)\nLadybugs')).toEqual([]);
  });

  it('replaces the league rosters and your own lineup, keeping your marks', () => {
    const teams = parseYahooStartingRosters(pasted);
    const { matched, unmatched } = matchStartingRosters(directory, teams);
    expect(unmatched).toEqual([]);
    const base = createDefaultLeagueWorkspace({ id: 'league', name: 'League' });
    const workspace = {
      ...base,
      roster: [
        { playerId: 'nhl:4', fullName: 'Nick Suzuki', team: 'MTL', positions: ['C'], slot: 'BN', keeper: true, protected: false, undroppable: true },
        { playerId: 'nhl:99', fullName: 'Dropped Guy', team: 'SEA', positions: ['D'], slot: 'BN', keeper: false, protected: false, undroppable: false },
      ],
      leagueRosters: { teams: [{ name: 'The Kim Kazzamz', mine: true, playerIds: ['nhl:99'] }], updatedAt: '2026-09-28T00:00:00.000Z' },
    };
    expect(guessMyStartingRosterTeam(workspace, teams)).toBe('The Kim Kazzamz');
    const next = applyStartingRosters(workspace, matched, teams, 'The Kim Kazzamz', '2026-10-03T00:00:00.000Z');
    expect(next.numberOfTeams).toBe(2);
    expect(next.leagueRosters?.teams).toEqual([
      { name: 'Ladybugs', mine: false, playerIds: ['nhl:1', 'nhl:2', 'nhl:3'] },
      { name: 'The Kim Kazzamz', mine: true, playerIds: ['nhl:4', 'nhl:5', 'nhl:6', 'nhl:7'] },
    ]);
    expect(next.roster.map((entry) => [entry.playerId, entry.slot, entry.keeper, entry.undroppable])).toEqual([
      ['nhl:4', 'C', true, true],
      ['nhl:5', 'D', false, false],
      ['nhl:6', 'IR', false, false],
      ['nhl:7', 'IR+', false, false],
    ]);
    expect(likelyOwnedPlayerIds(next, directory)).not.toContain('nhl:99');
    // Rostered last time, on no team now: just dropped, so probably on waivers for a few days.
    const now = new Date('2026-10-03T00:00:00.000Z').getTime();
    expect(likelyOnWaivers(next, 'nhl:99', now)).toBe(true);
    expect(likelyOnWaivers(next, 'nhl:99', now + 4 * 86_400_000)).toBe(false);
    expect(likelyOnWaivers(next, 'nhl:1', now)).toBe(false);
    expect(rostersAreFresh(next, now + 86_400_000)).toBe(true);
    expect(rostersAreFresh(next, now + 4 * 86_400_000)).toBe(false);
  });

  it('can leave your own roster alone', () => {
    const teams = parseYahooStartingRosters(pasted);
    const { matched } = matchStartingRosters(directory, teams);
    const base = createDefaultLeagueWorkspace({ id: 'league', name: 'League' });
    expect(applyStartingRosters(base, matched, teams, 'Ladybugs', '2026-10-03T00:00:00.000Z', false).roster).toEqual(base.roster);
  });

  it('reads the league number from a Yahoo link', () => {
    expect(yahooLeagueIdFrom('https://hockey.fantasysports.yahoo.com/hockey/15713/startingrosters')).toBe('15713');
    expect(yahooLeagueIdFrom('https://hockey.fantasysports.yahoo.com/hockey/15713')).toBe('15713');
    expect(yahooLeagueIdFrom(' 15713 ')).toBe('15713');
    expect(yahooLeagueIdFrom('https://example.com/hockey/15713')).toBeNull();
    expect(yahooStartingRostersUrl('15713')).toBe('https://hockey.fantasysports.yahoo.com/hockey/15713/startingrosters');
  });
});
