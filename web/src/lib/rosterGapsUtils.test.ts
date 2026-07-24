import { describe, expect, it } from 'vitest';
import { buildGapSimulationRoster, calculatePositionSpecificRecommendations, countPositionGapDates, filterUnusedSlotsToGameDates } from './rosterGapsUtils';

describe('roster gap utilities', () => {
  it('removes league-wide off days from actionable roster gaps', () => {
    expect(filterUnusedSlotsToGameDates({
      '2026-10-01': { RW: 1 },
      '2026-10-02': { RW: 1 },
    }, {
      games: {
        TBL: [{ date: '2026-10-02' }],
      },
    })).toEqual({
      '2026-10-02': { RW: 1 },
    });
  });

  it('builds the same removal-simulation request for indexed and IR+ slots', () => {
    const roster = buildGapSimulationRoster([
      { player: { id: 'drop' }, slot: 'RW-0' },
      { player: { id: 'center' }, slot: 'C-1' },
      { player: { id: 'injured' }, slot: 'IR+-0' },
    ], 'drop');

    expect(roster).toEqual([
      { playerId: 'center', slot: 'C' },
      { playerId: 'injured', slot: 'IR+' },
    ]);
  });

  it('ranks team schedules only against dates with a gap at the requested position', () => {
    const gaps = {
      '2026-10-01': { C: 1 },
      '2026-10-02': { RW: 1 },
      '2026-10-03': { C: 2 },
    };
    const recommendations = calculatePositionSpecificRecommendations(gaps, {
      games: {
        TBL: [{ date: '2026-10-01' }, { date: '2026-10-03' }],
        ANA: [{ date: '2026-10-01' }, { date: '2026-10-02' }],
        NYR: [{ date: '2026-10-02' }],
      },
    });

    expect(recommendations.C).toEqual([
      { team: 'TBL', gapDatesCovered: 2, gapDates: ['2026-10-01', '2026-10-03'] },
      { team: 'ANA', gapDatesCovered: 1, gapDates: ['2026-10-01'] },
    ]);
    expect(recommendations.RW).toEqual([
      { team: 'ANA', gapDatesCovered: 1, gapDates: ['2026-10-02'] },
      { team: 'NYR', gapDatesCovered: 1, gapDates: ['2026-10-02'] },
    ]);
    expect(countPositionGapDates(gaps, 'C')).toBe(2);
  });
});
