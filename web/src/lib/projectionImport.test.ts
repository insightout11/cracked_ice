import { describe, expect, it } from 'vitest';
import { createDefaultLeagueWorkspace } from './leagueWorkspace';
import { applyActiveProjectionFppg, importProjectionCsv, importProjectionTables } from './projectionImport';
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
    workspace.projections = { activeSourceId: imported.id, sources: [imported] };
    const result = applyActiveProjectionFppg({ '1': { fppg: 2, starts: 10, gamesAvailable: 12, projectedPoints: 20, offNightRate: 0.5, strengthOfSchedule: 5 } }, workspace);
    expect(result['1']).toMatchObject({ fppg: 3.25, starts: 10, gamesAvailable: 12, projectedPoints: 32.5 });
  });
});
