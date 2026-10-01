import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createScheduleServer } from './mcp-server.js';
import {
  loadSchedule, matchPlayers, maxStarters, nightsBetween, resolveTeam, resolveWindow, rosterCheck, schedulePairs, teamsBetween, weekSummary,
  type DirectoryPlayer, type SeasonSchedule,
} from './schedule-tools.js';

const game = (date: string, gameId: number, opponent = 'XXX') => ({ date, gameId, opponent, isHome: true, startTime: `${date}T23:00:00Z` });
// Three nights: Oct 5 one game (off-night), Oct 6 one game, Oct 7 one game.
const schedule: SeasonSchedule = {
  season: '20262027',
  games: {
    AAA: [game('2026-10-05', 1, 'BBB'), game('2026-10-07', 3, 'CCC')],
    BBB: [game('2026-10-05', 1, 'AAA'), game('2026-10-06', 2, 'CCC')],
    CCC: [game('2026-10-06', 2, 'BBB'), game('2026-10-07', 3, 'AAA')],
  },
};

describe('schedule math', () => {
  it('counts each game once per night and labels off-nights', () => {
    const nights = nightsBetween(schedule, '2026-10-05', '2026-10-08');
    expect(nights.map((night) => [night.date, night.games, night.kind])).toEqual([
      ['2026-10-05', 1, 'off-night'], ['2026-10-06', 1, 'off-night'], ['2026-10-07', 1, 'off-night'], ['2026-10-08', 0, 'no games'],
    ]);
  });

  it('finds back-to-backs and ranks teams by games and off-night share', () => {
    const [first] = teamsBetween(schedule, '2026-10-05', '2026-10-07');
    expect(first.games).toBe(2);
    expect(teamsBetween(schedule, '2026-10-05', '2026-10-07').find((team) => team.team === 'BBB')?.backToBacks).toEqual([['2026-10-05', '2026-10-06']]);
  });

  it('pairs a team with the partner that covers the most nights without clashing', () => {
    const [best] = schedulePairs(schedule, '2026-10-05', '2026-10-07', 'BBB');
    expect(best.teams[0]).toBe('BBB');
    expect(best.nightsCovered).toBe(3);
  });

  it('resolves team names, nicknames and abbreviations', () => {
    expect(resolveTeam('Canucks')).toBe('VAN');
    expect(resolveTeam('vancouver')).toBe('VAN');
    expect(resolveTeam('TB')).toBe('TBL');
    expect(resolveTeam('Mammoth')).toBe('UTA');
    expect(resolveTeam('New York')).toBeNull();
  });

  it('keeps windows inside the season and caps their length', () => {
    expect(resolveWindow({ start: '2026-08-01', days: 3 })).toEqual({ start: '2026-09-29', end: '2026-10-01', days: 3 });
    expect(resolveWindow({ start: '2027-04-08', days: 30 }).end).toBe('2027-04-10');
    expect(() => resolveWindow({ start: 'next week' })).toThrow('YYYY-MM-DD');
  });
});

describe('roster check', () => {
  const players: DirectoryPlayer[] = [
    { id: '1', name: 'Elias Pettersson', team: 'VAN', pos: ['C'] },
    { id: '2', name: 'Elias Pettersson', team: 'VAN', pos: ['D'] },
    { id: '3', name: 'Marc-Andre Fleury', team: 'MIN', pos: ['G'] },
    { id: '4', name: 'Thatcher Demko', team: 'VAN', pos: ['G'] },
  ];

  it('matches names, uses hints for namesakes, and offers candidates instead of guessing', () => {
    const [ambiguous, centre, hyphen, surname] = matchPlayers(['Elias Pettersson', 'Elias Pettersson (VAN, C)', 'Marc-Andre Fleury', 'Demko'], players);
    expect(ambiguous.player).toBeUndefined();
    expect(ambiguous.candidates).toHaveLength(2);
    expect(centre.player?.id).toBe('1');
    expect(hyphen.player?.id).toBe('3');
    expect(surname.player?.id).toBe('4');
  });

  it('starts the most players a lineup allows, flexible players last', () => {
    // Two centres and a C/LW for 2 C + 1 LW: all three fit (the dual goes to LW).
    expect(maxStarters([['C', 'LW'], ['C'], ['C']], { C: 2, LW: 1 }).benched).toEqual([]);
    expect(maxStarters([['C'], ['C'], ['C']], { C: 2, UTIL: 0 }).benched).toHaveLength(1);
    expect(maxStarters([['C'], ['C'], ['C']], { C: 2, UTIL: 1 }).benched).toHaveLength(0);
    expect(maxStarters([['G']], { C: 2, UTIL: 1 }).benched).toEqual([0]);
  });

  it('counts benched games and open seats night by night', () => {
    const roster: DirectoryPlayer[] = [
      { id: 'a', name: 'A One', team: 'AAA', pos: ['C'] },
      { id: 'b', name: 'B Two', team: 'BBB', pos: ['C'] },
      { id: 'c', name: 'C Three', team: 'AAA', pos: ['C'] },
    ];
    const check = rosterCheck(schedule, roster, { C: 1 }, '2026-10-05', '2026-10-07');
    // Oct 5: AAA and BBB play, 3 centres for 1 seat -> 2 sit. Oct 6: BBB alone. Oct 7: AAA, 2 for 1.
    expect(check.perNight.map((night) => night.benchedGames)).toEqual([2, 0, 1]);
    expect(check.totals).toMatchObject({ games: 6, usableGames: 3, benchedGames: 3 });
  });
});

describe('real data', () => {
  it('loads the season schedule with every team', () => {
    const real = loadSchedule();
    expect(Object.keys(real.games)).toHaveLength(32);
    const week = weekSummary(real, '2026-10-05');
    expect(week.weekStart).toBe('2026-10-05');
    expect(week.nights).toHaveLength(7);
  });
});

describe('MCP server', () => {
  async function connect() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createScheduleServer();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('lists six read-only tools with instructions', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['check_roster_schedule', 'find_schedule_pairs', 'find_streaming_teams', 'get_team_schedule', 'get_weekly_nhl_schedule', 'rank_fantasy_playoff_schedules']);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.outputSchema)).toBe(true);
    expect(client.getInstructions()).toContain('off-nights');
  });

  it('answers every tool with structured data that matches its schema', async () => {
    const client = await connect();
    const calls: Array<[string, Record<string, unknown>]> = [
      ['get_weekly_nhl_schedule', { week_of: '2026-10-12' }],
      ['find_streaming_teams', { start_date: '2026-10-12', days: 7, limit: 5 }],
      ['get_team_schedule', { team: 'Canucks', start_date: '2026-10-12', days: 14 }],
      ['find_schedule_pairs', { team: 'VAN', start_date: '2026-10-12', days: 14 }],
      ['rank_fantasy_playoff_schedules', {}],
      ['check_roster_schedule', { players: ['Quinn Hughes', 'Connor McDavid', 'Nikita Kucherov', 'Not A Player'], start_date: '2026-10-12', days: 7 }],
    ];
    for (const [name, args] of calls) {
      const response = await client.callTool({ name, arguments: args });
      expect(response.isError, `${name}: ${JSON.stringify(response.content)}`).toBeFalsy();
      expect(response.structuredContent).toBeTruthy();
      expect((response.content as Array<{ text: string }>)[0].text).toContain('crackedicehockey.com');
    }
  });

  it('explains an unknown team instead of failing silently', async () => {
    const client = await connect();
    const response = await client.callTool({ name: 'get_team_schedule', arguments: { team: 'Quebec Nordiques' } });
    expect(response.isError).toBe(true);
    expect((response.content as Array<{ text: string }>)[0].text).toContain("couldn't match");
  });
});
