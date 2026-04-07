import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
    console.warn('[Supabase] Missing env vars. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
        // Persist session in localStorage (available in Electron renderer)
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // We handle deep link callbacks manually
    },
});
