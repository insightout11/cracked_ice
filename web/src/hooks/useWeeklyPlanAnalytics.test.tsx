import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLeagueWorkspace } from '../lib/leagueWorkspace';
import { confirmRosterReadiness } from '../lib/homeReadiness';
import type { AddAdvice } from '../lib/pickupFinder';
import { useWeeklyPlanAnalytics, type PlanMeasurement } from './useWeeklyPlanAnalytics';

const analytics = vi.hoisted(() => ({ track: vi.fn(), initializeAnalytics: vi.fn(() => true) }));
vi.mock('../lib/analytics', () => analytics);

function Probe({ measurement }: { measurement: PlanMeasurement }) {
  const ref = useWeeklyPlanAnalytics({ use: 0, remaining: 4 } as AddAdvice, measurement);
  return <div ref={ref}>Hold your adds</div>;
}

describe('weekly plan impressions', () => {
  let root: Root;
  let container: HTMLDivElement;
  let visible: (entries: Partial<IntersectionObserverEntry>[]) => void;
  const observe = vi.fn();
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.sessionStorage.clear();
    analytics.track.mockClear();
    observe.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof visible) { visible = callback; }
      observe = observe;
      disconnect = vi.fn();
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

  function workspace(id: string) {
    const empty = createDefaultLeagueWorkspace({ id });
    return confirmRosterReadiness({ ...empty, roster: [{ playerId: 'nhl:123', fullName: 'Private name', team: 'TOR', positions: ['C'], slot: 'C', keeper: false, protected: false, undroppable: false }] });
  }

  it('does not count loading or incomplete personalization', () => {
    act(() => root.render(<Probe measurement={{ workspace: workspace('loading'), surface: 'team', ready: false }} />));
    expect(observe).not.toHaveBeenCalled();
    act(() => root.render(<Probe measurement={{ workspace: createDefaultLeagueWorkspace({ id: 'empty' }), surface: 'team', ready: true }} />));
    expect(observe).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('counts a visible hold plan once, including after rerenders, without roster identifiers', () => {
    const measurement = { workspace: workspace('visible-test'), surface: 'team' as const, ready: true };
    act(() => root.render(<Probe measurement={measurement} />));
    act(() => visible([{ isIntersecting: false, intersectionRatio: 0 }]));
    act(() => visible([{ isIntersecting: true, intersectionRatio: 0.1 }]));
    expect(analytics.track).not.toHaveBeenCalled();
    act(() => visible([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    act(() => root.render(<Probe measurement={{ ...measurement, workspace: { ...measurement.workspace } }} />));
    act(() => visible([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('weekly_plan_viewed', expect.objectContaining({ recommendation: 'hold', plan_mode: 'personalized', surface: 'team' }));
    expect(JSON.stringify(analytics.track.mock.calls)).not.toMatch(/Private name|visible-test|nhl:123/);
  });

  it('waits for a background tab to become visible and labels demos separately', () => {
    const demo = workspace('demo-test');
    demo.roster[0].playerId = 'demo-anchor';
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => root.render(<Probe measurement={{ workspace: demo, surface: 'home', ready: true }} />));
    act(() => visible([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(analytics.track).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(analytics.track).toHaveBeenCalledWith('weekly_plan_viewed', expect.objectContaining({ plan_mode: 'demo' }));
  });
});
