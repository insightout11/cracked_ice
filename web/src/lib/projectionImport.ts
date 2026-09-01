import type { CellValue } from 'read-excel-file/browser';
import type { DraftPlayer } from './playerSearch';
import type { LeagueWorkspace } from './leagueWorkspace';
import type { PlayerProjection } from './coachSchemas';
import { SEASON_GAMES_PER_TEAM } from './season';

export interface ProjectionImportIssue { row: number; name: string; reason: string; sheet?: string }
export interface ProjectionImportResult {
  source: LeagueWorkspace['projections']['sources'][number];
  issues: ProjectionImportIssue[];
  totalRows: number;
}
export interface ProjectionImportTable { name?: string; rows: unknown[][] }
export const CRACKED_ICE_PROJECTION_ID = 'cracked-ice';
export const CONSENSUS_PROJECTION_ID = 'consensus';

const aliases: Record<string, string[]> = {
  name: ['player', 'player name', 'name', 'full name', 'goalie', 'goaltender', 'skater'], team: ['team', 'tm'], id: ['player id', 'playerid', 'nhl id', 'id'],
  games: ['gp', 'games', 'projected games'], fppg: ['fppg', 'fantasy points per game', 'projected fppg'],
  goals: ['g', 'goals'], assists: ['a', 'assists'], points: ['p', 'pts', 'points'], plus_minus: ['+/', '+/-', 'plus minus', 'plus_minus'], penalty_minutes: ['pim', 'penalty minutes'],
  powerplay_goals: ['ppg', 'power play goals', 'powerplay goals'], power_play_goals: ['ppg', 'power play goals', 'powerplay goals'],
  powerplay_assists: ['ppa', 'power play assists', 'powerplay assists'], power_play_assists: ['ppa', 'power play assists', 'powerplay assists'],
  powerplay_points: ['ppp', 'power play points', 'powerplay points'], power_play_points: ['ppp', 'power play points', 'powerplay points'],
  shorthanded_goals: ['shg', 'short handed goals', 'shorthanded goals'], shorthanded_assists: ['sha', 'short handed assists', 'shorthanded assists'],
  shorthanded_points: ['shp', 'short handed points', 'shorthanded points'], game_winning_goals: ['gwg', 'game winning goals'],
  shots_on_goal: ['sog', 'shots', 'shots on goal'], hits: ['hit', 'hits'], blocks: ['blk', 'blocks'], faceoffs_won: ['fow', 'faceoffs won'], faceoffs_lost: ['fol', 'faceoffs lost'],
  wins: ['w', 'wins'], losses: ['l', 'losses'], overtime_losses: ['otl', 'overtime losses'], goals_against: ['ga', 'goals against'],
  goals_against_average: ['gaa', 'goals against average'], saves: ['sv', 'saves'], shots_against: ['sa', 'shots against'], save_percentage: ['sv%', 'save percentage', 'save pct'],
  shutouts: ['sho', 'shutouts'], games_started: ['gs', 'games started'],
};

function key(value: unknown) { return String(value ?? '').trim().toLocaleLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, ''); }
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}
function numeric(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const text = String(value ?? '').trim(); if (!text) return undefined;
  const parsed = Number(text.replace(/[%,$]/g, '')); return Number.isFinite(parsed) ? parsed : undefined;
}
function columnFor(headers: string[], field: string) { return headers.findIndex((header) => aliases[field]?.includes(header)); }
function headerIndex(rows: unknown[][]) {
  return rows.slice(0, 25).findIndex((row) => {
    const headers = row.map(key);
    const identity = columnFor(headers, 'name') >= 0 || columnFor(headers, 'id') >= 0;
    const production = columnFor(headers, 'fppg') >= 0 || columnFor(headers, 'games') >= 0 || columnFor(headers, 'games_started') >= 0;
    return identity && production;
  });
}

export function importProjectionTables(tables: ProjectionImportTable[], label: string, season: string, directory: DraftPlayer[], workspace: LeagueWorkspace, now = new Date().toISOString()): ProjectionImportResult {
  const usableTables = tables.map((table) => ({ ...table, header: headerIndex(table.rows) })).filter((table) => table.header >= 0);
  if (!usableTables.length) throw new Error('No player table was found. Add Player/Goalie or Player ID, plus GP, GS, or FPPG columns.');
  const byId = new Map(directory.map((player) => [player.id.replace(/^nhl:/, ''), player]));
  const byName = new Map<string, DraftPlayer[]>();
  directory.forEach((player) => [player.name, ...player.aliases].forEach((name) => { const normalized = normalizeName(name); byName.set(normalized, [...(byName.get(normalized) ?? []), player]); }));
  const issues: ProjectionImportIssue[] = []; const players: Record<string, LeagueWorkspace['projections']['sources'][number]['players'][string]> = {}; const seenRows = new Set<string>(); let totalRows = 0;

  usableTables.forEach((table) => {
    const headers = table.rows[table.header].map(key); const column = (field: string) => columnFor(headers, field);
    const dataRows = table.rows.slice(table.header + 1).filter((row) => row.some((cell) => String(cell ?? '').trim()));
    dataRows.forEach((row, index) => {
      const rawName = String(row[column('name')] ?? '').trim(); const rawId = String(row[column('id')] ?? '').trim().replace(/^nhl:/, '').replace(/\.0$/, ''); const team = String(row[column('team')] ?? '').trim().toUpperCase();
      const rowIdentity = rawId ? `id:${rawId}` : rawName ? `name:${normalizeName(rawName)}:${team}` : `row:${table.name ?? ''}:${table.header + index + 2}`;
      if (seenRows.has(rowIdentity)) return;
      seenRows.add(rowIdentity); totalRows += 1;
      let player = rawId ? byId.get(rawId) : undefined;
      if (!player && rawName) { const matches = byName.get(normalizeName(rawName)) ?? []; player = matches.find((candidate) => !team || candidate.team === team) ?? (matches.length === 1 ? matches[0] : undefined); }
      const issueBase = { row: table.header + index + 2, name: rawName || rawId || 'Unknown', ...(table.name ? { sheet: table.name } : {}) };
      if (!player) { issues.push({ ...issueBase, reason: 'No unique NHL player match' }); return; }
      const isGoalie = player.pos.includes('G'); const gamesColumn = isGoalie && column('games') < 0 ? column('games_started') : column('games'); const games = numeric(row[gamesColumn]) ?? 82; let fppg = numeric(row[column('fppg')]);
      if (fppg === undefined) { const weights = isGoalie ? workspace.scoring.goalie : workspace.scoring.skater; let total = 0; let used = 0;
        Object.entries(weights).forEach(([stat, weight]) => { const idx = column(stat); const value = numeric(row[idx]); if (value !== undefined) { total += value * weight; used += 1; } });
        if (!used || games <= 0) { issues.push({ ...issueBase, name: player.name, reason: 'No usable FPPG or league-scored stat columns' }); return; } fppg = total / games;
      }
      const stats: Record<string, number> = {};
      Object.keys(aliases).forEach((field) => {
        if (['name', 'team', 'id', 'fppg', 'games'].includes(field)) return;
        const value = numeric(row[column(field)]);
        if (value !== undefined) stats[field] = value;
      });
      stats.games = games;
      const id = player.id.replace(/^nhl:/, ''); players[id] = { playerId: player.id, name: player.name, team: player.team, projectedFppg: Number(fppg.toFixed(3)), projectedGames: Math.min(SEASON_GAMES_PER_TEAM, Math.max(0, games)), stats };
    });
  });
  const sourceId = `projection-${Date.parse(now)}-${Math.random().toString(36).slice(2, 7)}`;
  return { totalRows, issues, source: { id: sourceId, label: label.trim() || 'Imported projections', season, importedAt: now, matchedCount: Object.keys(players).length, players } };
}

export function importProjectionCsv(text: string, label: string, season: string, directory: DraftPlayer[], workspace: LeagueWorkspace, now = new Date().toISOString()): ProjectionImportResult {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('The CSV needs a header row and at least one player.');
  return importProjectionTables([{ rows }], label, season, directory, workspace, now);
}

export async function importProjectionWorkbook(file: File, label: string, season: string, directory: DraftPlayer[], workspace: LeagueWorkspace, now = new Date().toISOString()): Promise<ProjectionImportResult> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const workbook = await readXlsxFile(file); const tables = workbook.map(({ sheet, data }) => ({ name: sheet, rows: data as CellValue[][] }));
  const result = importProjectionTables(tables, label, season, directory, workspace, now);
  return { ...result, source: { ...result.source, fileName: file.name } };
}

export function activeProjectionSource(workspace: LeagueWorkspace) { return workspace.projections.sources.find((source) => source.id === workspace.projections.activeSourceId) ?? null; }

export function activeProjectionLabel(workspace: LeagueWorkspace): string {
  if (workspace.projections.activeSourceId === CONSENSUS_PROJECTION_ID) {
    const count = workspace.projections.consensusSourceIds.length;
    return `Consensus (${count || 1})`;
  }
  return activeProjectionSource(workspace)?.label ?? 'Cracked Ice';
}

export function projectionSelectionValue(
  workspace: LeagueWorkspace,
  playerId: string,
  crackedIce: { projectedFppg: number; projectedGames: number },
): { projectedFppg: number; projectedGames: number; label: string; fallback: boolean; sourceCount: number } {
  const id = playerId.replace(/^nhl:/, '');
  if (workspace.projections.activeSourceId === CONSENSUS_PROJECTION_ID) {
    const selected = workspace.projections.consensusSourceIds.length
      ? workspace.projections.consensusSourceIds
      : [CRACKED_ICE_PROJECTION_ID, ...workspace.projections.sources.map((source) => source.id)];
    const values = selected.flatMap((sourceId) => {
      if (sourceId === CRACKED_ICE_PROJECTION_ID) return [crackedIce];
      const value = workspace.projections.sources.find((source) => source.id === sourceId)?.players[id];
      return value ? [{ projectedFppg: value.projectedFppg, projectedGames: value.projectedGames }] : [];
    });
    if (!values.length) return { ...crackedIce, label: 'Cracked Ice fallback', fallback: true, sourceCount: 0 };
    return {
      projectedFppg: Number((values.reduce((sum, value) => sum + value.projectedFppg, 0) / values.length).toFixed(3)),
      projectedGames: Number((values.reduce((sum, value) => sum + value.projectedGames, 0) / values.length).toFixed(1)),
      label: `Consensus (${values.length})`,
      fallback: false,
      sourceCount: values.length,
    };
  }
  const source = activeProjectionSource(workspace);
  if (!source) return { ...crackedIce, label: 'Cracked Ice', fallback: false, sourceCount: 1 };
  const value = source.players[id];
  if (!value) return { ...crackedIce, label: 'Cracked Ice fallback', fallback: true, sourceCount: 0 };
  return { projectedFppg: value.projectedFppg, projectedGames: value.projectedGames, label: source.label, fallback: false, sourceCount: 1 };
}

export function projectionStatSelection(
  workspace: LeagueWorkspace,
  playerId: string,
  crackedIceStats: Record<string, number>,
  options: { crackedIceGames?: number; paceGames?: number } = {},
): { stats: Record<string, number>; label: string; fallback: boolean; sourceCount: number; statLineGames?: number } {
  const id = playerId.replace(/^nhl:/, '');
  const rateStats = new Set(['save_percentage', 'goals_against_average']);
  const normalizeStats = (stats: Record<string, number>, sourceGames?: number) => {
    if (!options.paceGames || !sourceGames || sourceGames <= 0) return stats;
    return Object.fromEntries(Object.entries(stats).map(([key, value]) => [
      key,
      key === 'games' ? options.paceGames : rateStats.has(key) ? value : Number((value * options.paceGames! / sourceGames).toFixed(3)),
    ]));
  };
  if (workspace.projections.activeSourceId === CONSENSUS_PROJECTION_ID) {
    const selected = workspace.projections.consensusSourceIds.length
      ? workspace.projections.consensusSourceIds
      : [CRACKED_ICE_PROJECTION_ID, ...workspace.projections.sources.map((source) => source.id)];
    const statLines = selected.flatMap((sourceId) => {
      if (sourceId === CRACKED_ICE_PROJECTION_ID) return Object.keys(crackedIceStats).length
        ? [normalizeStats(crackedIceStats, options.crackedIceGames)]
        : [];
      const player = workspace.projections.sources.find((source) => source.id === sourceId)?.players[id];
      return player?.stats && Object.keys(player.stats).length ? [normalizeStats(player.stats, player.projectedGames)] : [];
    });
    if (!statLines.length) return { stats: normalizeStats(crackedIceStats, options.crackedIceGames), label: 'Cracked Ice fallback', fallback: true, sourceCount: 0, statLineGames: options.paceGames };
    const keys = new Set(statLines.flatMap((stats) => Object.keys(stats)));
    const stats = Object.fromEntries([...keys].flatMap((key) => {
      const values = statLines.flatMap((line) => line[key] === undefined ? [] : [line[key]]);
      return values.length ? [[key, Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))]] : [];
    }));
    return { stats, label: `Consensus (${statLines.length})`, fallback: false, sourceCount: statLines.length, statLineGames: options.paceGames };
  }
  const source = activeProjectionSource(workspace);
  if (!source) return { stats: normalizeStats(crackedIceStats, options.crackedIceGames), label: 'Cracked Ice', fallback: false, sourceCount: 1, statLineGames: options.paceGames };
  const sourcePlayer = source.players[id];
  const stats = sourcePlayer?.stats;
  if (!stats || !Object.keys(stats).length) return { stats: normalizeStats(crackedIceStats, options.crackedIceGames), label: 'Cracked Ice fallback', fallback: true, sourceCount: 0, statLineGames: options.paceGames };
  return { stats: normalizeStats(stats, sourcePlayer.projectedGames), label: source.label, fallback: false, sourceCount: 1, statLineGames: options.paceGames };
}

export function applyActiveProjectionFppg(projections: Record<string, PlayerProjection>, workspace: LeagueWorkspace): Record<string, PlayerProjection> {
  return Object.fromEntries(Object.entries(projections).map(([id, projection]) => {
    const selected = projectionSelectionValue(workspace, id, { projectedFppg: projection.fppg, projectedGames: projection.gamesAvailable });
    return [id, { ...projection, fppg: selected.projectedFppg, projectedPoints: selected.projectedFppg * projection.starts }];
  }));
}
