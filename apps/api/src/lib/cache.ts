import { readFileSync } from 'fs';
import { join } from 'path';
import { DATA_CACHE_DIR, MANIFEST_PATH } from '../config/cachePaths';

export function readCacheJson<T>(file: string): T {
  const buffer = readFileSync(join(DATA_CACHE_DIR, file), 'utf8');
  return JSON.parse(buffer) as T;
}

export function getManifest(): { version: string; generatedAt: string } | null {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { version: string; generatedAt: string };
  } catch {
    return null;
  }
}
