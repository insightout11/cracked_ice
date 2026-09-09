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
});
