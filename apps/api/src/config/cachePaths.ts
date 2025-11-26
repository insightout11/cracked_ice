import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, resolve } from 'path';

// Use __dirname if available (CommonJS), otherwise construct path from cwd
const moduleUrl =
  typeof __dirname === 'string'
    ? new URL(`file://${__dirname}/`)
    : new URL(`file://${process.cwd()}/apps/api/src/config/`);
const API_ROOT = fileURLToPath(new URL('../..', moduleUrl));
const DEFAULT_CACHE_DIR = resolve(API_ROOT, 'data-cache');
const FALLBACK_CACHE_DIR = resolve(process.cwd(), 'apps', 'api', 'data-cache');

export const DATA_CACHE_DIR = existsSync(DEFAULT_CACHE_DIR) ? DEFAULT_CACHE_DIR : FALLBACK_CACHE_DIR;

export const MANIFEST_PATH = join(DATA_CACHE_DIR, 'manifest.json');
export const STATS_PATH = join(DATA_CACHE_DIR, 'stats.json');
export const SCHEDULE_PATH = join(DATA_CACHE_DIR, 'schedule.json');
export const PLAYERS_PATH = join(DATA_CACHE_DIR, 'players.json');
export const TEAMS_PATH = join(DATA_CACHE_DIR, 'teams.json');
export const TEAM_STATS_PATH = join(DATA_CACHE_DIR, 'team_stats.json');
export const ALIASES_PATH = join(DATA_CACHE_DIR, 'aliases.json');

export const CACHE_FILES = {
  manifest: MANIFEST_PATH,
  stats: STATS_PATH,
  schedule: SCHEDULE_PATH,
  players: PLAYERS_PATH,
  teams: TEAMS_PATH,
  team_stats: TEAM_STATS_PATH,
  aliases: ALIASES_PATH
} as const;

export function describeCacheFile(path: string) {
  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      bytes: 0,
      mtime: null
    } as const;
  }

  const stats = statSync(path);
  return {
    path,
    exists: true,
    bytes: stats.size,
    mtime: stats.mtime.toISOString()
  } as const;
}

