/**
 * @deprecated Use specific imports instead:
 * - For client components: import { supabaseBrowser } from '@/lib/supabase/browser'
 * - For API routes/server: import { supabaseAdmin } from '@/lib/supabase/admin'
 */

// Re-export for backward compatibility
export { supabaseBrowser as supabase } from './supabase/browser';
export { supabaseAdmin } from './supabase/admin';
