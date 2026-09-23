// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddsUsedControl } from './AddsUsedControl';
import { applyScoringPreset, createDefaultLeagueWorkspace, type LeagueWorkspace } from '../../lib/leagueWorkspace';

const state = vi.hoisted(() => ({ league: null as unknown as LeagueWorkspace, updateLeague: vi.fn() }));
vi.mock('../../contexts/LeagueWorkspaceContext', () => ({ useLeagueWorkspace: () => ({ activeLeague: state.league, updateLeague: state.updateLeague }) }));

describe('AddsUsedControl', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeAll(() => { (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    const now = new Date().toISOString();
    state.league = applyScoringPreset(createDefaultLeagueWorkspace({ id: 'k', now, timezone: 'UTC' }), 'kkupfl', now);
    state.updateLeague = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('shows adds used against the league limit and records one more', () => {
    act(() => root.render(<AddsUsedControl />));
    expect(container.textContent).toContain('0/4');
    act(() => (container.querySelector('[aria-label="One more add used"]') as HTMLButtonElement).click());
    expect(state.updateLeague).toHaveBeenCalledWith(expect.objectContaining({ acquisitions: expect.objectContaining({ movesUsed: 1 }) }));
  });

  it('tells leagues without a limit where to set one', () => {
    state.league = createDefaultLeagueWorkspace({ id: 'd', now: new Date().toISOString(), timezone: 'UTC' });
    act(() => root.render(<AddsUsedControl />));
    expect(container.textContent).toContain('No add limit set');
  });
});
