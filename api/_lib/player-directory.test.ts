import { describe, expect, it } from 'vitest';
import { loadDraftPlayerDirectory } from './player-directory';

describe('canonical draft player directory', () => {
  it('includes Cole Hutson in the rankable pool despite his small NHL sample', () => {
    const directory = loadDraftPlayerDirectory();
    const cole = directory.players.find((player) => player.id === 'nhl:8484873');
    expect(cole).toBeDefined();
    expect(cole?.name).toBe('Cole Hutson');
    expect(cole?.nhlGamesPlayed).toBeGreaterThan(0);
    expect(cole?.nhlGamesPlayed).toBeLessThan(20);
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
});
