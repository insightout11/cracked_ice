import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerSearchResult } from '../../types';
import { PlayerRow } from './PlayerRow';

const player: PlayerSearchResult = {
  id: 'nhl:1',
  name: 'Schedule Target',
  aliases: [],
  team: 'NYR',
  pos: ['RW'],
  blendedFppg: 3,
  games_played: 40,
  stats: { goals: 10, assists: 20, points: 30, shots_on_goal: 100, blocks: 10, power_play_points: 5 },
};

describe('PlayerRow Pickup Board handoff', () => {
  it('offers a separate Pickup Board action without claiming availability', () => {
    const html = renderToStaticMarkup(<PlayerRow player={player} onAddToPickupBoard={vi.fn()} showAddButton={false} />);
    expect(html).toContain('Add to Pickup Board');
    expect(html).not.toContain('Free Agent');
  });

  it('shows that an existing target is already on the board', () => {
    const html = renderToStaticMarkup(<PlayerRow player={player} onAddToPickupBoard={vi.fn()} isOnPickupBoard showAddButton={false} />);
    expect(html).toContain('On Pickup Board');
    expect(html).toContain('disabled');
  });
});
