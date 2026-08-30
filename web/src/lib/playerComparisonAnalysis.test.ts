import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { analyzePlayerComparison, applyComparisonProductionMode, reconcileComparisonProjections } from './playerComparisonAnalysis';
import type { PlayerProjection, RosterPlayer } from './coachSchemas';
import type { DraftPlayer } from './playerSearch';

const player = (id: string, name: string, team: string): RosterPlayer => ({ id, full_name: name, team, positions: ['RW'], current_slot: 'RW', games_played: 82, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } });
const projection = (fppg: number, dates: string[]): PlayerProjection => ({
  fppg, starts: dates.length, gamesAvailable: dates.length, projectedPoints: fppg * dates.length, offNightRate: 0, strengthOfSchedule: 5,
  gamesByDate: Object.fromEntries(dates.map((date) => [date, { opponent: 'TBL', isHome: true, isOffNight: true, startTime: `${date}T23:00:00Z` }])),
});

describe('player comparison analysis', () => {
  it('keeps the complete schedule when a persisted-roster projection has zero games', () => {
    const schedule = projection(6.9, ['2026-10-01', '2026-10-03']);
    const incompleteLineup = { ...projection(4.91, []), iceScore: 6.9 };
    const result = reconcileComparisonProjections(
      { '8476453': schedule },
      { '8476453': incompleteLineup },
      [{ id: '8476453', blendedFppg: 7.4 }],
    );

    expect(result['8476453'].gamesAvailable).toBe(2);
    expect(Object.keys(result['8476453'].gamesByDate ?? {})).toHaveLength(2);
    expect(result['8476453'].iceScore).toBe(6.9);
  });

  it('uses the active-league directory FPPG for every compared player', () => {
    const result = reconcileComparisonProjections(
      { a: projection(5.46, ['2026-10-01']), b: projection(4.91, ['2026-10-01']) },
      { a: projection(3.2, ['2026-10-01']), b: projection(2.8, ['2026-10-01']) },
      [{ id: 'a', blendedFppg: 7.1 }, { id: 'b', blendedFppg: 6.8 }],
    );

    expect(result.a.fppg).toBe(7.1);
    expect(result.b.fppg).toBe(6.8);
    expect(result.a.projectedPoints).toBe(7.1);
    expect(result.b.projectedPoints).toBe(6.8);
  });

  it('switches the same schedule between last-season and upcoming production rates', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.projections.activeSourceId = 'external';
    workspace.projections.sources = [{
      id: 'external', label: 'External', season: '2026-27', importedAt: '2026-08-30T00:00:00.000Z', matchedCount: 1,
      players: { a: { playerId: 'a', name: 'Player A', team: 'ANA', projectedFppg: 6, projectedGames: 42, stats: {} } },
    }];
    const directory: DraftPlayer[] = [{
      id: 'a', name: 'Player A', team: 'ANA', pos: ['C'], aliases: [], blendedFppg: 4,
      productionValue: 4, productionLabel: 'FPPG', nhlGamesPlayed: 82,
      scoringBreakdown: { gamesPlayed: 82, fppg: 4, contributions: [{ key: 'goals', stat: 40, weight: 2, fantasyPoints: 80, fppg: 0.98 }] },
      recentSeasons: [{ season: '20252026', gamesPlayed: 82, pointsPerGame: 1 }],
    }];
    const schedule = { a: projection(3, ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07']) };
    const actual = applyComparisonProductionMode(schedule, directory, workspace, 'last-season');
    const upcoming = applyComparisonProductionMode(schedule, directory, workspace, 'projection');

    expect(actual.a.fppg).toBe(4);
    expect(actual.a.gamesAvailable).toBe(4);
    expect(actual.a.projectedPoints).toBe(16);
    expect(upcoming.a.fppg).toBe(6);
    expect(upcoming.a.gamesAvailable).toBe(2);
    expect(upcoming.a.projectedPoints).toBe(12);
  });

  it('lets schedule fit break a close FPPG tie', () => {
    const workspace = createDefaultLeagueWorkspace();
    const a = player('1', 'Player A', 'ANA');
    const b = player('2', 'Player B', 'BOS');
    const result = analyzePlayerComparison(workspace, [], a, b, {
      '1': projection(5, ['2026-10-01', '2026-10-03', '2026-10-05']),
      '2': projection(5.1, ['2026-10-01']),
    });
    expect(result.winnerId).toBe('1');
    expect(result.optionA.usablePoints).toBe(15);
  });

  it('never counts a keeper twice in a forced draft comparison', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.rosterRules.slots = { RW: 2, BN: 2 };
    const keeper = player('1', 'Nikita Kucherov', 'TBL');
    const alternative = player('2', 'Leon Draisaitl', 'EDM');
    const dates = ['2026-10-01', '2026-10-03', '2026-10-05'];
    const result = analyzePlayerComparison(workspace, [keeper], keeper, alternative, {
      '1': projection(5, dates),
      '2': projection(4, dates),
    }, Date.now(), 'draft');

    expect(result.optionA.usableStarts).toBe(3);
    expect(result.optionA.usablePoints).toBe(15);
  });

  it('evaluates an explicit free-agent swap against the selected roster player', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.rosterRules.slots = { RW: 1, BN: 2 };
    const owned = player('1', 'Owned', 'ANA');
    const candidate = player('2', 'Candidate', 'BOS');
    workspace.roster = [{ playerId: '1', fullName: 'Owned', team: 'ANA', positions: ['RW'], slot: 'RW', keeper: false, protected: false, undroppable: false }];
    workspace.candidates = [{ playerId: '2', availability: 'user-confirmed', observedAt: '2026-07-23T00:00:00.000Z', expiresAt: '2026-07-24T00:00:00.000Z' }];
    const result = analyzePlayerComparison(workspace, [owned], owned, candidate, {
      '1': projection(2, ['2026-10-01']),
      '2': projection(4, ['2026-10-01', '2026-10-03']),
    }, Date.parse('2026-07-23T12:00:00.000Z'));
    expect(result.context).toBe('pickup');
    expect(result.optionB.drop?.id).toBe('1');
    expect(result.optionB.teamPointsDelta).toBeGreaterThan(0);
    expect(result.verdict).toBe('Add Candidate and drop Owned');
  });

  it('never recommends adding a player whose availability is unknown', () => {
    const workspace = createDefaultLeagueWorkspace();
    const owned = player('1', 'Nikita Kucherov', 'TBL');
    const candidate = player('2', 'Nathan MacKinnon', 'COL');
    workspace.roster = [{ playerId: '1', fullName: owned.full_name, team: owned.team, positions: owned.positions, slot: 'RW', keeper: false, protected: false, undroppable: false }];
    const result = analyzePlayerComparison(workspace, [owned], owned, candidate, {
      '1': projection(4, ['2026-10-01']),
      '2': projection(6, ['2026-10-01', '2026-10-03']),
    });

    expect(result.verdict).toBe('Nathan MacKinnon is the better fit if available');
    expect(result.optionB.drop).toBeNull();
    expect(result.optionB.transactionEligible).toBe(false);
    expect(result.explanation).toContain('what-if comparison');
  });

  it('does not recommend dropping a protected roster player', () => {
    const workspace = createDefaultLeagueWorkspace();
    const owned = player('1', 'Keeper', 'TBL');
    const candidate = player('2', 'Candidate', 'COL');
    workspace.roster = [{ playerId: '1', fullName: owned.full_name, team: owned.team, positions: owned.positions, slot: 'RW', keeper: true, protected: false, undroppable: false }];
    workspace.candidates = [{ playerId: '2', availability: 'user-confirmed', observedAt: '2026-07-23T00:00:00.000Z', expiresAt: '2026-07-24T00:00:00.000Z' }];
    const result = analyzePlayerComparison(workspace, [owned], owned, candidate, {
      '1': projection(4, ['2026-10-01']),
      '2': projection(6, ['2026-10-01', '2026-10-03']),
    }, Date.parse('2026-07-23T12:00:00.000Z'));

    expect(result.optionB.drop).toBeNull();
    expect(result.explanation).toContain('marked keeper');
  });
});
