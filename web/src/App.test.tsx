import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { NHL_TEAM_CODES } from './lib/nhlTeams';
import { SEASON_GAMES_PER_TEAM, SEASON_START } from './lib/season';

vi.mock('./services/api', () => ({
  apiService: {
    getTeamTiers: vi.fn(async () => ({ teams: [] })),
  },
}));

describe('App home route', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, '', '/?utm_source=test');
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    const games = Object.fromEntries(NHL_TEAM_CODES.map((team, index) => [team, Array.from({ length: SEASON_GAMES_PER_TEAM }, () => ({ date: SEASON_START, opponent: NHL_TEAM_CODES[(index + 1) % NHL_TEAM_CODES.length], isHome: true }))]));
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return { ok: true, json: async () => url.includes('schedules-') ? { games } : {} } as Response;
    }));
  });

  afterEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    vi.unstubAllGlobals();
    container.remove();
  });

  it('renders a useful public Home without mounting a tool', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Draft prep');
    expect(container.textContent).toContain('Next slate:');
    expect(container.textContent).toContain('Compare Players');
    expect(container.textContent).toContain('Draft Board');
    expect(container.textContent).toContain('Schedule Fit');
    expect(container.textContent).toContain('Personalize with my roster');
    await act(async () => root.unmount());
  });

  it('lets an unavailable league action recover to a saved workspace', async () => {
    window.history.replaceState({}, '', '/draft?league=missing&date=2026-10-10&source=home-tool&return=%2F');
    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('LEAGUE CONTEXT UNAVAILABLE');
    const recoveryButton = [...container.querySelectorAll('main button')].find((button) => button.textContent?.includes('My League'));
    expect(recoveryButton).toBeTruthy();
    await act(async () => recoveryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(new URLSearchParams(window.location.search).get('league')).toBe('local-default');
    expect(new URLSearchParams(window.location.search).get('date')).toBe('2026-10-10');
    await act(async () => root.unmount());
  });
});
