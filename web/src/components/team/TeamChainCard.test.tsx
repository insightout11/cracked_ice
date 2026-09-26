// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { createDefaultLeagueWorkspace } from '../../lib/leagueWorkspace';
import type { TeamChainResult } from '../../lib/weekPlanner';
import type { PlayerSearchResult } from '../../types';
import { TeamChainCard } from './TeamChainCard';

const TUE = '2026-09-29', WED = '2026-09-30', THU = '2026-10-01', FRI = '2026-10-02', SAT = '2026-10-03', SUN = '2026-10-04';
const dates = [TUE, WED, THU, FRI, SAT, SUN];
const leg = (team: string, from: string, to: string, games: string[], starts = games) => ({ team, from, to, actionDate: from, gameDates: games, startDates: starts, alternatives: [] });

const chains: TeamChainResult = {
  spot: { id: 'stream-x', kind: 'stream', holder: { id: 'x', full_name: 'Depth Guy', team: 'BOS', positions: ['C'], games_played: 0, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } }, holderPlays: true },
  dates,
  positions: [
    { position: 'C', room: Object.fromEntries(dates.map((date) => [date, date !== SAT])), chains: [
      { adds: 1, starts: 3, legs: [leg('NYR', TUE, SUN, [THU, FRI, SUN])] },
      { adds: 2, starts: 5, legs: [leg('TOR', TUE, WED, [TUE, WED]), leg('NYR', THU, SUN, [THU, FRI, SUN])] },
    ] },
    { position: 'D', room: Object.fromEntries(dates.map((date) => [date, true])), chains: [{ adds: 1, starts: 2, legs: [leg('VGK', TUE, SUN, [TUE, THU])] }] },
  ],
  bridgeTeams: ['WPG'],
};

const players = [
  { id: '1', name: 'Alexis Lafreniere', team: 'NYR', pos: ['LW', 'RW'], blendedFppg: 2 },
  { id: '2', name: 'Vincent Trocheck', team: 'NYR', pos: ['C'], blendedFppg: 2.4 },
  { id: '3', name: 'Adam Fox', team: 'NYR', pos: ['D'], blendedFppg: 3 },
] as unknown as PlayerSearchResult[];

describe('TeamChainCard', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('shows the best chain by team, and a team\'s players on click', () => {
    const onOpenPlayer = vi.fn();
    const workspace = createDefaultLeagueWorkspace({ now: '2026-09-01T00:00:00.000Z', timezone: 'UTC' });
    act(() => root.render(<TeamChainCard chains={chains} workspace={workspace} roster={[] as RosterPlayer[]} players={players} onOpenPlayer={onOpenPlayer} />));
    const text = container.textContent ?? '';
    expect(text).toContain('+5 lineup starts');
    expect(text).toContain('add any Maple Leafs C · drop Depth Guy');
    expect(text).toContain('swap to any Rangers C');
    expect(text).toContain('Jets play Sunday and next Monday');
    expect(container.querySelectorAll('[aria-label="starts"]')).toHaveLength(5);

    const rangers = container.querySelector('button[title="Show Rangers players"]') as HTMLButtonElement;
    act(() => rangers.click());
    expect(container.textContent).toContain('Vincent Trocheck');
    expect(container.textContent).not.toContain('Adam Fox');
    const name = container.querySelector('button[title="Open Vincent Trocheck\'s profile"]') as HTMLButtonElement;
    act(() => name.click());
    expect(onOpenPlayer).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));

    const oneAdd = [...container.querySelectorAll('button')].find((button) => button.textContent?.startsWith('1 add')) as HTMLButtonElement;
    act(() => oneAdd.click());
    expect(container.textContent).toContain('+3 lineup starts');
    const d = [...container.querySelectorAll('button')].find((button) => button.textContent?.startsWith('D')) as HTMLButtonElement;
    act(() => d.click());
    expect(container.textContent).toContain('add any Golden Knights D');
  });
});
