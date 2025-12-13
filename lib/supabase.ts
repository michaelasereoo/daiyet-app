// Legacy exports for backward compatibility
// New code should use lib/supabase/client.ts or lib/supabase/server.ts

import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createComponentClient, createAdminClient } from "./supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// For server-side operations, use service role key if available
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Legacy client exports (for backward compatibility)
// Use lazy getter to handle SSR - only create client when accessed
let _supabaseInstance: ReturnType<typeof createBrowserClient> | ReturnType<typeof createComponentClient> | null = null;

function getSupabaseInstance() {
  if (_supabaseInstance) return _supabaseInstance;
  
  try {
    if (typeof window !== "undefined") {
      _supabaseInstance = createBrowserClient();
    } else {
      _supabaseInstance = createComponentClient();
    }
  } catch (error) {
    // Fallback to component client if browser client fails
    _supabaseInstance = createComponentClient();
  }
  
  return _supabaseInstance;
}

// Export as object with getter properties
export const supabase = {
  get auth() {
    return getSupabaseInstance().auth;
  },
  get from() {
    return getSupabaseInstance().from;
  },
  get storage() {
    return getSupabaseInstance().storage;
  },
  get functions() {
    return getSupabaseInstance().functions;
  },
  get rest() {
    return getSupabaseInstance().rest;
  },
  get realtime() {
    return getSupabaseInstance().realtime;
  },
} as ReturnType<typeof createBrowserClient>;

// Server-side client with service role (for admin operations)
// NOTE: This should only be used in server-side code (API routes, server components)
// For client components, use the regular supabase client
// If you need admin operations in client, create an API route instead
let _supabaseAdminInstance: ReturnType<typeof createAdminClient> | ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseAdminInstance() {
  if (_supabaseAdminInstance) return _supabaseAdminInstance;
  
  try {
    if (supabaseServiceKey) {
      // Only create admin client if we're in a server context (no window)
      if (typeof window === "undefined") {
        _supabaseAdminInstance = createAdminClient();
      } else {
        // In browser, fall back to regular client (won't have admin privileges)
        console.warn("supabaseAdmin used in browser context - falling back to regular client");
        _supabaseAdminInstance = getSupabaseInstance();
      }
    } else {
      _supabaseAdminInstance = getSupabaseInstance();
    }
  } catch (error) {
    _supabaseAdminInstance = getSupabaseInstance();
  }
  
  return _supabaseAdminInstance;
}

// Export as object with getter properties (lazy initialization)
export const supabaseAdmin = {
  get auth() {
    return getSupabaseAdminInstance().auth;
  },
  get from() {
    return getSupabaseAdminInstance().from;
  },
  get storage() {
    return getSupabaseAdminInstance().storage;
  },
  get functions() {
    return getSupabaseAdminInstance().functions;
  },
  get rest() {
    return getSupabaseAdminInstance().rest;
  },
  get realtime() {
    return getSupabaseAdminInstance().realtime;
  },
} as ReturnType<typeof createAdminClient>;

// Re-export new client factories for convenience
export { createBrowserClient, createComponentClient, createAdminClient } from "./supabase/client";

// NOTE: Server-side functions are NOT exported here to avoid importing server code in client components
// Import server functions directly from "./supabase/server" in server components/routes
// Example: import { createAdminClientServer } from "@/lib/supabase/server";
