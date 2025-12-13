// SIMPLIFIED SUPABASE CLIENT - Using @supabase/ssr
// Let the library handle PKCE, cookies, and localStorage - don't override defaults

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Browser client for client components
 * Uses @supabase/ssr which handles PKCE, cookies, and localStorage automatically
 */
export function createBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('createBrowserClient can only be used in browser context');
  }

  return createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Component client - same as browser client in browser context
 * For server context, returns a basic client (should use server/client.ts instead)
 */
export function createComponentClient() {
  if (typeof window !== 'undefined') {
    // Browser context - use SSR browser client
    return createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  // Server context - should use server/client.ts instead, but provide fallback
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

/**
 * Admin client (service role - for bypassing RLS)
 * ⚠️ NEVER expose this client to the client-side!
 */
export function createAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
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
  });
}

// Legacy exports for backward compatibility
// These are kept for existing code that might import them
let _supabase: ReturnType<typeof createComponentClient> | null = null;
let _supabaseAdmin: ReturnType<typeof createAdminClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;
  
  try {
    _supabase = typeof window !== 'undefined' 
      ? createBrowserClient()
      : createComponentClient();
  } catch {
    _supabase = createComponentClient();
  }
  
  return _supabase;
}

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  
  try {
    _supabaseAdmin = supabaseServiceKey 
      ? createAdminClient() 
      : createComponentClient();
  } catch {
    _supabaseAdmin = createComponentClient();
  }
  
  return _supabaseAdmin;
}

// Legacy exports - use lazy getters to prevent module load issues
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(target, prop) {
    return getSupabase()[prop as keyof ReturnType<typeof createBrowserClient>];
  }
});

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(target, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createAdminClient>];
  }
});
