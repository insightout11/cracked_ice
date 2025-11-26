import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_CACHE_DIR = path.resolve(ROOT, 'data-cache');
const TEAM_STATS_PATH = path.join(DATA_CACHE_DIR, 'team_stats.json');
const MANIFEST_PATH = path.join(DATA_CACHE_DIR, 'manifest.json');

const SOURCE_URL = process.env.TEAM_STATS_URL ?? '';
const LOCAL_SOURCE = process.env.TEAM_STATS_SOURCE ?? '';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`fetch ${url} -> ${res.status}`);
  }
  return res.json();
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalize(records, sourceLabel) {
  const teams = {};
  for (const entry of records) {
    if (!entry) continue;
    const id = String(entry.teamId ?? entry.team ?? entry.abbr ?? '').toUpperCase();
    if (!id) continue;

    const gfPer60 = toNumber(entry.gfPer60 ?? entry.gf_per60 ?? entry.gf60) ?? 0;
    const gaPer60 = toNumber(entry.gaPer60 ?? entry.ga_per60 ?? entry.ga60) ?? 0;
    const ppPct = toNumber(entry.ppPct ?? entry.pp_pct ?? entry.pp);
    const pkPct = toNumber(entry.pkPct ?? entry.pk_pct ?? entry.pk);
    const pace = toNumber(entry.pace ?? entry.corsi60 ?? entry.shotsAttempts60 ?? entry.shotAttempts60);

    teams[id] = {
      teamId: id,
      gfPer60,
      gaPer60,
      ppPct: ppPct ?? undefined,
      pkPct: pkPct ?? undefined,
      pace: pace ?? undefined
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    source: sourceLabel,
    teams
  };
}

async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
  await fs.rename(tmp, file);
}

async function updateManifest() {
  let manifest;
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    manifest = JSON.parse(raw);
  } catch {
    manifest = { version: Date.now().toString(), generatedAt: new Date().toISOString(), files: [] };
  }

  const statInfo = await fs.stat(TEAM_STATS_PATH);
  const entry = {
    name: 'team_stats.json',
    bytes: statInfo.size,
    mtime: statInfo.mtime.toISOString()
  };
  const other = Array.isArray(manifest.files) ? manifest.files.filter((file) => file.name !== 'team_stats.json') : [];
  manifest.files = [...other, entry];
  manifest.version = Date.now().toString();
  manifest.generatedAt = new Date().toISOString();

  await writeJson(MANIFEST_PATH, manifest);
}

async function main() {
  if (!SOURCE_URL && !LOCAL_SOURCE) {
    throw new Error('Provide TEAM_STATS_URL or TEAM_STATS_SOURCE');
  }

  let raw;
  if (SOURCE_URL) {
    raw = await fetchJson(SOURCE_URL);
  } else {
    const sourcePath = path.isAbsolute(LOCAL_SOURCE) ? LOCAL_SOURCE : path.resolve(ROOT, LOCAL_SOURCE);
    raw = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  }

  const records = Array.isArray(raw) ? raw : (raw?.data ?? raw?.results ?? raw?.teams ?? []);
  const cache = normalize(records, SOURCE_URL || (LOCAL_SOURCE ? 'local' : 'unknown'));
  await writeJson(TEAM_STATS_PATH, cache);
  await updateManifest();
  console.log('team_stats: OK', TEAM_STATS_PATH);
}

main().catch((error) => {
  console.error('team_stats hydrate failed:', error);
  process.exit(1);
});
