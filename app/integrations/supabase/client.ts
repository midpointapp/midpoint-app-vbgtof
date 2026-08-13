import { createClient } from '@supabase/supabase-js';

// The project URL and publishable key are public client configuration, not
// privileged server secrets. Real authorization is enforced by the Edge
// Functions and database permissions/RLS.
const FALLBACK_URL = 'https://kjlbcgjvruyrqvkdtljz.supabase.co';
const FALLBACK_KEY = 'sb_publishable_gYoM_nIHjWmI_KAMf0NHXQ_xVBsYd1O';

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_KEY;

export { supabaseUrl };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
