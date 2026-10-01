import { describe, expect, it } from 'vitest';
import { loadDraftPlayerDirectory, loadPublicPlayerDetails } from './player-directory';

describe('canonical draft player directory', () => {
  it('includes Cole Hutson in the rankable pool despite his small NHL sample', () => {
    const directory = loadDraftPlayerDirectory();
    const cole = directory.players.find((player) => player.id === 'nhl:8484873');
    expect(cole).toBeDefined();
    expect(cole?.name).toBe('Cole Hutson');
    // His NHL sample is small (14 games in 2025-26); nhlGamesPlayed is this season's, so check the career.
    expect(cole?.careerGamesPlayed).toBeGreaterThan(0);
    expect(cole?.careerGamesPlayed).toBeLessThan(20);
    expect(cole?.blendedFppg).toBeGreaterThan(0);
    expect(cole?.projectionStatus).toBe('rookie-low-confidence');
  });

  it.each([
    ['nhl:8484873', 'Cole Hutson'],
    ['nhl:8486067', 'Gavin McKenna'],
    ['nhl:8485406', 'Porter Martone'],
    ['nhl:8486103', 'Ivar Stenberg'],
  ])('keeps priority rookie identity %s (%s)', (id, name) => {
    const player = loadDraftPlayerDirectory().players.find((candidate) => candidate.id === id);
    expect(player).toMatchObject({ id, name });
  });

  it('uses complete season and career samples for traded veterans', () => {
    const kadri = loadDraftPlayerDirectory().players.find((player) => player.id === 'nhl:8475172');
    // 2025-26: 61 games in Calgary and 16 in Colorado, one season of 77 (not the last stint's 16).
    expect(kadri?.name).toBe('Nazem Kadri');
    expect(kadri?.recentSeasons.find((season) => season.season === '20252026')?.gamesPlayed).toBe(77);
    expect(kadri?.careerGamesPlayed).toBeGreaterThan(1_000);
    expect(kadri?.projectionStatus).toBe('native');
  });

  it('does not treat junior stat lines as NHL production', () => {
    const directory = loadDraftPlayerDirectory({
      platform: 'custom',
      preset_name: 'KKUPFL',
    } as any);
    const coleBeaudoin = directory.players.find((player) => player.id === 'nhl:8484786');

    expect(coleBeaudoin).toMatchObject({
      name: 'Cole Beaudoin',
      nhlGamesPlayed: 0,
      careerGamesPlayed: 0,
      blendedFppg: null,
    });
  });

  it('serves complete public career details without a user workspace', () => {
    const miller = loadPublicPlayerDetails('8480817');

    expect(miller).toMatchObject({
      id: 'nhl:8480817',
      name: "K'Andre Miller",
      team: 'CAR',
    });
    // Six full seasons through 2025-26 (the current season is added as it's played).
    expect(Object.keys(miller?.careerHistory ?? {})).toEqual(expect.arrayContaining(['20202021', '20212022', '20222023', '20232024', '20242025', '20252026']));
    expect(miller?.careerSummary?.totalGames).toBeGreaterThan(400);
  });
});
