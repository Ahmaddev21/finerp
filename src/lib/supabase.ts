import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only configure if we have a valid-looking URL (not a placeholder)
const isValidUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && url.includes('supabase.co');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured =
  !!(supabaseUrl && supabaseAnonKey &&
     isValidUrl(supabaseUrl) &&
     !supabaseUrl.includes('your_') &&
     !supabaseAnonKey.includes('your_'));

// Create a real client only when valid, otherwise a stub that never throws
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (new Proxy({} as SupabaseClient, {
      get: () => () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    }));

if (!isSupabaseConfigured) {
  console.warn(
    '[FinERP] Supabase not configured — running in offline/demo mode.\n' +
    'To enable persistence: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  );
}
