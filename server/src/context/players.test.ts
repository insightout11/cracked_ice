import { describe, expect, it } from 'vitest';
import { loadPlayers } from './players';

describe('canonical player context', () => {
  it('does not fall back to the deprecated 861-player server snapshot', () => {
    const context = loadPlayers();
    // The canonical directory grows with signings and call-ups (1,464 on 2026-09-09,
    // 1,490 on 2026-09-23); the guard is against the far smaller deprecated snapshot.
    expect(context.meta.playerCount).toBeGreaterThan(1400);
    expect(context.meta.sourcePath).not.toMatch(/[\\/]server[\\/]data[\\/]players\.json$/);
    expect(context.entries.find((player) => player.id === 'nhl:8486067')?.name).toBe('Gavin McKenna');
  });
});
