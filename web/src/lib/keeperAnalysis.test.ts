import { describe, expect, it } from 'vitest';
import { compareKeeperCandidates } from './keeperAnalysis';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import type { DraftPlayer } from './playerSearch';

function player(overrides: Partial<DraftPlayer> & Pick<DraftPlayer, 'id' | 'name'>): DraftPlayer {
  return {
    id: overrides.id,
    name: overrides.name,
    team: overrides.team ?? 'EDM',
    pos: overrides.pos ?? ['C'],
    aliases: [],
    blendedFppg: overrides.blendedFppg ?? 5,
    productionValue: overrides.blendedFppg ?? 5,
    productionLabel: 'FPPG',
    nhlGamesPlayed: overrides.nhlGamesPlayed ?? 70,
    birthDate: overrides.birthDate,
    avgToiPerGame: overrides.avgToiPerGame,
    ppTimeOnIcePerGame: overrides.ppTimeOnIcePerGame,
    recentSeasons: overrides.recentSeasons ?? [],
    scoringBreakdown: null,
  };
}

describe('keeper comparison', () => {
  it('changes the age/trajectory emphasis for a multi-year horizon', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    const veteran = player({ id: 'v', name: 'Veteran', blendedFppg: 6, birthDate: '1992-01-01', avgToiPerGame: 1_200, ppTimeOnIcePerGame: 240, recentSeasons: [{ season: '20252026', gamesPlayed: 75, pointsPerGame: 1.2 }, { season: '20242025', gamesPlayed: 78, pointsPerGame: 1.15 }] });
    const young = player({ id: 'y', name: 'Young Player', blendedFppg: 5.7, birthDate: '2003-01-01', avgToiPerGame: 1_170, ppTimeOnIcePerGame: 220, recentSeasons: [{ season: '20252026', gamesPlayed: 78, pointsPerGame: 1.1 }, { season: '20242025', gamesPlayed: 72, pointsPerGame: 0.8 }] });
    const peers = Array.from({ length: 12 }, (_, index) => player({ id: `p${index}`, name: `Peer ${index}`, blendedFppg: 5.5 - (index * 0.1), birthDate: '1998-01-01' }));

    workspace.keeperRules.horizon = 'next-season';
    const nextSeason = compareKeeperCandidates(veteran, young, [veteran, young, ...peers], workspace);
    workspace.keeperRules.horizon = 'two-to-three-years';
    const multiYear = compareKeeperCandidates(veteran, young, [veteran, young, ...peers], workspace);

    expect(nextSeason.optionA.factors.currentValue).toBeGreaterThan(nextSeason.optionB.factors.currentValue);
    expect(multiYear.optionB.factors.ageTrajectory).toBeGreaterThan(multiYear.optionA.factors.ageTrajectory);
    expect(multiYear.optionB.total - multiYear.optionA.total).toBeGreaterThan(nextSeason.optionB.total - nextSeason.optionA.total);
  });

  it('reports keeper cost and low confidence when evidence is sparse', () => {
    const workspace = createDefaultLeagueWorkspace();
    const candidate = player({ id: 'nhl:1', name: 'Candidate', nhlGamesPlayed: 5, birthDate: undefined, recentSeasons: [] });
    const comparison = player({ id: 'nhl:2', name: 'Comparison' });
    workspace.roster.push({ playerId: 'nhl:1', fullName: 'Candidate', team: 'EDM', positions: ['C'], keeper: true, keeperCost: { type: 'draft-round', round: 8 }, protected: false, undroppable: false });

    const result = compareKeeperCandidates(candidate, comparison, [candidate, comparison], workspace);
    expect(result.optionA.costLabel).toBe('Round 8');
    expect(result.optionA.confidence).toBe('low');
  });
});
