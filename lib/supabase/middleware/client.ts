import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client for use in Next.js middleware.
 * Handles cookies from the request and sets them in the response.
 * 
 * Usage:
 * ```tsx
 * // middleware.ts
 * import { createClient } from '@/lib/supabase/middleware/client'
 * 
 * export async function middleware(request: NextRequest) {
 *   const { supabase, response } = createClient(request)
 *   const { data: { user } } = await supabase.auth.getUser()
 *   // ...
 *   return response
 * }
 * ```
 */
export function createClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  return { supabase, response }
}

