import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || url.length < 10) {
    throw new Error('Invalid or missing Supabase URL environment variable.');
  }
  if (!key || key.length < 10) {
    throw new Error('Invalid or missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'User-Agent': 'TheGoatBot/1.0'
        }
      }
    });

    console.log('✅ Supabase client initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    throw new Error(`Supabase initialization failed: ${error.message}`);
  }
}

export async function executeQuery(queryFn) {
  try {
    const supabase = getSupabaseClient();
    const result = await queryFn(supabase);
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw new Error(`Database operation failed: ${error.message}`);
  }
}

export async function testConnection() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test error:', error);
    return false;
  }
}
