
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] URL or Anon Key is missing!');
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

async function testSupabaseConnection() {
  try {
    const { data, error, status } = await supabase.from('meet_sessions').select('*').limit(1);

    if (error) {
      console.error('[Supabase] Connection test failed:', error.message);
      if (error.message.includes('project is suspended')) {
        console.error('[Supabase] Your Supabase project might be paused. Check your dashboard.');
      }
    } else {
      console.log('[Supabase] ✅ Connection test successful. Status:', status);
    }
  } catch (e: any) {
    console.error('[Supabase] Connection test exception:', e.message);
  }
}

testSupabaseConnection();
