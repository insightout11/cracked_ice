import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { confirmRosterReadiness, selectPersonalizedAnalysisState, selectRosterReadiness, selectScheduleReadiness } from './homeReadiness';
import { NHL_TEAM_CODES } from './nhlTeams';
import { SEASON_GAMES_PER_TEAM, SEASON_START } from './season';

function completeSchedule() {
  return { games: Object.fromEntries(NHL_TEAM_CODES.map((team, index) => [team, Array.from({ length: SEASON_GAMES_PER_TEAM }, () => ({
    date: SEASON_START,
    opponent: NHL_TEAM_CODES[(index + 1) % NHL_TEAM_CODES.length],
    isHome: true,
  }))])) };
}

describe('home roster readiness', () => {
  it('distinguishes empty, incomplete, confirmed, and stale confirmations', () => {
    const empty = createDefaultLeagueWorkspace({ id: 'home-ready', now: '2026-09-09T00:00:00.000Z' });
    expect(selectRosterReadiness(empty)).toBe('none');
    const partial = { ...empty, roster: [{ playerId: '1', fullName: 'One', team: 'TOR', positions: ['C'], keeper: false, protected: false, undroppable: false }] };
    expect(selectRosterReadiness(partial)).toBe('incomplete');
    const confirmed = confirmRosterReadiness(partial, '2026-09-09T01:00:00.000Z');
    expect(selectRosterReadiness(confirmed)).toBe('ready');
    expect(selectRosterReadiness({ ...confirmed, rosterRules: { ...confirmed.rosterRules, lockingMode: 'weekly' } })).toBe('incomplete');
  });

  it('does not accept duplicate or unresolved players', () => {
    const base = createDefaultLeagueWorkspace({ id: 'invalid' });
    const entry = { playerId: '1', fullName: 'One', team: 'TOR', positions: ['C'], keeper: false, protected: false, undroppable: false };
    expect(selectRosterReadiness({ ...base, roster: [entry, entry] })).toBe('needs-review');
  });
  it('keeps schedule failure separate from an empty slate', () => {
    const complete = completeSchedule();
    expect(selectScheduleReadiness(null, false)).toBe('loading');
    expect(selectScheduleReadiness(null, true)).toBe('unavailable');
    expect(selectScheduleReadiness(complete, false)).toBe('available');
    const workspace = createDefaultLeagueWorkspace({ id: 'dimensions' });
    expect(selectPersonalizedAnalysisState(workspace, 'ready', 'unavailable')).toBe('blocked-schedule');
  });
  it('rejects arbitrary empty team keys as schedule coverage', () => {
    const fake = { games: Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`T${index}`, []])) };
    expect(selectScheduleReadiness(fake, false)).toBe('incomplete');
  });
  it('does not unlock an unusable roster or trust draft-session sync', () => {
    const base = createDefaultLeagueWorkspace({ id: 'invalid-confirm' });
    const entry = { playerId: '1', fullName: 'Unknown', team: 'TOR', positions: ['MYSTERY'], keeper: false, protected: false, undroppable: false };
    const unusable = { ...base, rosterRules: { slots: { BN: 4 }, lockingMode: 'daily' as const }, roster: [entry], draftSession: { ...base.draftSession, sync: { mode: 'provider' as const, status: 'synced' as const, provider: 'yahoo' as const } } };
    expect(selectRosterReadiness(confirmRosterReadiness(unusable))).toBe('needs-review');

    const draftSynced = { ...base, roster: [{ ...entry, positions: ['C'] }], draftSession: unusable.draftSession };
    expect(selectRosterReadiness(draftSynced)).toBe('incomplete');
  });
});
