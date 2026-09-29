// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RosterPlayer } from '../../lib/coachSchemas';
import { createDefaultLeagueWorkspace } from '../../lib/leagueWorkspace';
import { BusyNightNudge } from './BusyNightNudge';

const game = (date: string) => ({ date, opponent: 'BOS', isHome: true, isOffNight: false });
vi.mock('../../lib/schedulePlanning', () => ({
  loadSeasonSchedule: () => Promise.resolve({ games: { TOR: [game('2026-10-06')], ANA: [game('2026-10-06')], DAL: [game('2026-10-07')] } }),
}));
vi.mock('../../lib/injuries', () => ({ useInjuries: () => null, withInjuries: (players: unknown) => players }));

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const player = (id: string, team: string, fppg: number): RosterPlayer => ({ id, full_name: id, team, positions: ['C'], games_played: 10, stats, blendedFppg: fppg });

describe('BusyNightNudge', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T16:00:00Z')); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('flags the next overbooked night and opens its start/sit card', async () => {
    const base = createDefaultLeagueWorkspace({ id: 'nudge', timezone: 'UTC' });
    const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 1, BN: 2 } } };
    const onAsk = vi.fn();
    await act(async () => { root.render(<BusyNightNudge workspace={workspace} roster={[player('Nylander', 'TOR', 2.3), player('Gauthier', 'ANA', 2), player('Hintz', 'DAL', 2)]} onAsk={onAsk} />); });
    expect(container.textContent).toContain('Busy night Tue, Oct 6: 2 players for 1 spot, 1 sits.');
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    expect(onAsk).toHaveBeenCalledWith('2026-10-06');
  });

  it('stays quiet when everyone fits', async () => {
    const base = createDefaultLeagueWorkspace({ id: 'quiet', timezone: 'UTC' });
    const workspace = { ...base, rosterRules: { ...base.rosterRules, slots: { C: 2, BN: 2 } } };
    await act(async () => { root.render(<BusyNightNudge workspace={workspace} roster={[player('Nylander', 'TOR', 2.3), player('Gauthier', 'ANA', 2)]} onAsk={vi.fn()} />); });
    expect(container.textContent).toBe('');
  });
});
