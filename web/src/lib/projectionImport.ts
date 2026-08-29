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

const aliases: Record<string, string[]> = {
  name: ['player', 'player name', 'name', 'full name', 'goalie', 'goaltender', 'skater'], team: ['team', 'tm'], id: ['player id', 'playerid', 'nhl id', 'id'],
  games: ['gp', 'games', 'projected games'], fppg: ['fppg', 'fantasy points per game', 'projected fppg'],
  goals: ['g', 'goals'], assists: ['a', 'assists'], points: ['p', 'pts', 'points'], plus_minus: ['+/-', 'plus minus', 'plus_minus'], penalty_minutes: ['pim', 'penalty minutes'],
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

function key(value: unknown) { return String(value ?? '').trim().toLocaleLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' '); }
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
  const issues: ProjectionImportIssue[] = []; const players: Record<string, LeagueWorkspace['projections']['sources'][number]['players'][string]> = {}; let totalRows = 0;

  usableTables.forEach((table) => {
    const headers = table.rows[table.header].map(key); const column = (field: string) => columnFor(headers, field);
    const dataRows = table.rows.slice(table.header + 1).filter((row) => row.some((cell) => String(cell ?? '').trim())); totalRows += dataRows.length;
    dataRows.forEach((row, index) => {
      const rawName = String(row[column('name')] ?? '').trim(); const rawId = String(row[column('id')] ?? '').trim().replace(/^nhl:/, '').replace(/\.0$/, ''); const team = String(row[column('team')] ?? '').trim().toUpperCase();
      let player = rawId ? byId.get(rawId) : undefined;
      if (!player && rawName) { const matches = byName.get(normalizeName(rawName)) ?? []; player = matches.find((candidate) => !team || candidate.team === team) ?? (matches.length === 1 ? matches[0] : undefined); }
      const issueBase = { row: table.header + index + 2, name: rawName || rawId || 'Unknown', ...(table.name ? { sheet: table.name } : {}) };
      if (!player) { issues.push({ ...issueBase, reason: 'No unique NHL player match' }); return; }
      const isGoalie = player.pos.includes('G'); const gamesColumn = isGoalie && column('games') < 0 ? column('games_started') : column('games'); const games = numeric(row[gamesColumn]) ?? 82; let fppg = numeric(row[column('fppg')]);
      if (fppg === undefined) { const weights = isGoalie ? workspace.scoring.goalie : workspace.scoring.skater; let total = 0; let used = 0;
        Object.entries(weights).forEach(([stat, weight]) => { const idx = column(stat); const value = numeric(row[idx]); if (value !== undefined) { total += value * weight; used += 1; } });
        if (!used || games <= 0) { issues.push({ ...issueBase, name: player.name, reason: 'No usable FPPG or league-scored stat columns' }); return; } fppg = total / games;
      }
      const id = player.id.replace(/^nhl:/, ''); players[id] = { playerId: player.id, name: player.name, team: player.team, projectedFppg: Number(fppg.toFixed(3)), projectedGames: Math.min(SEASON_GAMES_PER_TEAM, Math.max(0, games)) };
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
  return importProjectionTables(tables, label, season, directory, workspace, now);
}

export function activeProjectionSource(workspace: LeagueWorkspace) { return workspace.projections.sources.find((source) => source.id === workspace.projections.activeSourceId) ?? null; }

export function applyActiveProjectionFppg(projections: Record<string, PlayerProjection>, workspace: LeagueWorkspace): Record<string, PlayerProjection> {
  const source = activeProjectionSource(workspace); if (!source) return projections;
  return Object.fromEntries(Object.entries(projections).map(([id, projection]) => { const imported = source.players[id.replace(/^nhl:/, '')]; return [id, imported?.projectedFppg === undefined ? projection : { ...projection, fppg: imported.projectedFppg, projectedPoints: imported.projectedFppg * projection.starts }]; }));
}
