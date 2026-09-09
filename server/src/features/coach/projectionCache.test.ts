import { describe, expect, it } from 'vitest';
import { getProjectionFingerprint } from './projectionCache';

const base = {
  workspaceId: 'user-a',
  roster: [{ id: '2', position: 'C', current_slot: 'C' }, { id: '1', position: 'LW', current_slot: 'BN' }],
  leagueProfile: { skater_scoring: { goals: 3 }, goalie_scoring: { wins: 4 }, lineup_slots: { C: 1, BN: 1 } },
  projectionSource: 'consensus',
  schedule: { lastRefreshed: '2026-09-08' },
  stats: { generatedAt: '2026-09-08', schemaVersion: '2' },
};

describe('projection cache fingerprint', () => {
  it('reuses equivalent normalized inputs', () => {
    const reordered = { ...base, roster: [...base.roster].reverse(), leagueProfile: { ...base.leagueProfile, lineup_slots: { BN: 1, C: 1 } } };
    expect(getProjectionFingerprint(base)).toBe(getProjectionFingerprint(reordered));
  });

  it.each([
    ['scoring', { leagueProfile: { ...base.leagueProfile, skater_scoring: { goals: 4 } } }],
    ['source', { projectionSource: 'season' }],
    ['assigned slot', { roster: [{ ...base.roster[0], current_slot: 'IR' }, base.roster[1]] }],
    ['eligibility', { roster: [{ ...base.roster[0], position: 'C/LW' }, base.roster[1]] }],
    ['data version', { stats: { generatedAt: '2026-09-09', schemaVersion: '2' } }],
    ['workspace', { workspaceId: 'user-b' }],
  ])('invalidates when %s changes', (_label, change) => {
    expect(getProjectionFingerprint(base)).not.toBe(getProjectionFingerprint({ ...base, ...change }));
  });
});
