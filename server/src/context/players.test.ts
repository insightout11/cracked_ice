import { describe, expect, it } from 'vitest';
import { loadPlayers } from './players';

describe('canonical player context', () => {
  it('does not fall back to the deprecated 861-player server snapshot', () => {
    const context = loadPlayers();
    expect(context.meta.playerCount).toBe(1464);
    expect(context.meta.sourcePath).not.toMatch(/[\\/]server[\\/]data[\\/]players\.json$/);
    expect(context.entries.find((player) => player.id === 'nhl:8486067')?.name).toBe('Gavin McKenna');
  });
});
