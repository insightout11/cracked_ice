import { describe, expect, it } from 'vitest';
import { calculateTeamStreamingValues, getGapDayLabels, selectScheduleTeams } from './scheduleOpportunity';
import type { DayId, TeamWeek, WeeklySchedule } from './schedule';

const days = [
  { id: 'Mon' as DayId, date: 'Oct 5' },
  { id: 'Tue' as DayId, date: 'Oct 6' },
  { id: 'Wed' as DayId, date: 'Oct 7' },
];
const emptyDays = (): TeamWeek['gamesByDay'] => ({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] });
const team = (code: string, gameDays: DayId[]): TeamWeek => ({
  team: code,
  teamName: code,
  logo: '',
  gamesByDay: Object.assign(emptyDays(), Object.fromEntries(gameDays.map((day) => [day, [{ opponent: 'BOS', opponentLogo: '', home: true, start: '', isOffNight: true }]]))),
});
const schedule: WeeklySchedule = { weekOf: '2026-10-05', days, teams: [team('ANA', ['Mon', 'Tue']), team('BOS', ['Tue', 'Wed'])] };

describe('schedule opportunity', () => {
  it('counts one usable start per gap night rather than every open slot', () => {
    const values = calculateTeamStreamingValues(schedule, {
      '2026-10-05': { C: 2, LW: 1 },
      '2026-10-06': { C: 0 },
      '2026-10-07': { RW: 1 },
    }, []);

    expect(values.ANA).toMatchObject({ extraUsableStarts: 1, gapDatesCovered: ['2026-10-05'], representedOnRoster: false });
    expect(values.BOS).toMatchObject({ extraUsableStarts: 1, gapDatesCovered: ['2026-10-07'], representedOnRoster: false });
    expect(getGapDayLabels(schedule, { '2026-10-05': { C: 2 }, '2026-10-07': { RW: 1 } })).toEqual(['Mon', 'Wed']);
  });

  it('keeps opportunity visible for roster teams while identifying that they are already represented', () => {
    const values = calculateTeamStreamingValues(schedule, { '2026-10-05': { C: 1 }, '2026-10-06': { C: 1 } }, ['ANA']);
    expect(values.ANA).toMatchObject({ extraUsableStarts: 2, representedOnRoster: true });
  });

  it('filters to roster teams without disturbing the current schedule order', () => {
    expect(selectScheduleTeams(schedule.teams, 'roster', 'schedule', ['BOS'], {}).map((item) => item.team)).toEqual(['BOS']);
  });

  it('ranks opportunity first, then weekly games and team code', () => {
    const teams = [team('ANA', ['Mon']), team('BOS', ['Tue', 'Wed']), team('CAR', ['Mon', 'Wed'])];
    expect(selectScheduleTeams(teams, 'league', 'opportunity', [], {
      ANA: { team: 'ANA', extraUsableStarts: 2, gapDatesCovered: [], representedOnRoster: false },
      BOS: { team: 'BOS', extraUsableStarts: 1, gapDatesCovered: [], representedOnRoster: false },
      CAR: { team: 'CAR', extraUsableStarts: 1, gapDatesCovered: [], representedOnRoster: false },
    }).map((item) => item.team)).toEqual(['ANA', 'BOS', 'CAR']);
  });
});
