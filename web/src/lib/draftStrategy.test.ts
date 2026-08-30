import { describe, expect, it } from 'vitest';
import { buildPositionValuations, compareDraftCandidates, rankDraftCandidates } from './draftStrategy';
import { createDefaultLeagueWorkspace, DRAFT_STRATEGY_PRESETS } from './leagueWorkspace';
import type { DraftPlayer } from './playerSearch';
import type { RosterPlayer } from './coachSchemas';
import type { SeasonScheduleData } from './schedulePlanning';

function draftPlayer(id: string, name: string, team: string, fppg: number, pos: string[] = ['C']): DraftPlayer {
  return { id, name, team, pos, aliases: [], blendedFppg: fppg, productionValue: fppg, productionLabel: 'FPPG', scoringBreakdown: null };
}

function established(player: DraftPlayer): DraftPlayer {
  return { ...player, nhlGamesPlayed: 82 };
}

function goalie(id: string, name: string, team: string, fppg: number, gamesPlayed: number): DraftPlayer {
  return { id, name, team, pos: ['G'], aliases: [], blendedFppg: fppg, productionValue: fppg, productionLabel: 'FPPG', nhlGamesPlayed: gamesPlayed, scoringBreakdown: { gamesPlayed, fppg, contributions: [] } };
}

function games(team: string, dates: string[], offNights: string[] = []) {
  return dates.map((date) => ({ date, opponent: team === 'ANA' ? 'BOS' : 'ANA', isHome: true, isOffNight: offNights.includes(date), startTime: `${date}T23:00:00Z` }));
}

function dateSeries(start: string, count: number, stepDays = 2): string[] {
  const first = new Date(`${start}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, index) => new Date(first + (index * stepDays * 86_400_000)).toISOString().slice(0, 10));
}

describe('draft strategy analysis', () => {
  it('can prefer a playoff schedule without hiding the regular-season tradeoff', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.season.end = '2027-04-10';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-21' };
    const a = established(draftPlayer('a', 'Production Lead', 'ANA', 6.1));
    const b = established(draftPlayer('b', 'Playoff Lead', 'BOS', 6.1));
    const directory = [a, b, ...Array.from({ length: 10 }, (_, index) => draftPlayer(`p${index}`, `Peer ${index}`, 'CAR', 4.95 - (index * 0.05)))];
    const schedule: SeasonScheduleData = { games: {
      ANA: [...games('ANA', ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11'], ['2026-10-01']), ...games('ANA', ['2027-03-02'])],
      BOS: [...games('BOS', ['2026-10-02', '2026-10-04']), ...games('BOS', ['2027-03-01', '2027-03-03', '2027-03-05', '2027-03-07'], ['2027-03-01', '2027-03-03', '2027-03-05'])],
      CAR: [...games('CAR', ['2026-10-01', '2026-10-03', '2026-10-05']), ...games('CAR', ['2027-03-02', '2027-03-04'])],
    } };

    workspace.draftStrategy = { presetId: 'balanced', weights: { ...DRAFT_STRATEGY_PRESETS.balanced.weights } };
    const balanced = compareDraftCandidates(a, b, directory, [], workspace, schedule);
    expect(balanced.winnerId).toBe('a');

    workspace.draftStrategy = { presetId: 'playoff-edge', weights: { ...DRAFT_STRATEGY_PRESETS['playoff-edge'].weights } };
    const playoff = compareDraftCandidates(a, b, directory, [], workspace, schedule);
    expect(playoff.winnerId).toBe('b');
    expect(playoff.explanation).toContain('fantasy-playoff schedule');
    expect(playoff.optionA.components.regularSeason).toBeGreaterThan(playoff.optionB.components.regularSeason);
    expect(playoff.optionB.metrics.playoffWeeks.map((week) => week.label)).toEqual(['Playoff 1', 'Playoff 2', 'Championship']);
    expect(playoff.optionB.metrics.playoffWeeks.map((week) => week.games)).toEqual([4, 0, 0]);
    expect(playoff.optionB.metrics.championshipWeek).toMatchObject({ label: 'Championship', start: '2027-03-15', end: '2027-03-21', games: 0 });
  });

  it('counts keeper congestion when estimating usable draft starts', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    workspace.rosterRules.slots = { C: 1, BN: 2 };
    const keeperDraft = established(draftPlayer('keeper', 'Keeper', 'ANA', 8));
    const candidate = established(draftPlayer('candidate', 'Candidate', 'BOS', 4));
    const alternative = established(draftPlayer('alternative', 'Alternative', 'CAR', 3.5));
    const keeper: RosterPlayer = { id: keeperDraft.id, full_name: keeperDraft.name, team: keeperDraft.team, positions: ['C'], current_slot: 'C', games_played: 0, blendedFppg: 8, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } };
    const schedule: SeasonScheduleData = { games: {
      ANA: games('ANA', ['2026-10-01', '2026-10-03']),
      BOS: games('BOS', ['2026-10-01', '2026-10-03']),
      CAR: games('CAR', ['2026-10-02']),
    } };
    const result = compareDraftCandidates(candidate, alternative, [keeperDraft, candidate, alternative], [keeper], workspace, schedule);
    expect(result.optionA.metrics.regularGames).toBe(2);
    expect(result.optionA.metrics.regularUsableStarts).toBe(0);
    expect(result.optionB.metrics.regularUsableStarts).toBe(1);
  });

  it('scores dual eligibility from marginal team starts instead of displaced starts', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    workspace.rosterRules.slots = { C: 1, RW: 1, BN: 3 };
    const centerDraft = established(draftPlayer('center', 'Center anchor', 'ANA', 10, ['C']));
    const wingDraft = established(draftPlayer('wing', 'Wing anchor', 'BOS', 8, ['RW']));
    const centerOnly = established(draftPlayer('single', 'Center only', 'CAR', 6, ['C']));
    const dual = established(draftPlayer('dual', 'Dual eligible', 'COL', 6, ['C', 'RW']));
    const roster: RosterPlayer[] = [
      { id: centerDraft.id, full_name: centerDraft.name, team: centerDraft.team, positions: centerDraft.pos, current_slot: 'C', games_played: 0, blendedFppg: 10, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } },
      { id: wingDraft.id, full_name: wingDraft.name, team: wingDraft.team, positions: wingDraft.pos, current_slot: 'RW', games_played: 0, blendedFppg: 8, stats: { goals: 0, assists: 0, shots_on_goal: 0, power_play_points: 0, blocks: 0 } },
    ];
    const schedule: SeasonScheduleData = { games: {
      ANA: games('ANA', ['2026-10-01']),
      BOS: games('BOS', ['2026-10-02']),
      CAR: games('CAR', ['2026-10-01', '2026-10-02']),
      COL: games('COL', ['2026-10-01', '2026-10-02']),
    } };

    const result = compareDraftCandidates(centerOnly, dual, [centerDraft, wingDraft, centerOnly, dual], roster, workspace, schedule);

    expect(result.optionA.metrics).toMatchObject({ regularUsableStarts: 1, regularAddedStarts: 1 });
    expect(result.optionB.metrics).toMatchObject({ regularUsableStarts: 2, regularAddedStarts: 2 });
    expect(result.optionB.components.regularSeason).toBeGreaterThan(result.optionA.components.regularSeason);
  });

  it('keeps an elite producer ahead when a lower scorer has more off-nights', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season = { ...workspace.season, start: '2026-10-01', end: '2027-04-10' };
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-21' };
    const pastrnak = { ...draftPlayer('pasta', 'David Pastrnak', 'BOS', 4.79, ['RW']), nhlGamesPlayed: 77, birthDate: '1996-05-25' };
    const zibanejad = { ...draftPlayer('zib', 'Mika Zibanejad', 'NYR', 3.99, ['C', 'RW']), nhlGamesPlayed: 81, birthDate: '1993-04-18' };
    const peers = Array.from({ length: 40 }, (_, index) => draftPlayer(`peer-${index}`, `Peer ${index}`, 'CAR', 5.2 - (index * 0.08), index % 2 ? ['C'] : ['RW']));
    const nyrRegular = dateSeries('2026-10-01', 66);
    const bosRegular = dateSeries('2026-10-01', 64);
    const playoffs = dateSeries('2027-03-01', 10);
    const schedule: SeasonScheduleData = { games: {
      NYR: [...games('NYR', nyrRegular, nyrRegular.slice(0, 35)), ...games('NYR', playoffs), ...games('NYR', dateSeries('2027-03-22', 8))],
      BOS: [...games('BOS', bosRegular, bosRegular.slice(0, 21)), ...games('BOS', playoffs), ...games('BOS', dateSeries('2027-03-22', 10))],
      CAR: [...games('CAR', dateSeries('2026-10-01', 65)), ...games('CAR', playoffs), ...games('CAR', dateSeries('2027-03-22', 9))],
    } };

    const comparison = compareDraftCandidates(zibanejad, pastrnak, [zibanejad, pastrnak, ...peers], [], workspace, schedule);
    expect(comparison.winnerId).toBe('pasta');
    expect(comparison.optionA.metrics).toMatchObject({ fantasySeasonGames: 76, postFantasyGames: 7, regularBlockedStarts: 0 });
    expect(comparison.optionB.metrics).toMatchObject({ fantasySeasonGames: 74, postFantasyGames: 9, regularBlockedStarts: 0 });
    expect(comparison.optionB.metrics.projectedFantasyPoints).toBeGreaterThan(comparison.optionA.metrics.projectedFantasyPoints);
  });

  it('projects goalie workload from NHL appearances instead of every team game', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    const starter = goalie('starter', 'Starter', 'ANA', 3.1, 50);
    const backup = goalie('backup', 'Backup', 'BOS', 3.4, 20);
    const peers = Array.from({ length: 12 }, (_, index) => goalie(`g${index}`, `Goalie ${index}`, 'CAR', 3 - (index * 0.05), 40));
    const regularDates = Array.from({ length: 65 }, (_, index) => `2026-${String(10 + Math.floor(index / 28)).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`);
    const schedule: SeasonScheduleData = { games: {
      ANA: games('ANA', regularDates),
      BOS: games('BOS', regularDates),
      CAR: games('CAR', regularDates),
    } };

    const ranked = rankDraftCandidates([starter, backup], [starter, backup, ...peers], [], workspace, schedule);
    const starterScore = ranked.find((candidate) => candidate.player.id === 'starter')!.score;
    const backupScore = ranked.find((candidate) => candidate.player.id === 'backup')!.score;

    expect(starterScore.metrics.projectedGames).toBe(38);
    expect(backupScore.metrics.projectedGames).toBe(28);
    expect(starterScore.metrics.regularGames).toBeGreaterThan(backupScore.metrics.regularGames);
    expect(starterScore.metrics.productionReliability).toBeGreaterThan(backupScore.metrics.productionReliability);
    expect(ranked[0].player.id).toBe('starter');
  });

  it('keeps imported skater workload separate from standardized ranking and schedule value', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    workspace.projections.activeSourceId = 'kodo';
    workspace.projections.sources = [{
      id: 'kodo',
      label: 'Kodo',
      season: '2026-27',
      importedAt: '2026-08-30T00:00:00.000Z',
      matchedCount: 1,
      players: {
        skater: { playerId: 'skater', name: 'Skater', team: 'ANA', projectedFppg: 4, projectedGames: 42, stats: {} },
      },
    }];
    const skater = established(draftPlayer('skater', 'Skater', 'ANA', 4));
    const dates = dateSeries('2026-10-01', 20, 3);
    const schedule: SeasonScheduleData = { games: { ANA: games('ANA', dates) } };

    const score = rankDraftCandidates([skater], [skater], [], workspace, schedule)[0].score;

    expect(score.metrics.projectedGames).toBe(42);
    expect(score.metrics.regularGames).toBe(20);
    expect(score.metrics.standardizedFantasyPoints).toBe(336);
    expect(score.metrics.projectedGames).toBe(42);
  });

  it('does not give goalies a cross-position replacement-value advantage over elite skaters', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    const elite = draftPlayer('elite', 'Elite Skater', 'ANA', 7);
    const goalieCandidate = goalie('goalie', 'Tandem Goalie', 'BOS', 4, 32);
    const skaterPeers = Array.from({ length: 20 }, (_, index) => draftPlayer(`s${index}`, `Skater ${index}`, 'CAR', 5 - (index * 0.1)));
    const goaliePeers = Array.from({ length: 12 }, (_, index) => goalie(`peer-g${index}`, `Goalie ${index}`, 'CAR', 3.8 - (index * 0.08), 55 - index));
    const dates = ['2026-10-01', '2026-10-03', '2026-10-05', '2027-03-01', '2027-03-03'];
    const schedule: SeasonScheduleData = { games: { ANA: games('ANA', dates), BOS: games('BOS', dates), CAR: games('CAR', dates) } };

    const ranked = rankDraftCandidates([elite, goalieCandidate], [elite, goalieCandidate, ...skaterPeers, ...goaliePeers], [], workspace, schedule);
    expect(ranked[0].player.id).toBe('elite');
  });

  it('compares projected fantasy-season production across goalies and skaters', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    const skater = { ...draftPlayer('skater', 'Skater', 'ANA', 6.5), nhlGamesPlayed: 82 };
    const goalieCandidate = goalie('goalie', 'Goalie', 'BOS', 6.8, 36);
    const skaterPeers = Array.from({ length: 12 }, (_, index) => ({
      ...draftPlayer(`s${index}`, `Skater ${index}`, 'CAR', 7.5 - (index * 0.1)),
      nhlGamesPlayed: 82,
    }));
    const goaliePeers = Array.from({ length: 8 }, (_, index) => goalie(`g${index}`, `Goalie ${index}`, 'CAR', 6.6 - (index * 0.15), 32 - index));
    const dates = dateSeries('2026-10-01', 40, 3);
    const schedule: SeasonScheduleData = { games: {
      ANA: games('ANA', dates),
      BOS: games('BOS', dates),
      CAR: games('CAR', dates),
    } };

    const ranked = rankDraftCandidates([skater, goalieCandidate], [skater, goalieCandidate, ...skaterPeers, ...goaliePeers], [], workspace, schedule);
    const skaterScore = ranked.find((candidate) => candidate.player.id === 'skater')!.score;
    const goalieScore = ranked.find((candidate) => candidate.player.id === 'goalie')!.score;

    expect(skaterScore.metrics.projectedFantasyPoints).toBeGreaterThan(goalieScore.metrics.projectedFantasyPoints);
    expect(skaterScore.components.production).toBeGreaterThan(goalieScore.components.production);
    expect(skaterScore.components.regularSeason).toBeGreaterThan(goalieScore.components.regularSeason);
  });

  it('gives two centers distinct position value from their actual VOR', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.numberOfTeams = 2;
    workspace.rosterRules.slots = { C: 1 };
    const directory = [
      draftPlayer('c1', 'Center One', 'ANA', 5),
      draftPlayer('c2', 'Center Two', 'BOS', 4),
      draftPlayer('c3', 'Center Three', 'CAR', 3),
      draftPlayer('c4', 'Center Four', 'COL', 2),
    ];

    const values = buildPositionValuations(directory, workspace);
    expect(values.get('c1')).toMatchObject({ replacementPosition: 'C', replacementFppg: 3, valueOverReplacement: 2 });
    expect(values.get('c2')).toMatchObject({ replacementPosition: 'C', replacementFppg: 3, valueOverReplacement: 1 });
    expect(values.get('c1')!.positionValue).toBeGreaterThan(values.get('c2')!.positionValue);
  });

  it('recognizes a shallower wing market without folding player production into scarcity', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.numberOfTeams = 2;
    workspace.rosterRules.slots = { C: 1, LW: 1 };
    const centers = Array.from({ length: 8 }, (_, index) => draftPlayer(`c${index}`, `Center ${index}`, 'ANA', 5 - (index * 0.2), ['C']));
    const wings = [5, 4, 2, 1].map((fppg, index) => draftPlayer(`lw${index}`, `Wing ${index}`, 'BOS', fppg, ['LW']));

    const values = buildPositionValuations([...centers, ...wings], workspace);
    expect(values.get('lw0')!.marketScarcity).toBeGreaterThan(values.get('c0')!.marketScarcity);
    expect(values.get('lw0')!.positionValue).toBeGreaterThan(values.get('c0')!.positionValue);
  });

  it('adds a transparent eligibility bonus for a useful multi-position player', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.numberOfTeams = 2;
    workspace.rosterRules.slots = { C: 1, LW: 1 };
    const dual = draftPlayer('dual', 'Dual Eligible', 'ANA', 4.5, ['C', 'LW']);
    const directory = [
      dual,
      ...Array.from({ length: 5 }, (_, index) => draftPlayer(`c${index}`, `Center ${index}`, 'BOS', 5 - (index * 0.5), ['C'])),
      ...Array.from({ length: 5 }, (_, index) => draftPlayer(`lw${index}`, `Wing ${index}`, 'CAR', 5 - (index * 0.6), ['LW'])),
    ];

    expect(buildPositionValuations(directory, workspace).get('dual')).toMatchObject({ flexibilityBonus: 3 });
  });

  it('lets shared UTIL demand deepen the replacement baseline', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.numberOfTeams = 2;
    workspace.rosterRules.slots = { C: 1, UTIL: 0 };
    const directory = [5, 4.5, 4, 3.5, 3, 2.5].map((fppg, index) => draftPlayer(`c${index}`, `Center ${index}`, 'ANA', fppg));
    const withoutUtil = buildPositionValuations(directory, workspace).get('c0')!;
    workspace.rosterRules.slots.UTIL = 1;
    const withUtil = buildPositionValuations(directory, workspace).get('c0')!;

    expect(withUtil.replacementFppg).toBeLessThan(withoutUtil.replacementFppg);
    expect(withUtil.valueOverReplacement).toBeGreaterThan(withoutUtil.valueOverReplacement);
  });

  it('recalculates the future free-agent baseline from live draft demand', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.numberOfTeams = 2;
    workspace.rosterRules.slots = { C: 1 };
    const directory = [5, 4, 3, 2].map((fppg, index) => draftPlayer(`c${index}`, `Center ${index}`, 'ANA', fppg));
    const before = buildPositionValuations(directory, workspace).get('c0')!;
    workspace.draftSession.picks.push({
      playerId: 'c3',
      fullName: 'Center 3',
      team: 'ANA',
      positions: ['C'],
      status: 'taken',
      source: 'manual',
      madeAt: new Date().toISOString(),
    });
    const after = buildPositionValuations(directory, workspace).get('c0')!;

    expect(before.replacementFppg).toBe(3);
    expect(after.replacementFppg).toBe(4);
  });

  it('updates defence replacement and scarcity after a defence run', () => {
    const workspace = createDefaultLeagueWorkspace(); workspace.numberOfTeams = 2; workspace.rosterRules.slots = { D: 1, C: 1 };
    const directory = [draftPlayer('d1', 'Defence One', 'ANA', 5, ['D']), draftPlayer('d2', 'Defence Two', 'BOS', 4, ['D']), draftPlayer('d3', 'Defence Three', 'CAR', 3, ['D']), draftPlayer('d4', 'Defence Four', 'COL', 2, ['D']), draftPlayer('c1', 'Center One', 'DAL', 5, ['C']), draftPlayer('c2', 'Center Two', 'EDM', 4, ['C']), draftPlayer('c3', 'Center Three', 'FLA', 3, ['C']), draftPlayer('c4', 'Center Four', 'LAK', 2, ['C'])];
    const before = buildPositionValuations(directory, workspace).get('d1')!;
    workspace.draftSession.picks.push({ playerId: 'd3', fullName: 'Defence Three', team: 'CAR', positions: ['D'], status: 'taken', source: 'manual', madeAt: new Date().toISOString() });
    const after = buildPositionValuations(directory, workspace).get('d1')!;
    expect(after.replacementFppg).toBeGreaterThan(before.replacementFppg);
    expect(after.marketScarcity).not.toBe(before.marketScarcity);
  });

  it('does not invent replacement demand for a disabled position', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.numberOfTeams = 2;
    workspace.rosterRules.slots = { C: 0, LW: 1 };
    const center = draftPlayer('c', 'Center', 'ANA', 5, ['C']);
    const wings = [4, 3, 2].map((fppg, index) => draftPlayer(`lw${index}`, `Wing ${index}`, 'BOS', fppg, ['LW']));

    expect(buildPositionValuations([center, ...wings], workspace).get('c')).toMatchObject({
      replacementPosition: null,
      positionValue: 0,
      valueOverReplacement: 0,
    });
  });

  it('persists a transparent personal adjustment without changing league FPPG', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    const a = draftPlayer('a', 'Model Favorite', 'ANA', 5);
    const b = draftPlayer('b', 'My Favorite', 'BOS', 4.9);
    const schedule: SeasonScheduleData = { games: { ANA: games('ANA', ['2026-10-01']), BOS: games('BOS', ['2026-10-01']) } };

    const baseline = rankDraftCandidates([a, b], [a, b], [], workspace, schedule).find((candidate) => candidate.player.id === 'b')!;
    workspace.draftSession.rankAdjustments = { b: 20 };
    const adjusted = rankDraftCandidates([a, b], [a, b], [], workspace, schedule).find((candidate) => candidate.player.id === 'b')!;
    expect(adjusted.score.total).toBe(baseline.score.total + 20);
    expect(adjusted.score.metrics).toMatchObject({ fppg: 4.9, manualAdjustment: 20 });
  });

  it('uses the selected production basis throughout a draft comparison', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    workspace.projections.activeSourceId = 'external';
    workspace.projections.sources = [{
      id: 'external',
      label: 'External projections',
      season: '2026-27',
      importedAt: '2026-08-30T00:00:00.000Z',
      matchedCount: 1,
      players: {
        a: { playerId: 'a', name: 'Player A', team: 'ANA', projectedFppg: 8, projectedGames: 70, stats: {} },
      },
    }];
    const a = established(draftPlayer('a', 'Player A', 'ANA', 4));
    const b = established(draftPlayer('b', 'Player B', 'BOS', 5));
    const schedule: SeasonScheduleData = { games: {
      ANA: games('ANA', ['2026-10-01', '2026-10-03']),
      BOS: games('BOS', ['2026-10-01', '2026-10-03']),
    } };

    const projected = compareDraftCandidates(a, b, [a, b], [], workspace, schedule, 'projection');
    const actual = compareDraftCandidates(a, b, [a, b], [], workspace, schedule, 'last-season');

    expect(projected.optionA.metrics.projectedFppg).toBe(8);
    expect(projected.winnerId).toBe('a');
    expect(actual.optionA.metrics.projectedFppg).toBe(4);
    expect(actual.winnerId).toBe('b');
  });
});
