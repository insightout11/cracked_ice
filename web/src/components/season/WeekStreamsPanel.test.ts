import { describe, expect, it } from 'vitest';
import type { TeamWeek, WeeklySchedule } from '../../lib/schedule';
import { bestStreamingTeams, streamNote } from './WeekStreamsPanel';

const game = (isOffNight: boolean) => ({ opponent: 'X', home: true, isOffNight });

function team(code: string, nights: Array<[keyof TeamWeek['gamesByDay'], boolean]>): TeamWeek {
  return { team: code, gamesByDay: Object.fromEntries(nights.map(([day, off]) => [day, [game(off)]])) } as unknown as TeamWeek;
}

describe('best streaming teams', () => {
  it('ranks by games and off-night share, and explains each pick', () => {
    const schedule = {
      weekOf: '2026-09-28',
      days: [],
      teams: [
        team('AAA', [['Tue', true], ['Thu', true], ['Fri', true], ['Sun', true]]),
        team('BBB', [['Tue', false], ['Sat', false]]),
        team('CCC', [['Wed', true], ['Thu', true], ['Sat', false]]),
        team('DDD', []),
      ],
    } as unknown as WeeklySchedule;
    const streams = bestStreamingTeams(schedule, 3);
    expect(streams.map((stream) => stream.team)).toEqual(['AAA', 'CCC', 'BBB']);
    expect(streamNote(streams[0])).toBe('4 games, all on off-nights, back-to-back');
    expect(streamNote(streams[1])).toMatch(/^3 games, 2 on off-nights/);
  });
});
