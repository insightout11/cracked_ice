import { describe, expect, it } from 'vitest';
import { buildPositionValuations, compareDraftCandidates, rankDraftCandidates } from './draftStrategy';
import { createDefaultLeagueWorkspace, DRAFT_STRATEGY_PRESETS } from './leagueWorkspace';
import type { DraftPlayer } from './playerSearch';
import type { RosterPlayer } from './coachSchemas';
import type { SeasonScheduleData } from './schedulePlanning';

function draftPlayer(id: string, name: string, team: string, fppg: number, pos: string[] = ['C']): DraftPlayer {
  return { id, name, team, pos, aliases: [], blendedFppg: fppg, productionValue: fppg, productionLabel: 'FPPG', scoringBreakdown: null };
}

function goalie(id: string, name: string, team: string, fppg: number, gamesPlayed: number): DraftPlayer {
  return { id, name, team, pos: ['G'], aliases: [], blendedFppg: fppg, productionValue: fppg, productionLabel: 'FPPG', nhlGamesPlayed: gamesPlayed, scoringBreakdown: { gamesPlayed, fppg, contributions: [] } };
}

function games(team: string, dates: string[], offNights: string[] = []) {
  return dates.map((date) => ({ date, opponent: team === 'ANA' ? 'BOS' : 'ANA', isHome: true, isOffNight: offNights.includes(date), startTime: `${date}T23:00:00Z` }));
}

describe('draft strategy analysis', () => {
  it('can prefer a playoff schedule without hiding the regular-season tradeoff', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.season.end = '2027-04-10';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-21' };
    const a = draftPlayer('a', 'Production Lead', 'ANA', 5.1);
    const b = draftPlayer('b', 'Playoff Lead', 'BOS', 5.05);
    const directory = [a, b, ...Array.from({ length: 10 }, (_, index) => draftPlayer(`p${index}`, `Peer ${index}`, 'CAR', 4.95 - (index * 0.05)))];
    const schedule: SeasonScheduleData = { games: {
      ANA: [...games('ANA', ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07'], ['2026-10-01']), ...games('ANA', ['2027-03-02'])],
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
    expect(playoff.explanation).toContain('stronger regular-season schedule');
    expect(playoff.optionB.metrics.playoffWeeks.map((week) => week.label)).toEqual(['Playoff 1', 'Playoff 2', 'Championship']);
    expect(playoff.optionB.metrics.playoffWeeks.map((week) => week.games)).toEqual([4, 0, 0]);
    expect(playoff.optionB.metrics.championshipWeek).toMatchObject({ label: 'Championship', start: '2027-03-15', end: '2027-03-21', games: 0 });
  });

  it('counts keeper congestion when estimating usable draft starts', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.season.start = '2026-10-01';
    workspace.schedule.playoffs = { start: '2027-03-01', end: '2027-03-07' };
    workspace.rosterRules.slots = { C: 1, BN: 2 };
    const keeperDraft = draftPlayer('keeper', 'Keeper', 'ANA', 8);
    const candidate = draftPlayer('candidate', 'Candidate', 'BOS', 4);
    const alternative = draftPlayer('alternative', 'Alternative', 'CAR', 3.5);
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

  it('gives two centers the same position market while preserving their distinct VOR', () => {
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
    expect(values.get('c1')?.positionValue).toBe(values.get('c2')?.positionValue);
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

    expect(buildPositionValuations(directory, workspace).get('dual')).toMatchObject({ flexibilityBonus: 6 });
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
});
