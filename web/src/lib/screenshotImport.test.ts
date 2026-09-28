import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace, recordScreenshotAvailability } from './leagueWorkspace';
import { matchScreenshotPlayers, nhlTeam, parseYahooPlayersPaste, waiverDateFrom } from './screenshotImport';

const player = (id: string, name: string, team: string, pos: string[] = ['C']): PlayerSearchResult => ({ id, name, team, pos, aliases: [], blendedFppg: 2 });

describe('screenshot matching', () => {
  it('maps Yahoo team codes to NHL ones', () => {
    expect(nhlTeam('LA')).toBe('LAK');
    expect(nhlTeam('tb')).toBe('TBL');
    expect(nhlTeam('TOR')).toBe('TOR');
    expect(nhlTeam(null)).toBeNull();
  });

  it('matches names, lets the team settle duplicate names, and reports the rest', () => {
    const directory = [
      player('nhl:1', 'Sebastian Aho', 'CAR'),
      player('nhl:2', 'Sebastian Aho', 'NYI', ['D']),
      player('nhl:3', 'Anze Kopitar', 'LAK'),
    ];
    const { matched, unmatched } = matchScreenshotPlayers(directory, [
      { name: 'Sebastian Aho', team: 'NYI', positions: ['D'], status: 'FA', waiverDate: null },
      { name: 'Anze Kopitar', team: 'LA', positions: ['C'], status: 'W', waiverDate: '2026-09-29' },
      { name: 'Nobody Real', team: 'TOR', positions: ['C'], status: 'FA', waiverDate: null },
    ]);
    expect(matched.map((match) => match.player.id)).toEqual(['nhl:2', 'nhl:3']);
    expect(unmatched.map((row) => row.name)).toEqual(['Nobody Real']);
  });

  it('uses the position when two players share a name and a team', () => {
    const directory = [player('nhl:40', 'Elias Pettersson', 'VAN'), player('nhl:25', 'Elias Pettersson', 'VAN', ['D'])];
    const { matched } = matchScreenshotPlayers(directory, [{ name: 'Elias Pettersson', team: 'VAN', positions: ['D'], status: 'unknown', waiverDate: null }]);
    expect(matched.map((match) => match.player.id)).toEqual(['nhl:25']);
  });
});

describe('recording screenshot availability', () => {
  it('marks players available with their waiver date, and a later free-agent read clears it', () => {
    const workspace = createDefaultLeagueWorkspace({ id: 'shots' });
    const first = recordScreenshotAvailability(workspace.candidates, [{ playerId: 'nhl:3', waiverUntil: '2026-09-29' }], '2026-09-28T12:00:00.000Z');
    expect(first[0]).toMatchObject({ playerId: 'nhl:3', status: 'available', availability: 'screenshot-confirmed', waiverUntil: '2026-09-29' });
    const second = recordScreenshotAvailability(first, [{ playerId: 'nhl:3', waiverUntil: null }], '2026-09-30T12:00:00.000Z');
    expect(second).toHaveLength(1);
    expect(second[0].waiverUntil).toBeUndefined();
    expect(second[0].observedAt).toBe('2026-09-30T12:00:00.000Z');
  });
});

describe('pasted Yahoo player list', () => {
  const pasted = `Forwards/Defensemen
Opp: 9/28
Roster Status
GP*
Fan Pts


Ryan O'ReillyNo new player Notes
NSH - C
W (Sep 29)
81
155.90


Dylan CozensPlayer Note
OTT - C
W (Sep 29)
82
153.10


Pavel ZachaNo new player Notes
BOS - C,LW
FA
78
132.60


Kyle PalmieriO
NYI - RW
FA
61`;

  it('reads name, team, positions and waiver status from copied text', () => {
    expect(parseYahooPlayersPaste(pasted, '2026-09-28')).toEqual([
      { name: "Ryan O'Reilly", team: 'NSH', positions: ['C'], status: 'W', waiverDate: '2026-09-29' },
      { name: 'Dylan Cozens', team: 'OTT', positions: ['C'], status: 'W', waiverDate: '2026-09-29' },
      { name: 'Pavel Zacha', team: 'BOS', positions: ['C', 'LW'], status: 'FA', waiverDate: null },
      { name: 'Kyle Palmieri', team: 'NYI', positions: ['RW'], status: 'FA', waiverDate: null },
    ]);
  });

  it('puts waiver dates in the right year across New Year', () => {
    expect(waiverDateFrom('Jan', '3', '2026-12-30')).toBe('2027-01-03');
    expect(waiverDateFrom('Dec', '31', '2026-12-30')).toBe('2026-12-31');
    expect(waiverDateFrom('Mar', '5', '2027-03-01')).toBe('2027-03-05');
  });
});
