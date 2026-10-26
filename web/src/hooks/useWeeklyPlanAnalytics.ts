import { useEffect, useRef } from 'react';
import { track } from '../lib/analytics';
import { selectRosterReadiness } from '../lib/homeReadiness';
import { planningWeek, type LeagueWorkspace } from '../lib/leagueWorkspace';
import { measureOnce, planMode } from '../lib/measurement';
import type { AddAdvice } from '../lib/pickupFinder';

export interface PlanMeasurement {
  workspace: LeagueWorkspace;
  surface: 'home' | 'team';
  ready: boolean;
}

/** A computed plan is an impression only when its summary enters the viewport. */
export function useWeeklyPlanAnalytics(advice: AddAdvice, measurement?: PlanMeasurement) {
  const ref = useRef<HTMLDivElement>(null);
  const workspace = measurement?.workspace;
  const surface = measurement?.surface;
  const ready = measurement?.ready;
  useEffect(() => {
    const element = ref.current;
    if (!element || !workspace || !surface || !ready || typeof IntersectionObserver === 'undefined') return;
    const mode = planMode(workspace);
    if (mode === 'personalized' && selectRosterReadiness(workspace) !== 'ready') return;
    const week = planningWeek(workspace).start;
    let visible = false;
    const recordVisiblePlan = () => {
      if (!visible || document.visibilityState === 'hidden') return;
      measureOnce(`plan:${workspace.id}:${week}:${mode}:${surface}`, () => track('weekly_plan_viewed', {
        week, surface, plan_mode: mode, roster_size: workspace.roster.length,
        recommended_adds: advice.use,
        recommendation: advice.remaining === 0 ? 'limit-reached' : advice.use > 0 ? 'add' : 'hold',
      }));
      observer.disconnect();
      document.removeEventListener('visibilitychange', recordVisiblePlan);
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25);
      recordVisiblePlan();
    }, { threshold: 0.25 });
    document.addEventListener('visibilitychange', recordVisiblePlan);
    observer.observe(element);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', recordVisiblePlan); };
  }, [advice.remaining, advice.use, ready, surface, workspace]);
  return ref;
}
