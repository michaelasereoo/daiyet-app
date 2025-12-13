import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Creates an admin Supabase client with service role key.
 * This bypasses Row Level Security (RLS) and should only be used server-side.
 * 
 * ⚠️ NEVER expose this client to the client-side!
 * 
 * Usage:
 * ```tsx
 * // Server Component or Server Action only
 * import { createAdminClient } from '@/lib/supabase/server/admin'
 * 
 * export default async function AdminPage() {
 *   const supabase = createAdminClient()
 *   // Can access all data, bypasses RLS
 * }
 * ```
 */
export function createAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'nextjs-auth-system',
      },
    },
  })
}

