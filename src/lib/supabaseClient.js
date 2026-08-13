import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The anon/publishable key is safe to expose client-side — Row Level Security
// policies on the tables are what actually restrict access, not secrecy of this key.
// The service-role key must NEVER appear here or anywhere in frontend code.
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url, anonKey)
  : null;

if (!supabaseConfigured) {
  console.warn(
    'Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'Copy .env.example to .env.local and fill in your project credentials.'
  );
}
