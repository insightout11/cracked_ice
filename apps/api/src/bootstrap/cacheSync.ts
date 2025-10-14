import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(__dirname, '..', '..', 'cache');
const STATS_PATH = join(CACHE_DIR, 'stats.json');
const SCHEDULE_PATH = join(CACHE_DIR, 'schedule.json');
const CACHE_PREFIX = 'cache/v1';
const SKIP_MESSAGE = '[boot] Using local cache (no Supabase env)';

interface CachePointer {
  ts?: string;
}

function ensureCacheDir(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
}

function validateCachePayload(buffer: Buffer, name: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (typeof parsed?.generatedAt === 'string' && typeof parsed?.schemaVersion === 'string') {
      return parsed as Record<string, unknown>;
    }
    console.warn(`[boot] ${name} missing generatedAt/schemaVersion`);
    return null;
  } catch (error) {
    console.warn(`[boot] ${name} JSON parse failed: ${(error as Error).message}`);
    return null;
  }
}

export async function syncSupabaseCacheOnBoot(): Promise<void> {
  if (process.env.BOOT_SYNC_CACHE !== 'true') {
    console.log(SKIP_MESSAGE);
    return;
  }

  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_KEY ?? '';
  const bucket = process.env.SUPABASE_CACHE_BUCKET ?? '';

  if (!url || !key || !bucket) {
    console.log(SKIP_MESSAGE);
    return;
  }

  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const latestPath = `${CACHE_PREFIX}/latest.json`;
    const latestRes = await client.storage.from(bucket).download(latestPath);
    if (latestRes.error || !latestRes.data) {
      throw new Error(latestRes.error?.message ?? 'latest.json not found');
    }
    const pointerText = await latestRes.data.text();
    const pointer = JSON.parse(pointerText) as CachePointer;
    if (!pointer.ts) {
      throw new Error('latest.json missing ts');
    }

    const targetPrefix = `${CACHE_PREFIX}/${pointer.ts}`;

    const statsRes = await client.storage.from(bucket).download(`${targetPrefix}/stats.json`);
    if (statsRes.error || !statsRes.data) {
      throw new Error(statsRes.error?.message ?? 'stats.json download failed');
    }
    const statsBuffer = Buffer.from(await statsRes.data.arrayBuffer());
    if (!validateCachePayload(statsBuffer, 'stats.json')) {
      throw new Error('stats.json validation failed');
    }

    const scheduleRes = await client.storage.from(bucket).download(`${targetPrefix}/schedule.json`);
    if (scheduleRes.error || !scheduleRes.data) {
      throw new Error(scheduleRes.error?.message ?? 'schedule.json download failed');
    }
    const scheduleBuffer = Buffer.from(await scheduleRes.data.arrayBuffer());
    if (!validateCachePayload(scheduleBuffer, 'schedule.json')) {
      throw new Error('schedule.json validation failed');
    }

    ensureCacheDir();
    writeFileSync(STATS_PATH, statsBuffer);
    writeFileSync(SCHEDULE_PATH, scheduleBuffer);

    const statsKB = (statsBuffer.length / 1024).toFixed(1);
    const scheduleKB = (scheduleBuffer.length / 1024).toFixed(1);

    console.log(`[boot] Pulled latest cache from Supabase (ts=${pointer.ts}, stats=${statsKB} KB, schedule=${scheduleKB} KB)`);
  } catch (error) {
    console.warn(`[boot] Cache pull failed: ${(error as Error).message} using bundled cache.`);
  }
}
