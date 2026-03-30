import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing env vars. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persist session in localStorage (available in Electron renderer)
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // We handle deep link callbacks manually
    },
});
