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
      console.warn('[Supabase] Connection test failed — status:', status, '| message:', error.message);
      if (error.message.includes('project is suspended') || error.message.includes('project is paused')) {
        console.warn('[Supabase] Project appears paused — check https://supabase.com/dashboard');
      }
    } else {
      console.log('[Supabase] ✅ Connection test passed — status:', status);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Supabase] Connection test threw (network or config issue):', msg);
    // Do NOT rethrow — a failed connection test must never crash the app
  }
}

testSupabaseConnection();
