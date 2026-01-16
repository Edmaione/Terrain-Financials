import { createClient } from '@supabase/supabase-js';

// Runtime check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
    'Please add it to your .env.local file.'
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
    'This key is required for server-side operations. ' +
    'Please add it to your .env.local file. ' +
    'NEVER expose this key to the client!'
  );
}

/**
 * Admin Supabase client with service role key
 *
 * SECURITY WARNING:
 * - Only use this in API routes and server components
 * - NEVER import this in client components
 * - This client bypasses Row Level Security (RLS)
 *
 * Use cases:
 * - Internal tooling operations
 * - Admin mutations in API routes
 * - Server-side data fetching where RLS is not needed
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
