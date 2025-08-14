import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Supabase URL env (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) is missing.');
  }
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY env is missing.');
  }

  supabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });

  return supabaseClient;
}

// Database helper functions
export async function executeQuery(queryFn) {
  try {
    const supabase = getSupabaseClient();
    return await queryFn(supabase);
  } catch (error) {
    console.error('Database query error:', error);
    throw new Error(`Database operation failed: ${error.message}`);
  }
}
