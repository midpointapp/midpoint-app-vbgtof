import { createClient } from '@supabase/supabase-js';

// Metro inlines EXPO_PUBLIC_* from .env at build time.
// Hardcoded fallbacks ensure preview/Expo Go never gets undefined.
const FALLBACK_URL = 'https://yryjvcilhnnchaieieby.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyeWp2Y2lsaG5uY2hhaWVpZWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDE1MTEsImV4cCI6MjA4MDgxNzUxMX0.c8JGh84L3nsg-tqJndoQcY8GN3qGgzXyoE711t_nLj8';

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_KEY;

// Diagnostic logs — never log the full key
console.log('[Supabase] EXPO_PUBLIC_SUPABASE_URL present:', !!process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('[Supabase] URL first 25 chars:', supabaseUrl.slice(0, 25));
console.log('[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY present:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Runs once at startup — logs result, never throws or crashes the app
async function testSupabaseConnection(): Promise<void> {
  try {
    const { error, status } = await supabase
      .from('meet_sessions')
      .select('id')
      .limit(1);

    if (error) {
      const msg = error.message ?? '';
      console.warn('[Supabase] ⚠️ Connection test failed — status:', status, '| message:', msg);

      if (msg.includes('project is suspended') || msg.includes('project is paused') || status === 503) {
        console.error('[Supabase] 🔴 PROJECT IS PAUSED — go to https://supabase.com/dashboard/project/yryjvcilhnnchaieieby and click Restore');
      } else if (status === 401 || msg.includes('JWT')) {
        console.error('[Supabase] 🔴 AUTH ERROR — anon key may be wrong or expired');
      } else if (msg.includes('does not exist') || msg.includes('relation')) {
        console.error('[Supabase] 🔴 TABLE MISSING — meet_sessions table does not exist. Run migrations.');
      } else if (msg.includes('Network request failed') || msg.includes('fetch')) {
        console.error('[Supabase] 🔴 NETWORK ERROR — Supabase project may be paused or URL is wrong');
        console.error('[Supabase] URL being used:', supabaseUrl.slice(0, 40));
      }
    } else {
      console.log('[Supabase] ✅ Connection test passed — status:', status);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] ⚠️ Connection test threw:', msg);
    if (msg.includes('Network request failed')) {
      console.error('[Supabase] 🔴 NETWORK FAILURE — most likely cause: Supabase project is PAUSED.');
      console.error('[Supabase] 👉 Restore at: https://supabase.com/dashboard/project/yryjvcilhnnchaieieby');
    }
    // Never rethrow — connection test failure must not crash the app
  }
}

testSupabaseConnection();
