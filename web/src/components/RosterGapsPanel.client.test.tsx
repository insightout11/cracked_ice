// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeagueProfile } from '../lib/coachSchemas';
import type { TimeWindowState } from '../types/timeWindow';
import { RosterGapsPanel } from './RosterGapsPanel';

const timeWindow: TimeWindowState = {
  mode: 'regular',
  preset: 'rest-of-season',
  config: { startUtc: '2026-10-01T00:00:00.000Z', endUtc: '2026-10-02T23:59:59.999Z', source: 'preset' },
};

function profile(locking_mode: 'daily' | 'weekly'): LeagueProfile {
  return { league_name: 'Test', scoring_type: 'points', lineup_slots: { C: 1, D: 1, G: 1, BN: 1 }, locking_mode };
}

describe('RosterGapsPanel schedule loading', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a failed schedule request instead of showing a false success state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ games: { NYR: [{ date: '2026-10-01' }] } }) });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(<RosterGapsPanel isExpanded onToggle={vi.fn()} workingLineup={[]} timeWindow={timeWindow} leagueProfile={profile('daily')} />);
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Schedule analysis unavailable'));
    expect(container.textContent).not.toContain('Roster Optimized');

    const retry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Retry schedule');
    expect(retry).toBeTruthy();
    await act(async () => retry?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect(container.textContent).toContain('Team comparison'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fetch or calculate daily recommendations for weekly locking', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await act(async () => {
      root.render(<RosterGapsPanel isExpanded onToggle={vi.fn()} workingLineup={[]} timeWindow={timeWindow} leagueProfile={profile('weekly')} />);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Daily schedule-fit recommendations are unavailable');
  });

  it('carries the selected team, position, window, and comparison into player browsing', async () => {
    const onBrowsePlayers = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ games: { NYR: [{ date: '2026-10-01' }] } }),
    }));

    await act(async () => {
      root.render(
        <RosterGapsPanel
          isExpanded
          onToggle={vi.fn()}
          workingLineup={[]}
          timeWindow={timeWindow}
          leagueProfile={profile('daily')}
          onBrowsePlayers={onBrowsePlayers}
        />,
      );
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Team comparison'));

    const viewDates = [...container.querySelectorAll('button')].find((button) => button.textContent === 'View dates');
    await act(async () => viewDates?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await vi.waitFor(() => expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'Browse NYR D players')).toBe(true));
    const browse = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Browse NYR D players');
    await act(async () => browse?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onBrowsePlayers).toHaveBeenCalledWith('NYR', 'D', {
      windowStart: '2026-10-01',
      windowEnd: '2026-10-02',
      simulatedDropId: undefined,
      simulatedDropName: undefined,
    });
  });
});
