import { existsSync, readFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, resolve } from 'path';

const SCRIPT_ROOT = fileURLToPath(new URL('.', import.meta.url));
const API_ROOT = resolve(SCRIPT_ROOT, '..');
const DATA_CACHE_DIR = resolve(API_ROOT, 'data-cache');

const FILES = {
  manifest: 'manifest.json',
  players: 'players.json',
  schedule: 'schedule.json',
  stats: 'stats.json',
  teams: 'teams.json',
  team_stats: 'team_stats.json',
  aliases: 'aliases.json'
};

function describe(path) {
  const abs = join(DATA_CACHE_DIR, path);
  if (!existsSync(abs)) {
    return { path: abs, exists: false, bytes: 0, mtime: null };
  }
  const stats = statSync(abs);
  return {
    path: abs,
    exists: true,
    bytes: stats.size,
    mtime: stats.mtime.toISOString()
  };
}

const manifestPath = join(DATA_CACHE_DIR, FILES.manifest);
let manifest = null;
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.warn('[show:cache] Failed to parse manifest:', error.message);
  }
}

console.log('[show:cache] data-cache directory:', DATA_CACHE_DIR);
const table = Object.entries(FILES).map(([key, filename]) => {
  const info = describe(filename);
  return { key, ...info };
});
console.table(table);
if (manifest) {
  console.log('[show:cache] manifest version:', manifest.version);
  console.log('[show:cache] manifest generatedAt:', manifest.generatedAt);
} else {
  console.log('[show:cache] manifest missing');
}

