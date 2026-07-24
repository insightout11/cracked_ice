import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

function validSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = validSupabaseUrl(supabaseUrl) && supabaseAnonKey.length > 20;

let clientPromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  }
  return clientPromise;
}
