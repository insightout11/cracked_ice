import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_CACHE_BUCKET;

  if (!url || !serviceKey || !bucket) {
    throw new Error('Supabase environment variables are not fully configured');
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const latestPath = 'cache/v1/latest.json';

  const latestRes = await client.storage.from(bucket).download(latestPath);
  if (latestRes.error || !latestRes.data) {
    throw new Error(latestRes.error?.message ?? 'latest.json download failed');
  }

  const pointerText = await latestRes.data.text();
  let ts: string | undefined;
  try {
    const pointer = JSON.parse(pointerText) as { ts?: string };
    ts = pointer.ts;
  } catch (error) {
    throw new Error(`latest.json parse failed: ${(error as Error).message}`);
  }

  if (!ts) {
    throw new Error('latest.json missing ts field');
  }

  const prefix = `cache/v1/${ts}`;

  const statsBuffer = await downloadToBuffer(client, bucket, `${prefix}/stats.json`);
  const scheduleBuffer = await downloadToBuffer(client, bucket, `${prefix}/schedule.json`);

  validateCache(statsBuffer, 'stats.json');
  validateCache(scheduleBuffer, 'schedule.json');

  const statsKB = (statsBuffer.length / 1024).toFixed(1);
  const scheduleKB = (scheduleBuffer.length / 1024).toFixed(1);

  console.log(`[smoke] latest ts=${ts}, stats=${statsKB} KB, schedule=${scheduleKB} KB`);
}

async function downloadToBuffer(client: ReturnType<typeof createClient>, bucket: string, path: string): Promise<Buffer> {
  const res = await client.storage.from(bucket).download(path);
  if (res.error || !res.data) {
    throw new Error(res.error?.message ?? `${path} download failed`);
  }
  return Buffer.from(await res.data.arrayBuffer());
}

function validateCache(buffer: Buffer, name: string): void {
  try {
    const parsed = JSON.parse(buffer.toString('utf8')) as { schemaVersion?: unknown; generatedAt?: unknown };
    if (typeof parsed.schemaVersion !== 'string' || typeof parsed.generatedAt !== 'string') {
      throw new Error(`${name} missing schemaVersion/generatedAt`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${name} JSON parse failed: ${error.message}`);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(`[smoke] cache verification failed: ${(error as Error).message}`);
  process.exit(1);
});