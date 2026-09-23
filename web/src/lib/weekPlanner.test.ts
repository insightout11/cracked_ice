import { describe, expect, it } from 'vitest';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import { createDefaultLeagueWorkspace, planningWeek, type LeagueWorkspace } from './leagueWorkspace';
import { simulateDailyLineup } from './acquisitionAnalysis';
import { bestDailyLineup, planWeek, type PlannerCandidate } from './weekPlanner';

// Week 2 of 2026-27: Mon Oct 5 - Sun Oct 11. Week 1 opens Tue Sep 29.
const MON = '2026-10-05', TUE = '2026-10-06', WED = '2026-10-07', THU = '2026-10-08', FRI = '2026-10-09', SAT = '2026-10-10', SUN = '2026-10-11';
const NEXT_MON = '2026-10-12', NEXT_TUE = '2026-10-13';

const stats = { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 };

interface Fixture {
  workspace: LeagueWorkspace;
  roster: RosterPlayer[];
  candidates: PlannerCandidate[];
  projections: Record<string, PlayerProjection>;
}

function projection(fppg: number, dates: string[]): PlayerProjection {
  return {
    fppg,
    starts: dates.length,
    gamesAvailable: dates.length,
    projectedPoints: fppg * dates.length,
    offNightRate: 0,
    strengthOfSchedule: 50,
    startsByDate: Object.fromEntries(dates.map((date) => [date, 1])),
    gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'BOS', isHome: true, isOffNight: false }])),
  };
}

function setup(slots: Record<string, number>): Fixture {
  const workspace = createDefaultLeagueWorkspace({ now: '2026-09-01T00:00:00.000Z', timezone: 'UTC' });
  workspace.rosterRules.slots = slots;
  workspace.rosterRules.lockingMode = 'daily';
  workspace.schedule.matchupWeekStart = 'monday';
  workspace.acquisitions = { limit: 4, period: 'week', movesUsed: 0, addTiming: 'same-day', waiverDelayDays: 1, pickupMethod: 'free-agent' };
  workspace.roster = [];
  return { workspace, roster: [], candidates: [], projections: {} };
}

function own(data: Fixture, id: string, fppg: number, dates: string[], extra: Partial<RosterPlayer> = {}, entry: Partial<LeagueWorkspace['roster'][number]> = {}) {
  const player: RosterPlayer = { id, full_name: id, team: 'TOR', positions: ['C'], games_played: 0, stats, blendedFppg: fppg, ...extra };
  data.roster.push(player);
  data.projections[id] = projection(fppg, dates);
  data.workspace.roster.push({ playerId: id, fullName: id, team: 'TOR', positions: player.positions, slot: 'BN', keeper: false, protected: false, undroppable: false, ...entry });
}

function candidate(data: Fixture, id: string, fppg: number, dates: string[], extra: Partial<RosterPlayer> = {}, confirmed = true) {
  data.candidates.push({ player: { id, full_name: id, team: 'MTL', positions: ['C'], games_played: 0, stats, ...extra }, confirmed });
  data.projections[id] = projection(fppg, dates);
}

describe('planningWeek', () => {
  it('plans week 1 from opening night when the season has not started', () => {
    const workspace = createDefaultLeagueWorkspace({ now: '2026-09-01T00:00:00.000Z', timezone: 'UTC' });
    workspace.schedule.matchupWeekStart = 'monday';
    expect(planningWeek(workspace, '2026-09-23T12:00:00.000Z')).toMatchObject({
      today: '2026-09-23', start: '2026-09-29', end: '2026-10-04', firstPlanDate: '2026-09-29', nextStart: MON, nextEnd: SUN,
    });
    expect(planningWeek(workspace, '2026-10-07T12:00:00.000Z')).toMatchObject({ start: MON, end: SUN, firstPlanDate: WED });
  });
});

// Exhaustive reference: the dynamic-programming search the lineup solver used to run.
function exhaustiveLineupPoints(slots: Record<string, number>, players: Array<{ value: number; positions: string[] }>): { points: number; starts: number } {
  const slotTypes = Object.keys(slots).filter((slot) => !['BN', 'IR', 'IR+', 'IR-LT', 'NA'].includes(slot)).sort();
  const fits = (positions: string[], slot: string) => positions.includes(slot)
    || (['LW', 'RW', 'W'].includes(slot) && positions.includes('W'))
    || (slot === 'UTIL' && positions.some((position) => position !== 'G'));
  const memo = new Map<string, { points: number; starts: number }>();
  const solve = (index: number, remaining: number[]): { points: number; starts: number } => {
    if (index >= players.length) return { points: 0, starts: 0 };
    const key = `${index}|${remaining.join(',')}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best = solve(index + 1, remaining);
    slotTypes.forEach((slot, slotIndex) => {
      if (remaining[slotIndex] <= 0 || !fits(players[index].positions, slot) || players[index].value < 0) return;
      const next = [...remaining];
      next[slotIndex] -= 1;
      const rest = solve(index + 1, next);
      const option = { points: players[index].value + rest.points, starts: rest.starts + 1 };
      if (option.points > best.points + 1e-9 || (Math.abs(option.points - best.points) < 1e-9 && option.starts > best.starts)) best = option;
    });
    memo.set(key, best);
    return best;
  };
  return solve(0, slotTypes.map((slot) => slots[slot]));
}

describe('lineup solvers', () => {
  it('match an exhaustive search on random rosters', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const eligibility = [['C'], ['LW'], ['RW'], ['D'], ['G'], ['C', 'LW'], ['LW', 'RW'], ['C', 'RW'], ['D'], ['C', 'LW', 'RW']];
    const slots = { C: 2, LW: 2, RW: 2, UTIL: 2, D: 4, G: 2, BN: 4 };
    for (let trial = 0; trial < 200; trial += 1) {
      const data = setup(slots);
      const count = 6 + Math.floor(random() * 14);
      for (let index = 0; index < count; index += 1) {
        own(data, `p${trial}-${index}`, Math.round(random() * 60) / 10, [MON], { positions: eligibility[Math.floor(random() * eligibility.length)] });
      }
      const reference = exhaustiveLineupPoints(slots, data.roster.map((player) => ({ value: data.projections[player.id].fppg, positions: player.positions })));
      const planner = bestDailyLineup(data.workspace, data.roster, (player) => data.projections[player.id].fppg);
      const shared = simulateDailyLineup(data.workspace, data.roster, data.projections, [MON]);
      expect(planner.points).toBeCloseTo(reference.points, 6);
      expect(shared.points).toBeCloseTo(reference.points, 6);
      expect(shared.starts).toBe(reference.starts);
    }
  });
});

describe('week planner', () => {
  it('streams one spot Tue/Wed, then Thursday, then Friday/Sunday, skipping a busy Saturday', () => {
    const data = setup({ C: 2, BN: 2 });
    own(data, 'top1', 3, [SAT]);
    own(data, 'top2', 3, [SAT]);
    own(data, 'depth', 0.5, []);
    candidate(data, 'tuewed', 2, [TUE, WED]);
    candidate(data, 'thu', 2, [THU]);
    candidate(data, 'frisun', 2, [FRI, SUN], {}, true);
    candidate(data, 'sat', 2.5, [SAT]);
    data.projections.frisun = projection(2, [FRI, SUN, NEXT_MON]);

    const result = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });

    expect(result.spots.map((spot) => spot.kind)).toEqual(['open']);
    expect(result.addsRemaining).toBe(4);
    const three = result.plans[3];
    expect(three.gain).toBe(10);
    expect(three.adds.map((add) => [add.add.id, add.effectiveDate, add.drop?.id ?? null])).toEqual([
      ['tuewed', TUE, null],
      ['thu', THU, 'tuewed'],
      ['frisun', FRI, 'thu'],
    ]);
    expect(three.adds.map((add) => add.carriesOver)).toEqual([false, false, true]);
    // An empty place can be filled now; a swap waits until the previous streamer's last game.
    expect(three.adds.map((add) => add.earliestActionDate)).toEqual([MON, THU, FRI]);
    expect(three.adds.map((add) => add.playsNextWeekStart)).toEqual([false, false, true]);
    // Each add's own days in the place, for the day grid.
    expect(three.adds.map((add) => [add.until, add.startDates])).toEqual([[WED, [TUE, WED]], [THU, [THU]], [null, [FRI, SUN]]]);
    // Saturday is packed: two of your players for two lineup slots.
    expect(result.dayLoad.find((day) => day.date === SAT)).toEqual({ date: SAT, games: 2, slots: 2 });
    expect(three.adds.every((add) => add.add.id !== 'sat')).toBe(true);
    expect(result.plans[1].gain).toBe(4);
  });

  it('suggests IR+ moves for out players in week 1 and streams into the freed places without dropping anyone', () => {
    const data = setup({ C: 2, BN: 1, 'IR+': 2 });
    data.workspace.rosterRules.irEligibleStatuses = ['IR', 'IR-LT', 'O', 'DTD'];
    // Adds entered this week belong to the preseason week, not week 1.
    data.workspace.acquisitions.movesUsed = 3;
    data.workspace.acquisitions.observedAt = '2026-09-22T12:00:00.000Z';
    own(data, 'hurt1', 4, ['2026-09-29'], { injuryStatus: 'O' });
    own(data, 'hurt2', 2, ['2026-09-30'], { injuryStatus: 'IR' });
    own(data, 'healthy', 3, ['2026-10-01']);
    candidate(data, 'a', 2, ['2026-09-30', '2026-10-02']);
    candidate(data, 'b', 1.5, ['2026-09-29', '2026-10-03']);

    const result = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: '2026-09-23T12:00:00.000Z' });

    expect(result.addsRemaining).toBe(4);
    expect(result.irSuggestions.map((item) => [item.player.id, item.holderPlays])).toEqual([['hurt2', false], ['hurt1', false]]);
    expect(result.spots.map((spot) => spot.kind)).toEqual(['ir', 'ir']);
    const two = result.plans[2];
    expect(two.irMoves.map((move) => move.player.id).sort()).toEqual(['hurt1', 'hurt2']);
    expect(two.adds.every((add) => add.drop === null)).toBe(true);
    expect(two.gain).toBe(7);
    expect(two.droppedPoints).toBe(0);
    expect(result.baseline.points).toBe(3); // out players are not counted as playing
  });

  it('shows the gain against the player dropped from a stream spot, and never streams a protected player', () => {
    const data = setup({ C: 1, BN: 1 });
    own(data, 'star', 5, [MON], {}, { protected: true, streamSpot: true });
    own(data, 'weak', 1, [TUE], {}, { streamSpot: true });
    candidate(data, 'a', 3, [TUE, WED, THU]);

    const result = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });

    expect(result.spots.map((spot) => spot.id)).toEqual(['stream-weak']);
    const one = result.plans[1];
    expect(one.adds[0]).toMatchObject({ effectiveDate: TUE, starts: 3, points: 9 });
    expect(one.adds[0].drop?.id).toBe('weak');
    expect(one).toMatchObject({ gain: 8, pickupPoints: 9, droppedPoints: 1 });
    // Weak has no game before Tuesday, so dropping him Monday costs nothing.
    expect(one.adds[0].earliestActionDate).toBe(MON);
  });

  it('suggests the weakest players to stream, never keepers, protected or injured players', () => {
    const data = setup({ C: 5, BN: 0 });
    own(data, 'keeper', 0.5, [], {}, { keeper: true });
    own(data, 'guarded', 0.6, [], {}, { protected: true });
    own(data, 'hurt', 0.7, [], { injuryStatus: 'DTD' });
    own(data, 'lateA', 1.2, []);
    own(data, 'lateB', 1.0, []);

    const result = planWeek(data.workspace, data.roster, [], data.projections, { now: `${MON}T12:00:00.000Z` });
    expect(result.streamSuggestions.map((player) => player.id)).toEqual(['lateB', 'lateA']);
  });

  it('scores only the planned week, and points out Sunday-Monday back-to-backs', () => {
    const data = setup({ C: 1, BN: 1 });
    own(data, 'only', 1, []);
    candidate(data, 'weekOnly', 2, [TUE, WED]);
    candidate(data, 'nextWeekStar', 2, [TUE, WED]);
    data.projections.nextWeekStar = projection(2, [TUE, WED, NEXT_MON, NEXT_TUE]);
    candidate(data, 'bridge', 1.5, [SUN]);
    data.projections.bridge = projection(1.5, [SUN, NEXT_MON]);
    candidate(data, 'sundayOnly', 3, [SUN]);

    const result = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });
    // Next week's games don't change this week's value.
    expect(result.plans[1].gain).toBe(4);
    expect(result.alternatives[1].some((plan) => plan.gain === 4)).toBe(true);
    expect(result.bridgeCandidates.map((bridge) => bridge.player.id)).toEqual(['bridge']);
    expect(result.bridgeCandidates[0].actionDate).toBe(SUN);
  });

  it('plans 2-week and 30-day windows with each week’s own add limit, scoring only the window', () => {
    const data = setup({ C: 1, BN: 2 });
    own(data, 'only', 1, []);
    data.workspace.acquisitions.movesUsed = 3; // one add left this week, four next week
    data.workspace.acquisitions.observedAt = `${MON}T09:00:00.000Z`;
    candidate(data, 'thisWeek', 3, [TUE, WED, THU]);
    candidate(data, 'holder', 2, [TUE, THU, NEXT_MON, NEXT_TUE, '2026-10-15', '2026-10-17']);
    candidate(data, 'nextWeek', 3, [NEXT_TUE, '2026-10-15', '2026-10-17']);
    const now = `${MON}T12:00:00.000Z`;

    const week = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now });
    expect(week.maxAdds).toBe(1);
    expect(week.plans[1].adds[0].add.id).toBe('thisWeek');

    const twoWeeks = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now, horizon: '14d' });
    expect(twoWeeks.window).toEqual({ start: MON, end: '2026-10-18' });
    // Held for two weeks, six games beat three.
    expect(twoWeeks.plans[1].adds[0].add.id).toBe('holder');
    expect(twoWeeks.plans[1].gain).toBe(12);
    // Only one add fits this week; the rest must wait for next week's limit.
    for (const plan of twoWeeks.plans.slice(1)) {
      expect(plan.adds.filter((add) => add.actionDate < NEXT_MON).length).toBeLessThanOrEqual(1);
    }
    expect(twoWeeks.bridgeCandidates).toEqual([]);

    const month = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now, horizon: '30d' });
    expect(month.window.end).toBe('2026-11-03');
  });

  it('follows the league pickup rules: waiver claims play a day later', () => {
    const data = setup({ C: 1, BN: 1 });
    own(data, 'only', 1, []);
    data.workspace.acquisitions.pickupMethod = 'waivers';
    candidate(data, 'a', 3, [TUE, WED]);

    const monday = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });
    expect(monday.transactionDelay).toBe(1);
    expect(monday.plans[1].adds[0]).toMatchObject({ actionDate: MON, effectiveDate: TUE, starts: 2 });

    const tuesday = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${TUE}T12:00:00.000Z` });
    expect(tuesday.plans[1].adds[0]).toMatchObject({ actionDate: TUE, effectiveDate: WED, starts: 1 });
  });

  it('leaves goalies out unless asked, and skips injured free agents', () => {
    const data = setup({ C: 1, G: 1, BN: 1 });
    own(data, 'skater', 1, []);
    candidate(data, 'goalie', 6, [TUE, WED], { positions: ['G'] });
    candidate(data, 'hurt', 5, [TUE, WED], { injuryStatus: 'DTD' });
    candidate(data, 'fine', 2, [TUE]);

    const skaters = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });
    expect(skaters.plans[1].adds[0].add.id).toBe('fine');
    const withGoalies = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z`, includeGoalies: true });
    expect(withGoalies.plans[1].adds[0].add.id).toBe('goalie');
  });

  it('stops at the adds left this week and plans nothing when none remain', () => {
    const data = setup({ C: 1, BN: 2 });
    own(data, 'only', 1, []);
    candidate(data, 'a', 3, [TUE]);
    candidate(data, 'b', 3, [WED]);
    candidate(data, 'c', 3, [THU]);
    data.workspace.acquisitions.movesUsed = 3;
    data.workspace.acquisitions.observedAt = `${MON}T09:00:00.000Z`;
    const oneLeft = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });
    expect(oneLeft.maxAdds).toBe(1);
    expect(oneLeft.plans[2]).toBeUndefined();

    data.workspace.acquisitions.movesUsed = 4;
    const none = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });
    expect(none.plans).toHaveLength(1);
  });

  it('plans a full-size roster quickly', () => {
    const data = setup({ C: 2, LW: 2, RW: 2, UTIL: 2, D: 4, G: 2, BN: 4, 'IR+': 4 });
    const week = [MON, TUE, WED, THU, FRI, SAT, SUN];
    const positions = ['C', 'LW', 'RW', 'D'];
    for (let index = 0; index < 17; index += 1) {
      own(data, `r${index}`, 1 + (index % 5) * 0.6, week.filter((_, day) => (day + index) % 2 === 0), { positions: [positions[index % 4]] }, { streamSpot: index >= 14 });
    }
    for (let index = 0; index < 24; index += 1) {
      candidate(data, `fa${index}`, 1.5 + (index % 6) * 0.3, week.filter((_, day) => (day * 3 + index) % 4 < 2), { positions: [positions[index % 4]] }, index % 3 === 0);
      data.projections[`fa${index}`].gamesByDate![NEXT_TUE] = { opponent: 'BOS', isHome: true, isOffNight: false };
    }
    const started = performance.now();
    const result = planWeek(data.workspace, data.roster, data.candidates, data.projections, { now: `${MON}T12:00:00.000Z` });
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(4000);
    expect(result.plans).toHaveLength(5);
    for (let count = 2; count <= 4; count += 1) expect(result.plans[count].gain).toBeGreaterThanOrEqual(result.plans[count - 1].gain - 1e-9);
  }, 10_000);
});
