import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { applyActiveProjectionFppg, CONSENSUS_PROJECTION_ID, CRACKED_ICE_PROJECTION_ID, importProjectionCsv, importProjectionTables, projectionSelectionValue, projectionStatSelection } from './projectionImport';
import type { DraftPlayer } from './playerSearch';

const directory: DraftPlayer[] = [
  { id: 'nhl:1', name: 'Connor Example', team: 'EDM', pos: ['C'], aliases: ['C. Example'], blendedFppg: 2, productionValue: 2, productionLabel: 'FPPG' },
  { id: 'nhl:2', name: 'Goalie Example', team: 'BOS', pos: ['G'], aliases: [], blendedFppg: 2, productionValue: 2, productionLabel: 'FPPG' },
];

describe('projection imports', () => {
  it('matches players and accepts supplied FPPG', () => {
    const result = importProjectionCsv('Player,Team,GP,FPPG\nConnor Example,EDM,80,3.25', 'Source A', '2026-27', directory, createDefaultLeagueWorkspace(), '2026-08-29T00:00:00.000Z');
    expect(result.source.players['1']).toMatchObject({ projectedFppg: 3.25, projectedGames: 80 });
    expect(result.issues).toEqual([]);
  });

  it('preserves the configured 84-game 2026-27 season', () => {
    const result = importProjectionCsv('Player,Team,GP,FPPG\nConnor Example,EDM,84,3.25', 'Source A', '2026-27', directory, createDefaultLeagueWorkspace(), '2026-08-29T00:00:00.000Z');
    expect(result.source.players['1'].projectedGames).toBe(84);
  });

  it('calculates league FPPG from projected stat totals', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.scoring.skater = { goals: 2, assists: 1 };
    const result = importProjectionCsv('Player,GP,G,A\nConnor Example,80,40,60', 'Stats', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z');
    expect(result.source.players['1'].projectedFppg).toBe(1.75);
    expect(result.source.players['1'].stats).toMatchObject({ goals: 40, assists: 60, games: 80 });
  });

  it('preserves a projection source plus-minus column for category comparison', () => {
    const result = importProjectionCsv('Player,GP,FPPG,+/-\nConnor Example,80,3.25,18', 'Stats', '2026-27', directory, createDefaultLeagueWorkspace(), '2026-08-29T00:00:00.000Z');
    expect(result.source.players['1'].stats.plus_minus).toBe(18);
  });

  it('imports Kodo-style skater and goalie sheets and uses goalie starts as the denominator', () => {
    const workspace = createDefaultLeagueWorkspace();
    workspace.scoring.skater = { goals: 2, assists: 1 };
    workspace.scoring.goalie = { wins: 2, saves: 0.1 };
    const result = importProjectionTables([
      { name: 'Read me', rows: [['Projection workbook'], ['Generated for testing']] },
      { name: 'Skaters', rows: [['player_id', 'Player', 'Team', 'Pos', 'GP', 'G', 'A'], [1, 'Connor Example', 'EDM', 'C', 80, 40, 60]] },
      { name: 'Goalies', rows: [['player_id', 'Goalie', 'Team', 'GS', 'W', 'SV'], [2, 'Goalie Example', 'BOS', 50, 30, 1400]] },
    ], 'Kodo', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z');
    expect(result.totalRows).toBe(2);
    expect(result.source.matchedCount).toBe(2);
    expect(result.source.players['1']).toMatchObject({ projectedFppg: 1.75, projectedGames: 80 });
    expect(result.source.players['2']).toMatchObject({ projectedFppg: 4, projectedGames: 50 });
    expect(result.issues).toEqual([]);
  });

  it('finds a player table below workbook title rows', () => {
    const result = importProjectionTables([{ name: 'Projections', rows: [['My projections'], [], ['Player', 'GP', 'FPPG'], ['Connor Example', 80, 3.1]] }], 'Source', '2026-27', directory, createDefaultLeagueWorkspace(), '2026-08-29T00:00:00.000Z');
    expect(result.source.players['1']).toMatchObject({ projectedFppg: 3.1, projectedGames: 80 });
    expect(result.issues).toEqual([]);
  });

  it('reports unmatched players without applying them', () => {
    const result = importProjectionCsv('Player,GP,FPPG\nUnknown Player,82,3', 'Source', '2026-27', directory, createDefaultLeagueWorkspace(), '2026-08-29T00:00:00.000Z');
    expect(result.source.matchedCount).toBe(0);
    expect(result.issues[0].reason).toContain('match');
  });

  it('overrides comparison production without changing schedule starts', () => {
    const workspace = createDefaultLeagueWorkspace();
    const imported = importProjectionCsv('Player,GP,FPPG\nConnor Example,80,3.25', 'Source A', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z').source;
    workspace.projections = { activeSourceId: imported.id, consensusSourceIds: [CRACKED_ICE_PROJECTION_ID, imported.id], sources: [imported] };
    const result = applyActiveProjectionFppg({ '1': { fppg: 2, starts: 10, gamesAvailable: 12, projectedPoints: 20, offNightRate: 0.5, strengthOfSchedule: 5 } }, workspace);
    expect(result['1']).toMatchObject({ fppg: 3.25, starts: 10, gamesAvailable: 12, projectedPoints: 32.5 });
  });

  it('builds an equal-weight consensus from the selected sources', () => {
    const workspace = createDefaultLeagueWorkspace();
    const imported = importProjectionCsv('Player,GP,FPPG\nConnor Example,80,4', 'Source A', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z').source;
    workspace.projections = { activeSourceId: CONSENSUS_PROJECTION_ID, consensusSourceIds: [CRACKED_ICE_PROJECTION_ID, imported.id], sources: [imported] };
    expect(projectionSelectionValue(workspace, '1', { projectedFppg: 2, projectedGames: 84 })).toMatchObject({ projectedFppg: 3, projectedGames: 82, sourceCount: 2, fallback: false });
  });

  it('builds an equal-weight projected stat line from the selected sources', () => {
    const workspace = createDefaultLeagueWorkspace();
    const imported = importProjectionCsv('Player,GP,FPPG,G,A\nConnor Example,80,4,40,60', 'Source A', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z').source;
    workspace.projections = { activeSourceId: CONSENSUS_PROJECTION_ID, consensusSourceIds: [CRACKED_ICE_PROJECTION_ID, imported.id], sources: [imported] };
    const result = projectionStatSelection(workspace, '1', { goals: 30, assists: 50 });

    expect(result).toMatchObject({ label: 'Consensus (2)', sourceCount: 2, fallback: false });
    expect(result.stats).toMatchObject({ goals: 35, assists: 55 });
  });

  it('normalizes each consensus source before averaging a per-84 stat line', () => {
    const workspace = createDefaultLeagueWorkspace();
    const imported = importProjectionCsv('Player,GP,FPPG,P\nConnor Example,78,4,60.8', 'Kodo', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z').source;
    workspace.projections = { activeSourceId: CONSENSUS_PROJECTION_ID, consensusSourceIds: [CRACKED_ICE_PROJECTION_ID, imported.id], sources: [imported] };
    const result = projectionStatSelection(workspace, '1', { goals: 20, assists: 31 }, { crackedIceGames: 74, paceGames: 84 });

    expect(result.stats.points).toBeCloseTo(60.8 * 84 / 78, 2);
    expect(result.stats.points).toBe(65.477);
    expect(result.statLineGames).toBe(84);
  });

  it('marks an unmatched player as a Cracked Ice fallback for a single imported source', () => {
    const workspace = createDefaultLeagueWorkspace();
    const imported = importProjectionCsv('Player,GP,FPPG\nConnor Example,80,4', 'Source A', '2026-27', directory, workspace, '2026-08-29T00:00:00.000Z').source;
    workspace.projections = { activeSourceId: imported.id, consensusSourceIds: [CRACKED_ICE_PROJECTION_ID, imported.id], sources: [imported] };
    expect(projectionSelectionValue(workspace, '2', { projectedFppg: 2, projectedGames: 30 })).toMatchObject({ label: 'Cracked Ice fallback', fallback: true });
  });
});
