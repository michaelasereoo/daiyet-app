import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Server component client factory
export async function createServerComponentClient() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value || null;
      },
      set() {},
      remove() {},
    },
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

// Route handler client factory
export function createRouteHandlerClientFromRequest(cookieHeader: string) {
  // Parse cookies into a map for easier lookup
  const cookieMap: Record<string, string> = {};
  if (cookieHeader) {
    // Handle both space-separated and semicolon-separated cookies
    cookieHeader.split(';').forEach(cookie => {
      const trimmed = cookie.trim();
      if (!trimmed) return;
      
      const [name, ...rest] = trimmed.split('=');
      if (name && rest.length > 0) {
        const value = rest.join('=').trim();
        if (value) {
          try {
            cookieMap[name.trim()] = decodeURIComponent(value);
          } catch {
            // If decode fails, use raw value
            cookieMap[name.trim()] = value;
          }
        }
      }
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // Try exact match first
        if (cookieMap[name]) {
          return cookieMap[name];
        }
        // Try case-insensitive match (some browsers send cookies with different casing)
        const lowerName = name.toLowerCase();
        for (const [key, value] of Object.entries(cookieMap)) {
          if (key.toLowerCase() === lowerName) {
            return value;
          }
        }
        return null;
      },
      set() {},
      remove() {},
    },
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

// Middleware client factory
export function createMiddlewareClient(cookieHeader: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const match = cookieHeader.match(new RegExp(`(^| )${name}=([^;]+)`));
        return match ? decodeURIComponent(match[2]) : null;
      },
      set() {},
      remove() {},
    },
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

// Admin client factory (server-side)
export function createAdminClientServer() {
  if (!supabaseServiceKey) {
    console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set! Admin operations will fail.');
    // Return a client with anon key as fallback (will have limited permissions)
    // This prevents the app from crashing but operations may fail
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
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

// Cookie handling utilities
export function getCookieHeader(request: Request): string {
  return request.headers.get("cookie") || "";
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });

  return cookies;
}
