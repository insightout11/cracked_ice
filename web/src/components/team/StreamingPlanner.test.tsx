// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerProjection, RosterPlayer } from '../../lib/coachSchemas';
import { applyScoringPreset, createDefaultLeagueWorkspace, type LeagueWorkspace } from '../../lib/leagueWorkspace';
import { planWeek, type WeekPlannerResult } from '../../lib/weekPlanner';
import type { AcquisitionRecommendationResult } from '../../hooks/useAcquisitionRecommendations';
import type { LeagueProfile } from '../../lib/coachSchemas';
import { StreamingPlanner } from './StreamingPlanner';

const state = vi.hoisted(() => ({ updateLeague: vi.fn(), result: null as unknown }));
vi.mock('../../contexts/LeagueWorkspaceContext', () => ({ useLeagueWorkspace: () => ({ updateLeague: state.updateLeague }) }));
vi.mock('../../hooks/useWeekPlanner', () => ({ useWeekPlanner: () => ({ status: 'ready', result: state.result }) }));

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };
const projection = (fppg: number, dates: string[]): PlayerProjection => ({
  fppg, starts: dates.length, gamesAvailable: dates.length, projectedPoints: fppg * dates.length, offNightRate: 0, strengthOfSchedule: 50,
  gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'BOS', isHome: true, isOffNight: false }])),
});

function fixture(): { workspace: LeagueWorkspace; roster: RosterPlayer[]; result: WeekPlannerResult } {
  const workspace = applyScoringPreset(createDefaultLeagueWorkspace({ id: 'k', now: '2026-09-01T00:00:00.000Z', timezone: 'UTC' }), 'kkupfl');
  workspace.rosterRules.slots = { C: 2, BN: 1, 'IR+': 2 };
  const player = (id: string, extra: Partial<RosterPlayer> = {}): RosterPlayer => ({ id, full_name: id, team: 'TOR', positions: ['C'], games_played: 0, stats, ...extra });
  const roster = [player('Hurt Player', { injuryStatus: 'O' }), player('Depth Guy', { blendedFppg: 0.5 }), player('Top Line', { blendedFppg: 4 })];
  workspace.roster = roster.map((item) => ({ playerId: item.id, fullName: item.id, team: 'TOR', positions: ['C'], slot: 'BN', keeper: false, protected: false, undroppable: false }));
  const projections = { 'Hurt Player': projection(3, ['2026-09-29']), 'Depth Guy': projection(0.5, []), 'Top Line': projection(4, ['2026-09-30']), Streamer: projection(2, ['2026-09-29', '2026-10-01']) };
  const result = planWeek(workspace, roster, [{ player: player('Streamer', { team: 'MTL' }), confirmed: false }], projections, { now: '2026-09-23T12:00:00.000Z' });
  return { workspace, roster, result };
}

describe('StreamingPlanner', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    state.updateLeague = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  const render = (data: ReturnType<typeof fixture>) => {
    state.result = data.result;
    act(() => root.render(<StreamingPlanner workspace={data.workspace} roster={data.roster} leagueProfile={{} as LeagueProfile} recommendations={{} as AcquisitionRecommendationResult} />));
  };

  it('suggests the IR move first, then the add, with the gain', () => {
    render(fixture());
    const text = container.textContent ?? '';
    expect(text).toContain('Move Hurt Player to IR+');
    expect(text).toContain('Add Streamer');
    expect(text).toContain('+4.0 pts this week');
    expect(text).toContain('1 add · +4.0');
  });

  it('marks a suggested player OK to drop, and a target taken', () => {
    const data = fixture();
    render(data);
    const chip = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Depth Guy')) as HTMLButtonElement;
    act(() => chip.click());
    expect(state.updateLeague).toHaveBeenLastCalledWith(expect.objectContaining({ roster: expect.arrayContaining([expect.objectContaining({ playerId: 'Depth Guy', streamSpot: true })]) }));

    const taken = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Taken') as HTMLButtonElement;
    act(() => taken.click());
    expect(state.updateLeague).toHaveBeenLastCalledWith(expect.objectContaining({ candidates: expect.arrayContaining([expect.objectContaining({ playerId: 'Streamer', status: 'taken' })]) }));
  });
});
