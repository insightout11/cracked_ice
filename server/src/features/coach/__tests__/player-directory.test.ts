import { describe, expect, it } from 'vitest';
import { loadDraftPlayerDirectory } from '../../../../../api/_lib/player-directory';
import type { LeagueProfile } from '../types';

function profile(overrides: Partial<LeagueProfile> = {}): LeagueProfile {
  return {
    league_name: 'Test league',
    scoring_type: 'points',
    lineup_slots: { C: 2, LW: 2, RW: 2, D: 4, G: 2 },
    ...overrides,
  };
}

describe('draft player position eligibility', () => {
  it('uses Yahoo eligibility for Yahoo workspaces', () => {
    const { players, meta } = loadDraftPlayerDirectory(profile({ platform: 'yahoo' }));
    const positions = Object.fromEntries(players.map((player) => [player.name, player.pos]));

    expect(positions['Cutter Gauthier']).toEqual(['C', 'LW', 'RW']);
    expect(positions['Mitch Marner']).toEqual(['C', 'LW', 'RW']);
    expect(positions['Pavel Dorofeyev']).toEqual(['LW', 'RW']);
    expect(positions['Morgan Geekie']).toEqual(['C', 'LW', 'RW']);
    expect(positions['Martin Necas']).toEqual(['RW']);
    expect(positions['Nikolaj Ehlers']).toEqual(['LW']);
    expect(positions['Yegor Chinakhov']).toEqual(['LW', 'RW']);
    expect(players.find((player) => player.name === 'Mitch Marner')?.yahooAdp).toBeGreaterThan(0);
    expect(meta.eligibilitySource).toBe('yahoo');
    expect(meta.eligibilityUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('also recognizes the Yahoo preset for an unconnected manual league', () => {
    const { meta } = loadDraftPlayerDirectory(profile({ preset_name: 'Yahoo Standard' }));
    expect(meta.eligibilitySource).toBe('yahoo');
  });

  it('retains canonical positions for other league platforms', () => {
    const { players, meta } = loadDraftPlayerDirectory(profile({ platform: 'fantrax' }));
    expect(players.find((player) => player.name === 'Cutter Gauthier')?.pos).toEqual(['LW']);
    expect(players.find((player) => player.name === 'Mitch Marner')?.yahooAdp).toBeGreaterThan(0);
    expect(meta.eligibilitySource).toBe('canonical');
  });
});
