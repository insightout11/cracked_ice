import fs from 'node:fs';
import path from 'node:path';

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  return cells;
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve('web/src/data/kkupfl-adp-2026-27.json');
if (!inputPath) throw new Error('Usage: node scripts/import-kkupfl-adp.mjs <draft_players_table.csv> [output.json]');

const lines = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const headers = parseCsvLine(lines.shift());
const column = Object.fromEntries(headers.map((header, index) => [header, index]));
for (const required of ['NHL ID', 'Name', 'Team', 'Pos', 'Rank', 'ADP']) {
  if (column[required] === undefined) throw new Error(`Missing required column: ${required}`);
}

const players = lines.flatMap((line) => {
  const cells = parseCsvLine(line);
  const nhlId = cells[column['NHL ID']]?.trim();
  const adp = Number(cells[column.ADP]);
  const rank = Number(cells[column.Rank]);
  if (!nhlId || !Number.isFinite(adp) || adp <= 0) return [];
  return [{
    nhlId,
    name: cells[column.Name].trim(),
    team: cells[column.Team].trim(),
    positions: cells[column.Pos].split(',').map((value) => value.trim()).filter(Boolean),
    rank: Number.isFinite(rank) && rank > 0 ? rank : null,
    adp,
  }];
}).sort((a, b) => a.adp - b.adp || (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY));

const output = {
  source: 'KKUPFL Draft Platform',
  sourceDraftId: 672,
  season: '2026-27',
  updatedAt: '2026-09-10',
  playerCount: players.length,
  players,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${players.length} KKUPFL ADP records to ${outputPath}`);
