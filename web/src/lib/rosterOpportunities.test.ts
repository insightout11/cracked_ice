import { describe, expect, it } from 'vitest';
import { calculateScheduleOpportunities, getScheduleFitLabel, structuralVacancyApplies, type ScheduleOpportunityRecommendation, type ScheduleRosterPlayer } from './rosterOpportunities';
import type { ScheduleData } from './rosterGapsUtils';
import seasonSchedule from '../../public/schedules-20262027.json';

function schedule(teams: Record<string, string[]>): ScheduleData {
  return { games: Object.fromEntries(Object.entries(teams).map(([team, dates]) => [team, dates.map((date) => ({ date }))])) };
}

describe('schedule-only roster opportunities', () => {
  const recommendation = (team: string, openings: number): ScheduleOpportunityRecommendation => ({
    team,
    teamGames: 10,
    addedOpportunities: openings,
    blockedGames: 10 - openings,
    standaloneGames: 0,
    opportunityDates: [],
    blockedDates: [],
    standaloneDates: [],
  });

  it('labels real schedule-fit ties without manufacturing alphabetical winners', () => {
    const recommendations = [recommendation('ANA', 8), recommendation('BOS', 8), recommendation('CAR', 4), recommendation('COL', 4)];
    expect(getScheduleFitLabel(recommendations, recommendations[0])).toBe('Tied best');
    expect(getScheduleFitLabel(recommendations, recommendations[1])).toBe('Tied best');
    expect(getScheduleFitLabel(recommendations, recommendations[2])).toBe('Tied worst');
    expect(getScheduleFitLabel(recommendations, recommendations[3])).toBe('Tied worst');
    expect(getScheduleFitLabel([recommendation('ANA', 8), recommendation('BOS', 8)], recommendation('ANA', 8))).toBeNull();
  });
  it('locks the Greaves-Wallstedt-Chicago acceptance case to the real season schedule', () => {
    const analysis = calculateScheduleOpportunities({
      roster: [
        { id: 'greaves', team: 'CBJ', positions: ['G'] },
        { id: 'wallstedt', team: 'MIN', positions: ['G'] },
      ],
      leagueProfile: { lineup_slots: { G: 2, BN: 4 } },
      scheduleData: seasonSchedule as ScheduleData,
      start: '2026-09-29',
      end: '2027-04-10',
    });
    const chicago = analysis.recommendations.G.find((team) => team.team === 'CHI');
    const newGoalieTeams = analysis.recommendations.G.filter((team) => !['CBJ', 'MIN'].includes(team.team));

    expect(chicago).toMatchObject({ teamGames: 84, addedOpportunities: 54, blockedGames: 30, standaloneGames: 18 });
    expect(newGoalieTeams[0]).toMatchObject({ team: 'NYR', addedOpportunities: 58 });
    expect(newGoalieTeams[newGoalieTeams.length - 1]).toMatchObject({ team: 'LAK', addedOpportunities: 41 });
  });

  it('recalculates an NYR RW against the visible KKUPFL forward roster', () => {
    const roster: ScheduleRosterPlayer[] = [
      { id: 'rantanen', team: 'DAL', positions: ['LW', 'RW'] },
      { id: 'bedard', team: 'CHI', positions: ['C', 'RW'] },
      { id: 'kucherov', team: 'TBL', positions: ['RW'] },
      { id: 'hyman', team: 'EDM', positions: ['LW', 'RW'] },
      { id: 'thomas', team: 'STL', positions: ['C'] },
      { id: 'ovechkin', team: 'WSH', positions: ['LW', 'RW'] },
      { id: 'misa', team: 'SJS', positions: ['C'] },
      { id: 'granlund', team: 'ANA', positions: ['C', 'LW'] },
    ];
    const analysis = calculateScheduleOpportunities({
      roster,
      leagueProfile: { lineup_slots: { C: 2, LW: 2, RW: 2, UTIL: 2, D: 4, G: 2, BN: 4 } },
      scheduleData: seasonSchedule as ScheduleData,
      start: '2026-09-29',
      end: '2027-04-10',
    });
    const nyr = analysis.recommendations.RW.find((team) => team.team === 'NYR');

    // Eight current forwards fill eight active forward slots. An NYR RW can be
    // shifted through RW/UTIL while the existing multi-position players move,
    // so it is blocked only when all eight forward schedules already fill the lineup.
    expect(nyr).toMatchObject({ teamGames: 84, addedOpportunities: 78, blockedGames: 6 });
  });

  it('shows that schedule cannot separate defensemen while two active D slots are empty', () => {
    const analysis = calculateScheduleOpportunities({
      roster: [
        { id: 'josi', team: 'NSH', positions: ['D'] },
        { id: 'carlson', team: 'TBL', positions: ['D'] },
      ],
      leagueProfile: { lineup_slots: { D: 4, BN: 4 } },
      scheduleData: seasonSchedule as ScheduleData,
      start: '2026-09-29',
      end: '2027-04-10',
    });

    expect(analysis.recommendations.D).toHaveLength(32);
    expect(analysis.recommendations.D.every((team) => team.addedOpportunities === 84)).toBe(true);
  });

  it('uses raw team schedules for goalies and ignores projected participation', () => {
    const makeDates = (offset: number, count: number) => Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.UTC(2026, 9, 1 + offset + index));
      return date.toISOString().slice(0, 10);
    });
    const dates = makeDates(0, 84);
    const cbj = [...dates.slice(0, 48), ...makeDates(100, 36)];
    const min = [...dates.slice(0, 30), ...dates.slice(48, 66), ...makeDates(136, 36)];
    const analysis = calculateScheduleOpportunities({
      roster: [
        { id: 'greaves', team: 'CBJ', positions: ['G'] },
        { id: 'wallstedt', team: 'MIN', positions: ['G'] },
      ],
      leagueProfile: { lineup_slots: { G: 2, BN: 4 } },
      scheduleData: schedule({ CHI: dates, CBJ: cbj, MIN: min }),
      start: '2026-10-01',
      end: '2027-12-31',
    });
    const chicago = analysis.recommendations.G.find((team) => team.team === 'CHI');

    expect(chicago).toMatchObject({ teamGames: 84, addedOpportunities: 54, blockedGames: 30, standaloneGames: 18 });
  });

  it('reassigns multi-position forwards before scoring an RW candidate', () => {
    const roster: ScheduleRosterPlayer[] = [
      { id: 'one', team: 'DAL', positions: ['LW', 'RW'] },
      { id: 'two', team: 'EDM', positions: ['C', 'RW'] },
    ];
    const analysis = calculateScheduleOpportunities({
      roster,
      leagueProfile: { lineup_slots: { C: 1, LW: 1, RW: 1, UTIL: 1 } },
      scheduleData: schedule({ DAL: ['2026-10-01'], EDM: ['2026-10-01'], NYR: ['2026-10-01'] }),
      start: '2026-10-01',
      end: '2026-10-01',
    });

    expect(analysis.recommendations.RW.find((team) => team.team === 'NYR')).toMatchObject({
      addedOpportunities: 1,
      blockedGames: 0,
    });
  });

  it('allows bench players to fill active slots while excluding injured-reserve players', () => {
    const analysis = calculateScheduleOpportunities({
      roster: [
        { id: 'bench-wing', team: 'DAL', positions: ['RW'], currentSlot: 'BN-0' },
        { id: 'injured-wing', team: 'EDM', positions: ['RW'], currentSlot: 'IR+-0' },
      ],
      leagueProfile: { lineup_slots: { RW: 1, BN: 2, 'IR+': 1 } },
      scheduleData: schedule({ DAL: ['2026-10-01'], EDM: ['2026-10-01'], NYR: ['2026-10-01'] }),
      start: '2026-10-01',
      end: '2026-10-01',
    });

    expect(analysis.unusedSlotsByDate['2026-10-01']).toBeUndefined();
    expect(analysis.recommendations.RW.find((team) => team.team === 'NYR')?.addedOpportunities).toBe(0);
  });

  it('reports every active slot type so visible daily columns can equal the total', () => {
    const analysis = calculateScheduleOpportunities({
      roster: [],
      leagueProfile: { lineup_slots: { C: 1, RW: 2, UTIL: 2, D: 4, G: 2, BN: 4 } },
      scheduleData: schedule({ NYR: ['2026-10-01'] }),
      start: '2026-10-01',
      end: '2026-10-01',
    });

    expect(analysis.unusedSlotsByDate['2026-10-01']).toEqual({ C: 1, RW: 2, UTIL: 2, D: 4, G: 2 });
    expect(analysis.totalOpenSlotOpportunities).toBe(11);
    expect(analysis.unfilledActiveSlots).toEqual({ C: 1, RW: 2, UTIL: 2, D: 4, G: 2 });
    expect(analysis.unfilledBenchSlots).toBe(4);
  });

  it('does not treat a generic F candidate as center eligible', () => {
    const analysis = calculateScheduleOpportunities({
      roster: [{ id: 'wing', team: 'DAL', positions: ['RW'] }],
      leagueProfile: { lineup_slots: { C: 1, F: 1 } },
      scheduleData: schedule({ DAL: ['2026-10-01'], NYR: ['2026-10-01'] }),
      start: '2026-10-01',
      end: '2026-10-01',
    });

    expect(analysis.recommendations.F.find((team) => team.team === 'NYR')).toMatchObject({
      addedOpportunities: 0,
      blockedGames: 1,
    });
  });

  it('explains when a position ranking is driven by an interchangeable active-slot vacancy', () => {
    expect(structuralVacancyApplies('D', { D: 2 })).toBe(true);
    expect(structuralVacancyApplies('RW', { F: 1 })).toBe(true);
    expect(structuralVacancyApplies('LW', { W: 1 })).toBe(true);
    expect(structuralVacancyApplies('C', { UTIL: 1 })).toBe(true);
    expect(structuralVacancyApplies('G', { UTIL: 1 })).toBe(false);
    expect(structuralVacancyApplies('RW', { D: 2 })).toBe(false);
  });
});
