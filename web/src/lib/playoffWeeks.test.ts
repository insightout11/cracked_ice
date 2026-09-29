import { describe, expect, it } from 'vitest';
import { calculatePlayoffPresetRange, defaultPlayoffWeeks, generateSeasonWeeks, getPlayoffPresetOptions, parseWeekPreset } from './playoffCalculations';
import { calculateBeforePlayoffsEndDate, DEFAULT_SEASON_BOUNDS, formatDate } from './timeWindow';
import { formatWeekRangeWithYahoo, yahooWeeksDiffer } from './yahooWeekConversion';

describe('season weeks', () => {
  it('counts the opening Tuesday-to-Sunday as week 1, as Yahoo does, in UTC calendar days', () => {
    const weeks = generateSeasonWeeks(DEFAULT_SEASON_BOUNDS, 'monday');
    expect([formatDate(weeks[0].startDate), formatDate(weeks[0].endDate)]).toEqual(['2026-09-29', '2026-10-04']);
    expect([formatDate(weeks[1].startDate), formatDate(weeks[1].endDate)]).toEqual(['2026-10-05', '2026-10-11']);
    const last = weeks[weeks.length - 1];
    expect([last.weekNumber, formatDate(last.startDate), formatDate(last.endDate)]).toEqual([28, '2027-04-05', '2027-04-10']);
  });

  it('takes the default playoff weeks from the configured playoff dates', () => {
    expect(defaultPlayoffWeeks()).toEqual([26, 27, 28]);
    expect(getPlayoffPresetOptions().map((option) => option.value)).toEqual(['weeks-26-28', 'weeks-25-27', 'league-weeks', 'custom']);
  });

  it('ends "before playoffs" the day before the configured playoffs start', () => {
    expect(formatDate(calculateBeforePlayoffsEndDate())).toBe('2027-03-21');
  });

  it('still reads older week presets from saved links', () => {
    expect(parseWeekPreset('weeks-24-26')).toEqual([24, 26]);
    const range = calculatePlayoffPresetRange('weeks-24-26');
    expect([formatDate(range.start), formatDate(range.end)]).toEqual(['2027-03-08', '2027-03-28']);
  });
});

describe('Yahoo week numbers', () => {
  it('match ours this season, so no Yahoo numbers or warning are shown', () => {
    expect(yahooWeeksDiffer()).toBe(false);
    expect(formatWeekRangeWithYahoo(26, 28)).toBe('Weeks 26-28');
  });
});
