import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Extract project ID from URL for cookie matching
const projectId = supabaseUrl.split('//')[1]?.split('.')[0] || 'unknown'
const cookieName = `sb-${projectId}-auth-token`

// DEBUG: Verify we're using the right project
if (typeof window !== 'undefined') {
  console.log('🔗 Supabase Project ID:', projectId)
  console.log('🍪 Looking for cookies:', `${cookieName}.0`, `${cookieName}.1`)
}

/**
 * Custom storage adapter that reads auth tokens from cookies first,
 * then falls back to localStorage for other items.
 */
const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    
    // For auth tokens, check cookies first
    if (key.includes('auth-token') && !key.includes('code-verifier')) {
      const cookies = document.cookie.split(';')
      
      // Check for .0 (access token) and .1 (refresh token) cookies
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === `${cookieName}.0` || name === `${cookieName}.1`) {
          console.log(`🍪 Found auth cookie: ${name}`)
          // Return a placeholder - Supabase will use cookies via fetch
          // The actual token is in the cookie, not localStorage
          return 'cookie-present'
        }
      }
      
      // If cookies not found, check localStorage as fallback
      const lsValue = localStorage.getItem(key)
      if (lsValue) {
        console.log(`💾 Found auth token in localStorage: ${key}`)
        return lsValue
      }
      
      console.log(`❌ No auth token found for: ${key}`)
      return null
    }
    
    // For code verifier and other items, use localStorage
    return localStorage.getItem(key)
  },
  
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    
    // Don't store auth tokens in localStorage if we have cookies
    if (key.includes('auth-token') && !key.includes('code-verifier')) {
      const hasCookie = document.cookie.includes(`${cookieName}.0`) || 
                       document.cookie.includes(`${cookieName}.1`)
      if (hasCookie) {
        console.log(`⚠️ Auth token cookie exists, skipping localStorage for: ${key}`)
        return
      }
    }
    
    localStorage.setItem(key, value)
  },
  
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  }
}

/**
 * Creates a Supabase client for use in client components.
 * Configured to read auth tokens from cookies when available.
 * 
 * Usage:
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client/client'
 * 
 * export default function MyComponent() {
 *   const supabase = createClient()
 *   // Use supabase.auth, supabase.from, etc.
 * }
 * ```
 */
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false, // Critical for cookie-based auth
      persistSession: true,      // Must be true
      autoRefreshToken: true,    // Enable token refresh
      storage: cookieStorage,    // Use our custom storage
      flowType: 'pkce',          // Required for OAuth with cookies
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web'
      },
      fetch: (url, options = {}) => {
        // Force credentials to be included in all requests (sends cookies)
        return fetch(url, {
          ...options,
          credentials: 'include',
        })
      }
    }
  })
}

/**
 * Debug function to check auth status
 */
export async function debugAuth() {
  if (typeof window === 'undefined') return null
  
  console.log('🔍 Debugging auth...')
  
  // 1. Check cookies
  const cookies = document.cookie.split(';')
  const authCookies = cookies.filter(c => c.includes(cookieName))
  console.log(`🍪 Auth cookies: ${authCookies.length} found`)
  authCookies.forEach(c => console.log(`  - ${c.trim().substring(0, 50)}...`))
  
  // 2. Try direct fetch to verify cookies work
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'apikey': supabaseAnonKey,
      }
    })
    
    const data = await response.json()
    console.log('🎯 Direct API call result:', data)
  } catch (error) {
    console.error('🚨 Direct API call failed:', error)
  }
  
  // 3. Try getSession
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  console.log('📋 getSession:', session ? '✅ SUCCESS' : '❌ NULL', error)
  
  // 4. Try getUser
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('👤 getUser:', user ? '✅ SUCCESS' : '❌ NULL', userError)
  
  return { session, user, error, userError }
}

