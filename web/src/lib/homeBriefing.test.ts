import { describe, expect, it } from 'vitest';
import { buildPublicBriefing, calculateHomeCapacity, hockeyDateAt } from './homeBriefing';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';

const schedule = { games: {
  TOR: [{ date: '2026-10-10', opponent: 'MTL', isHome: true, startTime: '2026-10-10T23:00:00Z' }],
  MTL: [{ date: '2026-10-10', opponent: 'TOR', isHome: false, startTime: '2026-10-10T23:00:00Z' }],
  EDM: [{ date: '2026-10-11', opponent: 'CGY', isHome: true }],
  CGY: [{ date: '2026-10-11', opponent: 'EDM', isHome: false }],
} };

describe('home public briefing', () => {
  it('deduplicates team schedule rows and finds the next light slate', () => {
    const result = buildPublicBriefing(schedule, '2026-10-10');
    expect(result.gameCount).toBe(1);
    expect(result.matchups[0]).toMatchObject({ away: 'MTL', home: 'TOR' });
    expect(result.nextLightDate).toBe('2026-10-10');
  });

  it('uses the selected timezone at a date boundary', () => {
    const instant = new Date('2026-10-10T18:30:00Z');
    expect(hockeyDateAt(instant, 'Asia/Bangkok')).toBe('2026-10-11');
    expect(hockeyDateAt(instant, 'America/Toronto')).toBe('2026-10-10');
  });

  it('keeps NHL schedule calendar dates stable across timezones', () => {
    expect(buildPublicBriefing(schedule, '2026-10-11', 'Asia/Bangkok').gameCount).toBe(1);
    expect(buildPublicBriefing(schedule, '2026-10-10', 'Asia/Bangkok').gameCount).toBe(1);
  });
});

describe('home lineup capacity', () => {
  it('uses positional matching and keeps goalie schedules unconfirmed', () => {
    const base = createDefaultLeagueWorkspace({ id: 'capacity' });
    const workspace = { ...base, rosterRules: { slots: { C: 1, D: 1, G: 1, BN: 2 }, lockingMode: 'daily' as const }, roster: [
      { playerId: '1', fullName: 'Centre', team: 'TOR', positions: ['C'], keeper: false, protected: false, undroppable: false },
      { playerId: '2', fullName: 'Wing', team: 'MTL', positions: ['LW'], keeper: false, protected: false, undroppable: false },
      { playerId: '3', fullName: 'Goalie', team: 'TOR', positions: ['G'], keeper: false, protected: false, undroppable: false },
    ] };
    expect(calculateHomeCapacity(workspace, schedule, '2026-10-10', 'UTC')).toEqual({ scheduledSkaters: 2, skaterCapacity: 1, conflict: 1, goalieTeams: ['TOR'], actionable: true });
  });

  it('does not make an actionable weekly-lock claim', () => {
    const base = createDefaultLeagueWorkspace({ id: 'weekly' });
    expect(calculateHomeCapacity({ ...base, rosterRules: { ...base.rosterRules, lockingMode: 'weekly' } }, schedule, '2026-10-10', 'UTC').actionable).toBe(false);
  });

  it.each(['W', 'U', 'FLEX'])('fits a left wing into a flexible slot', (slot) => {
    const base = createDefaultLeagueWorkspace({ id: `capacity-${slot}` });
    const workspace = { ...base, rosterRules: { slots: { [slot]: 1, BN: 1 }, lockingMode: 'daily' as const }, roster: [
      { playerId: 'wing', fullName: 'Wing', team: 'TOR', positions: ['LW'], keeper: false, protected: false, undroppable: false },
    ] };
    expect(calculateHomeCapacity(workspace, schedule, '2026-10-10', 'UTC').skaterCapacity).toBe(1);
  });
});
