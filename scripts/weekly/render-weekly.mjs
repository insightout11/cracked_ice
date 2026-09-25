/**
 * Renders the Weekly Edge graphics:
 *   week-<start>-glance.png   the week in one picture (light vs packed nights, room per night)
 *   week-<start>-chain.png    the team chain for one open spot, with options by ownership
 *   week-<start>-quick.png    quick hits: teams to target this week, next 2 weeks, next 30 days
 *
 * Numbers come from content/generated/<season>/weekly/<start>.json (weekly-edge.ts).
 * Editorial choices (which teams go on the quick-hits card, the chain to feature) come
 * from content/editorial/weekly/<start>.json. SVGs are drawn here and rasterised with
 * headless Chrome at 2x.
 *
 * Usage: node scripts/weekly/render-weekly.mjs --start 2026-09-28
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const season = JSON.parse(fs.readFileSync(path.join(root, 'config/season.json'), 'utf8'));
const start = process.argv[process.argv.indexOf('--start') + 1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '')) throw new Error('--start YYYY-MM-DD is required');
const data = JSON.parse(fs.readFileSync(path.join(root, 'content/generated', season.label, 'weekly', `${start}.json`), 'utf8'));
const editorial = JSON.parse(fs.readFileSync(path.join(root, 'content/editorial/weekly', `${start}.json`), 'utf8'));
const scheduleFile = JSON.parse(fs.readFileSync(path.join(root, 'data', season.scheduleFile), 'utf8'));
const plays = (team, date) => scheduleFile.teams[team]?.includes(date) ?? false;

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((candidate) => fs.existsSync(candidate));
if (!CHROME) throw new Error('Chrome or Edge is needed to rasterise the graphics.');

const C = { bg: '#071522', panel: '#0d2032', panel2: '#102a40', line: '#24465c', ink: '#f1f8ff', dim: '#9cb6c7', mute: '#6f8ea3', ice: '#63e6ff', amber: '#ffd27e', red: '#ff7d8b', green: '#84f7a6' };
const TEAM = { ANA: 'Ducks', BOS: 'Bruins', BUF: 'Sabres', CAR: 'Hurricanes', CBJ: 'Blue Jackets', CGY: 'Flames', CHI: 'Blackhawks', COL: 'Avalanche', DAL: 'Stars', DET: 'Red Wings', EDM: 'Oilers', FLA: 'Panthers', LAK: 'Kings', MIN: 'Wild', MTL: 'Canadiens', NJD: 'Devils', NSH: 'Predators', NYI: 'Islanders', NYR: 'Rangers', OTT: 'Senators', PHI: 'Flyers', PIT: 'Penguins', SEA: 'Kraken', SJS: 'Sharks', STL: 'Blues', TBL: 'Lightning', TOR: 'Maple Leafs', UTA: 'Mammoth', VAN: 'Canucks', VGK: 'Golden Knights', WPG: 'Jets', WSH: 'Capitals' };
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (date, options) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
const weekday = (date) => day(date, { weekday: 'short' });
const weekLabel = `${day(data.week.start, { month: 'short', day: 'numeric' })} to ${day(data.week.end, { month: 'short', day: 'numeric' })}`;
const logo = (team, x, y, size) => `<image href="https://assets.nhle.com/logos/nhl/svg/${team}_light.svg" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
const lastName = (name) => name.split(' ').slice(1).join(' ') || name;
const teamRow = (team) => data.teams.find((row) => row.team === team);

function frame(width, height, eyebrow, title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;family=Orbitron:wght@700;800&amp;display=block');
.d{font-family:Orbitron,Arial,sans-serif;font-weight:800}
.t{font-family:Inter,Arial,sans-serif}
</style>
<radialGradient id="glow" cx="15%" cy="0%" r="70%"><stop offset="0" stop-color="#63e6ff" stop-opacity=".16"/><stop offset="1" stop-color="#63e6ff" stop-opacity="0"/></radialGradient></defs>
<rect width="${width}" height="${height}" fill="${C.bg}"/><rect width="${width}" height="${height}" fill="url(#glow)"/>
<text x="60" y="64" class="t" fill="${C.ice}" font-size="17" font-weight="700" letter-spacing="2.5">${esc(eyebrow)}</text>
<text x="60" y="112" class="d" fill="${C.ink}" font-size="38">${esc(title)}</text>
<text x="60" y="146" class="t" fill="${C.dim}" font-size="19">${esc(subtitle)}</text>
${body}
<text x="60" y="${height - 30}" class="t" fill="${C.mute}" font-size="15">crackedicehockey.com · games that fit a lineup, from 1,800 simulated fantasy rosters</text>
</svg>`;
}

// 1. The week in one picture -----------------------------------------------------
function glance() {
  const nights = data.nights;
  const width = 1200; const height = 675;
  const tileW = 124; const gap = 14; const x0 = 60; const y0 = 190;
  const xOf = (index) => x0 + index * (tileW + gap) + (index === 7 ? 18 : 0);
  const tiles = nights.map((night, index) => {
    const x = xOf(index);
    const fill = night.games === 0 ? C.panel : night.packed ? '#3a1622' : night.light ? '#0f3346' : '#13283a';
    const stroke = night.packed ? C.red : night.light ? C.ice : C.line;
    const barH = Math.max(28, Math.round(1.4 * night.forwardOpenShare));
    const label = index === 7 ? 'Next Mon' : weekday(night.date);
    return `<g transform="translate(${x} ${y0})">
<rect width="${tileW}" height="330" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${night.packed || night.light ? 2 : 1}" ${index === 7 ? 'stroke-dasharray="6 5"' : ''}/>
<text x="16" y="34" class="t" fill="${C.ink}" font-size="18" font-weight="700">${esc(label)}</text>
<text x="16" y="56" class="t" fill="${C.mute}" font-size="14">${esc(day(night.date, { month: 'short', day: 'numeric' }))}</text>
<text x="16" y="114" class="d" fill="${night.packed ? C.red : night.light ? C.ice : C.ink}" font-size="44">${night.games}</text>
<text x="16" y="137" class="t" fill="${C.dim}" font-size="14">${night.games === 1 ? 'game' : 'games'}</text>
${night.games > 0 ? `<rect x="16" y="${306 - barH}" width="${tileW - 32}" height="${barH}" rx="6" fill="${night.forwardOpenShare >= 60 ? C.green : night.forwardOpenShare >= 35 ? C.amber : C.red}" opacity=".85"/>
<text x="${tileW / 2}" y="${306 - barH + 21}" text-anchor="middle" class="t" fill="${C.bg}" font-size="17" font-weight="700">${night.forwardOpenShare}%</text>` : `<text x="16" y="300" class="t" fill="${C.mute}" font-size="14">No games</text>`}
</g>`;
  }).join('');
  // Storyline chips under the tiles: the featured back-to-back, the Sunday-Monday bridge, skip Saturday.
  const indexOf = (date) => nights.findIndex((night) => night.date === date);
  const chip = (fromIndex, toIndex, text, color) => {
    const x = xOf(fromIndex); const w = xOf(toIndex) + tileW - x; const y = y0 + 346;
    return `<g><rect x="${x}" y="${y}" width="${w}" height="32" rx="16" fill="${color}" fill-opacity=".14" stroke="${color}"/><text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" class="t" fill="${color}" font-size="15" font-weight="700">${esc(text)}</text></g>`;
  };
  // In chain order, so the featured first leg's back-to-back reads first.
  const b2b = editorial.chain.legs.flatMap((team) => data.storylines.backToBacks.filter((entry) => entry.bothLight && entry.team === team)).slice(0, 2);
  const packed = nights.findIndex((night) => night.packed);
  const chips = [
    ...b2b.map((entry) => chip(indexOf(entry.first), indexOf(entry.second), `${TEAM[entry.team]} back-to-back`, C.ice)),
    ...(packed >= 0 ? [chip(packed, packed, 'Skip it', C.red)] : []),
    ...(data.storylines.bridge.length ? [chip(6, 7, `${data.storylines.bridge.map((team) => TEAM[team]).join(', ')}: Sun + Mon`, C.amber)] : []),
  ].join('');
  const legend = `<text x="60" y="178" class="t" fill="${C.dim}" font-size="16">Bars: share of fantasy rosters with an open forward spot that night.</text>`;
  return frame(width, height, 'CRACKED ICE · WEEKLY EDGE', 'A light week to start', `${weekLabel}. Five quiet nights with room to stream, and one packed Saturday.`, legend + tiles + chips);
}

// 2. The chain -------------------------------------------------------------------
function chain() {
  const width = 1200;
  const dates = data.nights.map((night) => night.date); // Mon..Sun + next Mon
  const colX = 330; const colW = 100;
  const xOf = (index) => colX + index * colW + (index === 7 ? 12 : 0);
  const legs = editorial.chain.legs.map((team) => data.strategies.twoAdds.legs.find((leg) => leg.team === team) ?? { team, games: [], options: [] });
  const bridge = editorial.chain.bridge && data.strategies.bridgeAdd?.team === editorial.chain.bridge ? data.strategies.bridgeAdd : null;
  const rows = [
    ...legs.map((leg, index) => ({ team: leg.team, use: leg.games, color: [C.ice, C.green][index % 2], label: `Add ${index + 1}`, options: leg.options })),
    ...(bridge ? [{ team: bridge.team, use: bridge.games, color: C.amber, label: 'Optional 3rd add', options: bridge.options, dashed: true }] : []),
  ];
  const headerY = 200;
  const rowY = (index) => headerY + 20 + index * 74;
  const header = dates.map((date, index) => {
    const night = data.nights[index];
    const x = xOf(index);
    return `${night.packed ? `<rect x="${x + 4}" y="${headerY - 26}" width="${colW - 8}" height="${rows.length * 74 + 40}" rx="12" fill="${C.red}" fill-opacity=".10"/>` : ''}
<text x="${x + colW / 2}" y="${headerY}" text-anchor="middle" class="t" fill="${night.packed ? C.red : C.dim}" font-size="16" font-weight="700">${esc(index === 7 ? 'Next Mon' : weekday(date))}</text>`;
  }).join('');
  const laneRows = rows.map((row, index) => {
    const y = rowY(index);
    const cells = dates.map((date, dateIndex) => {
      const x = xOf(dateIndex);
      if (row.use.includes(date)) return `<rect x="${x + 8}" y="${y + 10}" width="${colW - 16}" height="44" rx="10" fill="${row.color}"/>`;
      if (plays(row.team, date)) return `<rect x="${x + 8}" y="${y + 10}" width="${colW - 16}" height="44" rx="10" fill="none" stroke="${C.mute}" stroke-width="2" stroke-dasharray="5 4"/>`;
      return '';
    }).join('');
    return `${logo(row.team, 60, y + 8, 48)}
<text x="120" y="${y + 30}" class="t" fill="${C.ink}" font-size="20" font-weight="700">${esc(TEAM[row.team])}</text>
<text x="120" y="${y + 52}" class="t" fill="${row.dashed ? C.amber : C.mute}" font-size="14" font-weight="600">${esc(row.label)}</text>${cells}`;
  }).join('');
  // Options by ownership under the lanes.
  const optionsTop = rowY(rows.length) + 26;
  const boxW = (width - 120 - (rows.length - 1) * 20) / rows.length;
  const boxes = rows.map((row, index) => {
    const x = 60 + index * (boxW + 20);
    const lines = row.options.slice(0, 4).map((option, line) => {
      const y = optionsTop + 64 + line * 30;
      return `<text x="${x + 18}" y="${y}" class="t" fill="${C.ink}" font-size="17" font-weight="600">${esc(lastName(option.name))}<tspan fill="${C.mute}" font-weight="400"> ${esc(option.positions.join('/'))}</tspan></text>
<text x="${x + boxW - 18}" y="${y}" text-anchor="end" class="t" fill="${option.percentOwned >= 40 ? C.dim : option.percentOwned >= 15 ? C.amber : C.green}" font-size="16" font-weight="700">${option.percentOwned}%</text>`;
    }).join('');
    return `<rect x="${x}" y="${optionsTop}" width="${boxW}" height="${64 + Math.min(4, row.options.length) * 30}" rx="14" fill="${C.panel2}" stroke="${C.line}"/>
<text x="${x + 18}" y="${optionsTop + 32}" class="t" fill="${row.color}" font-size="15" font-weight="700" letter-spacing="1.2">${esc(`${TEAM[row.team]} options`.toUpperCase())}</text>${lines}`;
  }).join('');
  const height = optionsTop + 64 + 4 * 30 + 90;
  const key = `<text x="60" y="${height - 58}" class="t" fill="${C.mute}" font-size="14">Filled: games you use. Dashed: games you skip. % = Yahoo percent owned this week, so something is free in every league.</text>`;
  return frame(width, height, 'CRACKED ICE · WEEKLY EDGE', editorial.chain.title, `${weekLabel}. One open forward spot, two adds.`, header + laneRows + boxes + key);
}

// 3. Quick hits ------------------------------------------------------------------
function quick() {
  const width = 1200; const height = 675;
  const columns = [
    { key: 'week', title: 'This week' },
    { key: 'twoWeeks', title: 'Next 2 weeks' },
    { key: 'month', title: 'Next 30 days' },
  ];
  const colW = 340; const gap = 30; const top = 180;
  const note = (team, horizon) => {
    const row = teamRow(team)[horizon];
    if (horizon !== 'week') return `${row.games} games, ${row.usableForward} that fit a lineup`;
    // A four-game week is the bigger story than a back-to-back inside it.
    if (row.games >= 4) return `${row.games} games, ${row.packedGames === 0 ? 'all on quiet nights' : `${row.packedGames} on a packed night`}`;
    const b2b = data.storylines.backToBacks.find((entry) => entry.team === team && entry.bothLight);
    if (b2b) return `${weekday(b2b.first)}/${weekday(b2b.second)} back-to-back, both quiet`;
    if (row.packedGames === 0) return `${row.games} games, ${row.games === row.lightGames ? 'all on quiet nights' : 'none on Saturday'}`;
    return `${row.games} games`;
  };
  const body = columns.map((column, index) => {
    const x = 60 + index * (colW + gap);
    const teams = editorial.quickHits[column.key];
    const items = teams.map((team, line) => {
      const y = top + 68 + line * 86;
      return `${logo(team, x + 18, y, 52)}
<text x="${x + 84}" y="${y + 24}" class="t" fill="${C.ink}" font-size="21" font-weight="700">${esc(TEAM[team])}</text>
<text x="${x + 84}" y="${y + 48}" class="t" fill="${C.dim}" font-size="15">${esc(note(team, column.key))}</text>`;
    }).join('');
    return `<rect x="${x}" y="${top}" width="${colW}" height="${68 + 4 * 86}" rx="18" fill="${C.panel2}" stroke="${index === 0 ? C.ice : C.line}" stroke-width="${index === 0 ? 2 : 1}"/>
<text x="${x + 20}" y="${top + 42}" class="d" fill="${index === 0 ? C.ice : C.ink}" font-size="22">${esc(column.title)}</text>${items}`;
  }).join('');
  return frame(width, height, 'CRACKED ICE · WEEKLY EDGE', 'Quick hits', `${weekLabel}. Teams to target when you're picking up.`, body);
}

const outDirs = [path.join(root, 'web', 'public', 'blog-assets'), path.join(root, 'content', 'social', season.label, 'assets')];
outDirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-'));
for (const [name, svg] of [['glance', glance()], ['chain', chain()], ['quick', quick()]]) {
  const height = Number(svg.match(/height="(\d+)"/)[1]);
  const svgPath = path.join(tmp, `${name}.svg`);
  const pngPath = path.join(tmp, `${name}.png`);
  fs.writeFileSync(svgPath, svg);
  // Wrap in HTML so Chrome loads the web fonts and logos before the screenshot.
  const html = path.join(tmp, `${name}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:${C.bg}}</style></head><body>${svg}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=1200,${height}`, '--virtual-time-budget=20000', `--screenshot=${pngPath}`, pathToFileURL(html).href], { stdio: 'ignore' });
  for (const dir of outDirs) fs.copyFileSync(pngPath, path.join(dir, `week-${start}-${name}.png`));
  // Keep the editable SVG next to the social copy only; the site serves the PNGs.
  fs.copyFileSync(svgPath, path.join(outDirs[1], `week-${start}-${name}.svg`));
  console.log(`week-${start}-${name}.png (1200x${height} @2x)`);
}
