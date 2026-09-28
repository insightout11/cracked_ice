import { describe, expect, it } from 'vitest';
import type { PlayerSearchResult } from '../types';
import { createDefaultLeagueWorkspace, recordScreenshotAvailability } from './leagueWorkspace';
import { matchScreenshotPlayers, nhlTeam } from './screenshotImport';

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
