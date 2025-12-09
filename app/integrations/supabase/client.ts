import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://yryjvcilhnnchaieieby.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyeWp2Y2lsaG5uY2hhaWVpZWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDE1MTEsImV4cCI6MjA4MDgxNzUxMX0.c8JGh84L3nsg-tqJndoQcY8GN3qGgzXyoE711t_nLj8";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
