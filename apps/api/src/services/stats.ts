import { readFileSync } from 'fs';
import { join } from 'path';
import { PlayerStats } from '../models/types';

interface StatsCacheFile {
  schemaVersion?: string;
  generatedAt: string;
  source: string;
  weights?: { season: number; last30: number; last7: number };
  players: Record<string, PlayerStats>;
}

const CACHE_PATH = join(__dirname, '..', '..', 'cache', 'stats.json');
const FALLBACK_PATH = join(__dirname, '..', 'data', 'stats.sample.json');

let cache: StatsCacheFile | null = null;

function loadStats(): StatsCacheFile {
  if (cache) {
    return cache;
  }

  try {
    cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as StatsCacheFile;
    return cache;
  } catch (error) {
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