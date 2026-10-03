import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { confirmRosterReadiness, selectRosterReadiness, selectScheduleReadiness } from './homeReadiness';
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

  it('keeps a confirmation through adds, drops and lineup moves', () => {
    const empty = createDefaultLeagueWorkspace({ id: 'home-ready', now: '2026-09-09T00:00:00.000Z' });
    const one = { playerId: '1', fullName: 'One', team: 'TOR', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false };
    const confirmed = confirmRosterReadiness({ ...empty, roster: [one] }, '2026-09-09T01:00:00.000Z');
    const swapped = { ...confirmed, roster: [{ ...one, playerId: '2', fullName: 'Two', team: 'NYR', slot: 'BN' }] };
    expect(selectRosterReadiness(swapped)).toBe('ready');
  });

  it('honours confirmations saved before they ignored the players', () => {
    const empty = createDefaultLeagueWorkspace({ id: 'home-ready', now: '2026-09-09T00:00:00.000Z' });
    const one = { playerId: '1', fullName: 'One', team: 'TOR', positions: ['C'], keeper: false, protected: false, undroppable: false };
    const slots = Object.entries(empty.rosterRules.slots).sort(([a], [b]) => a.localeCompare(b));
    const revision = JSON.stringify({ season: empty.season.id, roster: [{ id: '9', team: 'EDM', positions: ['C'], slot: '' }], slots, lockingMode: empty.rosterRules.lockingMode });
    const workspace = { ...empty, roster: [one], rosterReadinessConfirmation: { revision, confirmedAt: '2026-09-09T01:00:00.000Z' } };
    expect(selectRosterReadiness(workspace)).toBe('ready');
  });

  it('needs no confirmation once every starting spot can be filled', () => {
    const empty = createDefaultLeagueWorkspace({ id: 'home-ready', now: '2026-09-09T00:00:00.000Z' });
    const starters = Object.entries(empty.rosterRules.slots).filter(([slot]) => !['BN', 'IR', 'IR+', 'NA'].includes(slot)).reduce((sum, [, count]) => sum + count, 0);
    const roster = Array.from({ length: starters }, (_, index) => ({ playerId: String(index + 1), fullName: `P${index}`, team: 'TOR', positions: ['C'], keeper: false, protected: false, undroppable: false }));
    expect(selectRosterReadiness({ ...empty, roster })).toBe('ready');
  });

  it('does not accept duplicate players', () => {
    const base = createDefaultLeagueWorkspace({ id: 'invalid' });
    const entry = { playerId: '1', fullName: 'One', team: 'TOR', positions: ['C'], keeper: false, protected: false, undroppable: false };
    expect(selectRosterReadiness({ ...base, roster: [entry, entry] })).toBe('needs-review');
  });

  it('keeps schedule failure separate from an empty slate', () => {
    expect(selectScheduleReadiness(null, false)).toBe('loading');
    expect(selectScheduleReadiness(null, true)).toBe('unavailable');
    expect(selectScheduleReadiness(completeSchedule(), false)).toBe('available');
  });

  it('rejects arbitrary empty team keys as schedule coverage', () => {
    const fake = { games: Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`T${index}`, []])) };
    expect(selectScheduleReadiness(fake, false)).toBe('incomplete');
  });
});
