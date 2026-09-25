/**
 * Renders the Weekly Edge graphics from content/generated/<season>/weekly/<start>.json:
 *   week-<start>-glance.png   the week at a glance (night heat + open forward slots)
 *   week-<start>-starts.png   games vs starts that count, per team
 *   week-<start>-plan.png     the one-slot stream plan and the rotation
 * SVGs are drawn here and rasterised with headless Chrome at 2x.
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

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((candidate) => fs.existsSync(candidate));
if (!CHROME) throw new Error('Chrome or Edge is needed to rasterise the graphics.');

const C = { bg: '#071522', panel: '#0d2032', line: '#24465c', ink: '#f1f8ff', dim: '#9cb6c7', mute: '#6f8ea3', ice: '#63e6ff', amber: '#ffd27e', red: '#ff7d8b', green: '#84f7a6' };
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (date, options) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
const weekLabel = `${day(data.week.start, { month: 'short', day: 'numeric' })} to ${day(data.week.end, { month: 'short', day: 'numeric' })}`;

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
<text x="60" y="${height - 30}" class="t" fill="${C.mute}" font-size="15">${esc(`Simulated from ${data.method.rosters.toLocaleString('en-US')} Yahoo-style fantasy rosters`)} · crackedicehockey.com</text>
</svg>`;
}

// 1. The week at a glance -------------------------------------------------------
function glance() {
  const nights = data.nights;
  const width = 1200; const height = 675;
  const tileW = 124; const gap = 14; const x0 = 60; const y0 = 200;
  const tiles = nights.map((night, index) => {
    const x = x0 + index * (tileW + gap) + (index === 7 ? 18 : 0);
    const fill = night.games === 0 ? C.panel : night.packed ? '#3a1622' : night.light ? '#0f3346' : '#13283a';
    const stroke = night.packed ? C.red : night.light ? C.ice : C.line;
    // Bars sit in their own zone under the game count: 150px tall at 100%.
    const barH = Math.max(28, Math.round(1.5 * night.forwardOpenShare));
    const label = index === 7 ? 'Next Mon' : day(night.date, { weekday: 'short' });
    return `<g transform="translate(${x} ${y0})">
<rect width="${tileW}" height="360" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${night.packed || night.light ? 2 : 1}" ${index === 7 ? 'stroke-dasharray="6 5"' : ''}/>
<text x="16" y="34" class="t" fill="${C.ink}" font-size="18" font-weight="700">${esc(label)}</text>
<text x="16" y="56" class="t" fill="${C.mute}" font-size="14">${esc(day(night.date, { month: 'short', day: 'numeric' }))}</text>
<text x="16" y="116" class="d" fill="${night.packed ? C.red : night.light ? C.ice : C.ink}" font-size="46">${night.games}</text>
<text x="16" y="140" class="t" fill="${C.dim}" font-size="14">${night.games === 1 ? 'game' : 'games'}</text>
${night.games > 0 ? `<rect x="16" y="${330 - barH}" width="${tileW - 32}" height="${barH}" rx="6" fill="${night.forwardOpenShare >= 60 ? C.green : night.forwardOpenShare >= 35 ? C.amber : C.red}" opacity=".85"/>
<text x="${tileW / 2}" y="${330 - barH + 21}" text-anchor="middle" class="t" fill="${C.bg}" font-size="17" font-weight="700">${Math.round(night.forwardOpenShare)}%</text>` : `<text x="16" y="322" class="t" fill="${C.mute}" font-size="14">No games</text>`}
</g>`;
  }).join('');
  const legend = `<text x="60" y="186" class="t" fill="${C.dim}" font-size="16">Bars: share of rosters with an open forward slot that night, after their own players are in.</text>`;
  const bridge = data.bridge.length ? `<text x="${x0 + 7 * (tileW + gap) + 18}" y="${y0 + 386}" class="t" fill="${C.amber}" font-size="14" font-weight="700">Sun-Mon: ${esc(data.bridge.join(', '))}</text>` : '';
  return frame(width, height, 'CRACKED ICE · WEEKLY EDGE', `The week in one picture`, `${weekLabel}. Light nights leave room to stream. Packed nights don't.`, legend + tiles + bridge);
}

// 2. Games vs starts that count --------------------------------------------------
function starts() {
  const teams = data.teamStarts.filter((team) => team.games >= 3).sort((a, b) => b.games - a.games || b.usable - a.usable).slice(0, 14);
  const width = 1200; const rowH = 34; const top = 196; const height = top + teams.length * rowH + 110;
  const scale = 150; const barX = 160;
  const rows = teams.map((team, index) => {
    const y = top + index * rowH;
    const lost = team.games - team.usable;
    return `<g transform="translate(0 ${y})">
<text x="60" y="22" class="t" fill="${C.ink}" font-size="18" font-weight="700">${esc(team.team)}</text>
<rect x="${barX}" y="6" width="${team.games * scale}" height="22" rx="5" fill="none" stroke="${C.line}" stroke-width="2"/>
<rect x="${barX}" y="6" width="${team.usable * scale}" height="22" rx="5" fill="${lost >= 1.1 ? C.amber : C.ice}" opacity=".9"/>
<text x="${barX + team.games * scale + 14}" y="23" class="t" fill="${C.dim}" font-size="16">${team.games} games → <tspan fill="${C.ink}" font-weight="700">${team.usable.toFixed(1)}</tspan> usable${team.packedGames ? ` · ${team.packedGames} on a packed night` : ''}</text>
</g>`;
  }).join('');
  const legend = `<g transform="translate(60 ${height - 78})"><rect width="18" height="12" rx="3" fill="${C.ice}"/><text x="26" y="11" class="t" fill="${C.dim}" font-size="15">usable starts for a forward pickup</text><rect x="300" width="18" height="12" rx="3" fill="${C.amber}"/><text x="326" y="11" class="t" fill="${C.dim}" font-size="15">loses a game or more to crowded nights</text><rect x="660" width="18" height="12" rx="3" fill="none" stroke="${C.line}" stroke-width="2"/><text x="686" y="11" class="t" fill="${C.dim}" font-size="15">scheduled games</text></g>`;
  return frame(width, height, 'CRACKED ICE · WEEKLY EDGE', 'Games vs starts that count', `${weekLabel}. A game only counts if your lineup has room for him that night.`, rows + legend);
}

// 3. The one-slot stream plan and the rotation -----------------------------------
function plan() {
  const width = 1200;
  const height = 232 + data.plan.stretches.length * 60 + 70 + 14 + 2 * 56 + 26 + 70;
  const colX = 250; const colW = 124; const dates = data.nights.slice(0, 7).map((night) => night.date);
  const header = dates.map((date, index) => {
    const night = data.nights[index];
    return `<text x="${colX + index * colW + colW / 2}" y="214" text-anchor="middle" class="t" fill="${night.packed ? C.red : C.dim}" font-size="16" font-weight="700">${esc(day(date, { weekday: 'short' }))}</text>`;
  }).join('');
  const lane = (y, player, color) => {
    const cells = dates.map((date, index) => player.games.includes(date) && (!player.from || (date >= player.from && date <= player.to))
      ? `<rect x="${colX + index * colW + 8}" y="${y + 6}" width="${colW - 16}" height="40" rx="8" fill="${color}" opacity=".9"/>`
      : '').join('');
    return `${cells}<text x="60" y="${y + 24}" class="t" fill="${C.ink}" font-size="18" font-weight="700">${esc(player.name)}</text><text x="60" y="${y + 44}" class="t" fill="${C.mute}" font-size="14">${esc(`${player.team} · ${player.positions.join('/')} · ${player.referenceFppg.toFixed(1)} pts/gm`)}</text>`;
  };
  const colors = [C.ice, C.green, C.amber];
  const planLanes = data.plan.stretches.map((stretch, index) => lane(232 + index * 60, stretch, colors[index % 3])).join('');
  const planTotal = `<text x="60" y="${232 + data.plan.stretches.length * 60 + 30}" class="t" fill="${C.dim}" font-size="17"><tspan fill="${C.ink}" font-weight="700">Stream it (${data.plan.adds} adds): ${data.plan.expectedPoints} expected pts</tspan> · best single pickup held all week: ${data.plan.bestHold.expectedPoints} (${esc(data.plan.bestHold.name)})</text>`;
  const rotationY = 232 + data.plan.stretches.length * 60 + 70;
  const rotation = `<text x="60" y="${rotationY}" class="t" fill="${C.amber}" font-size="17" font-weight="700" letter-spacing="1.5">OR ROTATE TWO: START WHOEVER PLAYS</text>
${data.rotation.players.map((player, index) => lane(rotationY + 14 + index * 56, player, index ? C.amber : C.ice)).join('')}
<text x="60" y="${rotationY + 14 + 2 * 56 + 26}" class="t" fill="${C.dim}" font-size="17"><tspan fill="${C.ink}" font-weight="700">Rotation: ${data.rotation.expectedPoints} expected pts</tspan> with 2 adds, if you have a spare bench spot.</text>`;
  return frame(width, height, 'CRACKED ICE · WEEKLY EDGE', 'One open slot, planned', `${weekLabel}. Rarely drafted forwards, Yahoo standard points, lineup room included.`, header + planLanes + planTotal + rotation);
}

const outDirs = [path.join(root, 'web', 'public', 'blog-assets'), path.join(root, 'content', 'social', season.label, 'assets')];
outDirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-'));
for (const [name, svg] of [['glance', glance()], ['starts', starts()], ['plan', plan()]]) {
  const height = Number(svg.match(/height="(\d+)"/)[1]);
  const svgPath = path.join(tmp, `${name}.svg`);
  const pngPath = path.join(tmp, `${name}.png`);
  // Wrap in HTML so Chrome loads the web fonts before the screenshot.
  fs.writeFileSync(svgPath, svg);
  const html = path.join(tmp, `${name}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:${C.bg}}</style></head><body>${svg}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=1200,${height}`, '--virtual-time-budget=15000', `--screenshot=${pngPath}`, pathToFileURL(html).href], { stdio: 'ignore' });
  for (const dir of outDirs) fs.copyFileSync(pngPath, path.join(dir, `week-${start}-${name}.png`));
  // Keep the editable SVG next to the social copy only; the site serves the PNGs.
  fs.copyFileSync(svgPath, path.join(outDirs[1], `week-${start}-${name}.svg`));
  console.log(`week-${start}-${name}.png (1200x${height} @2x)`);
}
