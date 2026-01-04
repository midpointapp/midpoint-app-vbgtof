
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

console.log('[Supabase] Initializing client...');
console.log('[Supabase] URL:', supabaseUrl);
console.log('[Supabase] Key present:', !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'midpoint-mobile-app',
    },
  },
});

console.log('[Supabase] Client initialized successfully');

// Test connection on startup
supabase
  .from('sessions')
  .select('count')
  .limit(1)
  .then(({ error }) => {
    if (error) {
      console.error('[Supabase] Connection test failed:', error.message);
      if (error.message.includes('paused') || error.message.includes('inactive')) {
        console.error('[Supabase] ⚠️ Project appears to be paused. Please restore it in the Supabase dashboard.');
      }
    } else {
      console.log('[Supabase] ✅ Connection test successful');
    }
  })
  .catch((err) => {
    console.error('[Supabase] Connection test error:', err);
  });
