import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readCacheJson } from '../lib/cache';
import { PlayerStats } from '../models/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StatsCacheFile {
  schemaVersion?: string;
  generatedAt: string;
  source: string;
  weights?: { season: number; last30: number; last7: number };
  players: Record<string, PlayerStats>;
}

const FALLBACK_PATH = join(__dirname, '..', 'data', 'stats.sample.json');

let cache: StatsCacheFile | null = null;
let warned = false;

function loadStats(): StatsCacheFile {
  if (cache) {
    return cache;
  }

  try {
    cache = readCacheJson<StatsCacheFile>('stats.json');
    return cache;
  } catch (error) {
    if (!warned) {
      console.warn('[stats] Falling back to sample stats cache:', error instanceof Error ? error.message : error);
      warned = true;
    }
    const fallbackRaw = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8')) as StatsCacheFile | Record<string, PlayerStats>;
    if ('players' in fallbackRaw) {
      cache = fallbackRaw as StatsCacheFile;
    } else {
      cache = {
        schemaVersion: 'v1',
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        players: fallbackRaw as Record<string, PlayerStats>
      };
    }
    return cache;
  }
}

export function getPlayerStats(playerId: string): PlayerStats | undefined {
  const { players } = loadStats();
  return players[playerId];
}

export function getBlendedFppg(playerId: string): number {
  return getPlayerStats(playerId)?.blendedFppg ?? 0;
}

export function getStatsMap(): Map<string, PlayerStats> {
  const { players } = loadStats();
  return new Map(Object.entries(players));
}

export function getStatsMetadata(): Pick<StatsCacheFile, 'generatedAt' | 'source' | 'weights' | 'schemaVersion'> {
  const { generatedAt, source, weights, schemaVersion } = loadStats();
  return { generatedAt, source, weights, schemaVersion };
}
