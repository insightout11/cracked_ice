// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAcquisitionDemo } from '../lib/acquisitionDemo';
import { createDefaultLeagueWorkspace, type LeagueWorkspace } from '../lib/leagueWorkspace';
import type { LeagueProfile, PlayerProjection } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';

const calls = vi.hoisted(() => ({ evaluate: [] as string[][], pending: [] as Array<(value: unknown) => void> }));

vi.mock('../services/api', () => ({
  apiService: {
    getAllPlayers: () => Promise.resolve({ results: ['demo-anchor', 'demo-current', 'demo-candidate'].map((id) => ({ id, name: id, team: 'TEST', pos: ['RW'], aliases: [], blendedFppg: 3, games_played: 30 })) }),
    // Each projection request waits until the test resolves it.
    applyRosterLineup: (request: { roster: Array<{ playerId: string }> }) => new Promise((resolve) => {
      calls.pending.push(() => resolve({ projections: Object.fromEntries(request.roster.map(({ playerId }) => [playerId, projectionFor(playerId)])) }));
    }),
  },
}));
vi.mock('../lib/acquisitionScenarios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/acquisitionScenarios')>();
  return {
    ...actual,
    evaluateAcquisitionScenarios: (...args: Parameters<typeof actual.evaluateAcquisitionScenarios>) => {
      calls.evaluate.push(Object.keys(args[3]).sort());
      return actual.evaluateAcquisitionScenarios(...args);
    },
  };
});

const projectionFor = (id: string): PlayerProjection => ({
  fppg: 3, starts: 1, gamesAvailable: 1, projectedPoints: 3, offNightRate: 0, strengthOfSchedule: 5,
  gamesByDate: { '2026-10-06': { opponent: 'BOS', isHome: true, isOffNight: false } },
});

import { useAcquisitionRecommendations } from './useAcquisitionRecommendations';

// Stable across renders, as the page's state is.
const TIME_WINDOW: TimeWindowState = { mode: 'regular', preset: 'custom', config: { startUtc: '2026-10-05T00:00:00.000Z', endUtc: '2026-10-11T23:59:59.999Z', source: 'custom' } };
const LEAGUE_PROFILE = {} as LeagueProfile;

function Probe({ workspace }: { workspace: LeagueWorkspace }) {
  useAcquisitionRecommendations({ workspace, leagueProfile: LEAGUE_PROFILE, timeWindow: TIME_WINDOW });
  return null;
}

describe('useAcquisitionRecommendations', () => {
  let root: Root;
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { act(() => root.unmount()); });

  it('waits for the new roster\'s projections instead of recalculating against the old ones', async () => {
    const demo = createAcquisitionDemo(createDefaultLeagueWorkspace({ id: 'render' }));
    const workspace = {
      ...demo.workspace,
      candidates: [{ playerId: 'demo-candidate', availability: 'user-confirmed' as const, status: 'available' as const, observedAt: '2026-09-23T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z' }],
    };
    root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<Probe workspace={workspace} />); });
    await act(async () => { calls.pending.shift()?.(null); });
    const settledCalls = calls.evaluate.length;

    // Add a player who isn't already a candidate: a new projection request goes out,
    // and nothing is re-solved against the old projections meanwhile.
    const added = { ...workspace, roster: [...workspace.roster, { ...workspace.roster[0], playerId: 'new-player', fullName: 'New Player', slot: 'BN' }] };
    await act(async () => { root.render(<Probe workspace={added} />); });
    expect(calls.pending).toHaveLength(1);
    expect(calls.evaluate.length).toBe(settledCalls);

    // Once it answers, scenarios are solved with the new player's projection.
    await act(async () => { calls.pending.shift()?.(null); });
    expect(calls.evaluate.length).toBeGreaterThan(settledCalls);
    expect(calls.evaluate[calls.evaluate.length - 1]).toContain('new-player');
  });
});
