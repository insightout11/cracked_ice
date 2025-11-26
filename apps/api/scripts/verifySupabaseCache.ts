// apps/api/scripts/verifySupabaseCache.ts
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  const bucket = process.env.SUPABASE_CACHE_BUCKET!;

  if (!url || !key || !bucket) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_CACHE_BUCKET envs');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const path = `probe/${new Date().toISOString()}.txt`;
  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(path, 'ok', { upsert: true, contentType: 'text/plain' });

  if (error) {
    console.error('[probe] Storage write failed:', error.message);
    process.exit(1)
;  }
  console.log('[probe] Storage write OK:', path);

  // Optional: read it back to be extra sure
  const { data, error: dlErr } = await supabase.storage.from(bucket).download(path);
  if (dlErr) {
    console.error('[probe] Download failed:', dlErr.message);
    process.exit(1);
  }
  const text = await data.text();
  console.log('[probe] Download OK, content:', text);
}

main().catch((e) => 
{  console.error('[probe] Unexpected error:', e);
  process.exit(1);
});
