import { describe, expect, it } from 'vitest';
import { applyDraftProjectionSources, hasDraftProjection, isDraftRelevant, projectionStateLabel } from './draftProjectionCoverage';
import { parseDraftProjectionImport } from './draftProjectionImport';
import type { DraftPlayer } from './playerSearch';

function player(overrides: Partial<DraftPlayer>): DraftPlayer {
  return { id: 'nhl:1', name: 'Player One', team: 'WSH', pos: ['D'], aliases: [], blendedFppg: null, productionValue: null, productionLabel: 'FPPG', nhlGamesPlayed: 0, recentSeasons: [], scoringBreakdown: null, ...overrides };
}

describe('rookie and small-sample draft coverage', () => {
  it('keeps established and small-sample native projections rankable', () => {
    const [veteran, rookie] = applyDraftProjectionSources([
      player({ id: 'nhl:10', name: 'Veteran', blendedFppg: 4, nativeFppg: 4, nhlGamesPlayed: 82 }),
      player({ id: 'nhl:11', name: 'Cole Hutson', blendedFppg: 3.5, nativeFppg: 3.5, nhlGamesPlayed: 14 }),
    ], []);
    expect(hasDraftProjection(veteran)).toBe(true);
    expect(rookie.projectionStatus).toBe('rookie-low-confidence');
    expect(isDraftRelevant(rookie)).toBe(true);
  });

  it('makes a zero-game imported rookie rankable without changing identity', () => {
    const raw = player({ id: 'nhl:99', name: 'Rookie Name', team: 'MTL', pos: ['C'], blendedFppg: null });
    const [result] = applyDraftProjectionSources([raw], [{ id: 'custom', label: 'My projections', importedAt: new Date().toISOString(), projections: { '99': 3.25 } }]);
    expect(result).toMatchObject({ id: raw.id, name: raw.name, team: raw.team, pos: raw.pos, blendedFppg: 3.25, projectionStatus: 'imported-only' });
    expect(hasDraftProjection(result)).toBe(true);
    expect(projectionStateLabel(result)).toContain('Imported');
  });

  it('keeps a zero-game player searchable but unscored without evidence', () => {
    const [result] = applyDraftProjectionSources([player({})], []);
    expect(result.projectionStatus).toBe('unprojected');
    expect(hasDraftProjection(result)).toBe(false);
    expect(isDraftRelevant(result)).toBe(false);
    expect(projectionStateLabel(result)).toBe('No CI projection');
  });

  it('admits a market-only fixture but does not invent a recommendation score', () => {
    const [result] = applyDraftProjectionSources([player({ yahooAdp: 120 })], []);
    expect(result.projectionStatus).toBe('market-only');
    expect(isDraftRelevant(result)).toBe(true);
    expect(hasDraftProjection(result)).toBe(false);
    expect(result.blendedFppg).toBeNull();
  });

  it('matches imported rows by canonical id, name, or alias', () => {
    const source = player({ id: 'nhl:8484873', name: 'Cole Hutson', aliases: ['C. Hutson'] });
    expect(parseDraftProjectionImport('player,fppg\nCole Hutson,3.8', [source]).projections).toEqual({ '8484873': 3.8 });
  });
});
