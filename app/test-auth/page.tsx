"use client";

import { useState, useEffect } from "react";
import { createClient, debugAuth } from "@/lib/supabase/client/client";
import { Button } from "@/components/ui/button";

export default function TestAuthPage() {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<{
    session: any;
    user: any;
    cookies: string;
    localStorage: Record<string, string | null>;
    sessionError?: string | null;
    userError?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cookieInfo, setCookieInfo] = useState<{name: string, value: string}[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [localStorageInfo, setLocalStorageInfo] = useState<{key: string, hasValue: boolean}[]>([]);

  // Initialize Supabase client only in browser
  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Set a timeout to ensure loading doesn't stay true forever
    const timeout = setTimeout(() => {
      console.warn('⚠️ [DEBUG] Loading timeout - forcing loading to false');
      setLoading(false);
    }, 5000); // 5 second timeout

    try {
      // Check if environment variables are set
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ [DEBUG] Missing environment variables:', {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        });
        setError('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
        setLoading(false);
        clearTimeout(timeout);
        return;
      }

      // Use the same createBrowserClient helper that has proper cookie storage for code verifier
      // This will return the singleton instance if AuthProvider already created one
      // This prevents "Multiple GoTrueClient instances" warning
      const client = createClient();
      setSupabase(client);
    } catch (err: any) {
      console.error('❌ [DEBUG] Error creating Supabase client:', err);
      setError(`Error creating Supabase client: ${err.message}`);
      setLoading(false);
      clearTimeout(timeout);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  // Auth debug: capture session/user + cookies/localStorage and render on page
  useEffect(() => {
    if (!supabase) return;

    const runDebug = async () => {
      try {
        const { data: { session: s }, error: sErr } = await supabase.auth.getSession();
        const { data: { user: u }, error: uErr } = await supabase.auth.getUser();

        const storageDump: Record<string, string | null> = {};
        for (let i = 0; typeof window !== 'undefined' && i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            storageDump[key] = window.localStorage.getItem(key);
          }
        }

        setDebugInfo({
          session: s || null,
          user: u || null,
          cookies: typeof document !== 'undefined' ? document.cookie : '',
          localStorage: storageDump,
          sessionError: sErr?.message || null,
          userError: uErr?.message || null,
        });
      } catch (err: any) {
        setDebugInfo({
          session: null,
          user: null,
          cookies: typeof document !== 'undefined' ? document.cookie : '',
          localStorage: {},
          sessionError: err?.message || 'Unknown error',
          userError: null,
        });
      }
    };

    runDebug();
  }, [supabase]);

  // Check for error or code in URL params and auto-fetch diagnostics
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    const codeParam = params.get('code');
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      // Auto-fetch diagnostics when there's an error
      fetchDiagnostics();
    }
    
    if (codeParam) {
      // Auto-fetch diagnostics when there's a code (callback scenario)
      fetchDiagnostics();
    }
  }, []);

  // Check session on mount and run debug
  useEffect(() => {
    if (!supabase) {
      // If supabase is not set after a delay, set loading to false
      const timeout = setTimeout(() => {
        if (!supabase) {
          console.warn('⚠️ [DEBUG] Supabase client not initialized after delay');
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }

    // Run debug auth on mount
    debugAuth().catch(console.error);

    const checkSession = async () => {
      try {
        console.log('🔍 [DEBUG] Starting auth check...');
        
        // Set a timeout for the entire checkSession operation
        const sessionTimeout = setTimeout(() => {
          console.warn('⚠️ [DEBUG] checkSession timeout - forcing loading to false');
          setLoading(false);
        }, 10000); // 10 second timeout for session check
        
        // Debug: Check cookies
        const allCookies = document.cookie.split(';').map(c => c.trim());
        console.log('🍪 [DEBUG] All cookies:', allCookies);
        
        // Debug: Check localStorage
        console.log('💾 [DEBUG] localStorage keys:');
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('auth'))) {
            const value = localStorage.getItem(key);
            console.log(`  ${key}: ${value?.substring(0, 100)}...`);
          }
        }
        
        // Method 1: Try getSession
        console.log('📡 [DEBUG] Calling getSession()...');
        let currentSession = null;
        let sessionError = null;
        try {
          const result = await supabase.auth.getSession();
          currentSession = result.data.session;
          sessionError = result.error;
        } catch (err: any) {
          console.error('❌ [DEBUG] getSession threw error:', err);
          sessionError = err;
        }
        
        console.log('📡 [DEBUG] getSession result:', {
          hasSession: !!currentSession,
          hasError: !!sessionError,
          error: sessionError?.message,
          userId: currentSession?.user?.id,
          email: currentSession?.user?.email,
        });
        
        // Method 2: Try getUser (makes API call)
        console.log('📡 [DEBUG] Calling getUser()...');
        let currentUser = null;
        let userError = null;
        try {
          const result = await supabase.auth.getUser();
          currentUser = result.data.user;
          userError = result.error;
        } catch (err: any) {
          console.error('❌ [DEBUG] getUser threw error:', err);
          userError = err;
        }
        
        console.log('📡 [DEBUG] getUser result:', {
          hasUser: !!currentUser,
          hasError: !!userError,
          error: userError?.message,
          userId: currentUser?.id,
          email: currentUser?.email,
        });
        
        // Method 3: Check network request
        console.log('🌐 [DEBUG] Testing direct API call...');
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          if (!supabaseUrl) {
            console.warn('⚠️ [DEBUG] NEXT_PUBLIC_SUPABASE_URL not set');
          } else {
            const apiResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
              credentials: 'include',
              headers: {
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              },
            });
            const apiData = await apiResponse.json();
            console.log('🌐 [DEBUG] Direct API call result:', apiData);
          }
        } catch (apiErr: any) {
          console.error('🌐 [DEBUG] Direct API call error:', apiErr);
        }
        
        clearTimeout(sessionTimeout);
        
        if (sessionError) {
          setError(`Session Error: ${sessionError.message}`);
        } else if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        } else if (currentUser) {
          // If getUser worked but getSession didn't, we have a session issue
          console.warn('⚠️ [DEBUG] getUser returned user but getSession returned no session');
          setUser(currentUser);
        }
      } catch (err: any) {
        console.error('❌ [DEBUG] Error in checkSession:', err);
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch diagnostics from server
  const fetchDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const [cookiesRes, storageRes] = await Promise.all([
        fetch('/api/test-auth/check-cookies', { credentials: 'include' }),
        fetch('/api/test-auth/debug-storage', { credentials: 'include' }),
      ]);

      const cookiesData = await cookiesRes.json();
      const storageData = await storageRes.json();

      setDiagnostics({
        serverCookies: cookiesData,
        serverStorage: storageData,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setDiagnostics({
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  // Check cookies and localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkStorage = () => {
      // Check cookies
      const cookies = document.cookie.split(';').map(c => {
        const [name, ...rest] = c.trim().split('=');
        return {
          name: name.trim(),
          value: rest.join('=').substring(0, 50) + (rest.join('=').length > 50 ? '...' : '')
        };
      });
      setCookieInfo(cookies);

      // Check localStorage for code verifier
      const localStorageItems: {key: string, hasValue: boolean}[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.includes('code-verifier') || key.includes('supabase'))) {
          localStorageItems.push({
            key: key,
            hasValue: !!window.localStorage.getItem(key),
          });
        }
      }
      setLocalStorageInfo(localStorageItems);
    };
    
    checkStorage();
    const interval = setInterval(checkStorage, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleGoogleSignIn = async () => {
    if (!supabase || typeof window === 'undefined') return;
    
    setError(null);
    setLoading(true);

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/test-auth/callback?redirect=/test-auth`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        setError(`OAuth Error: ${oauthError.message}`);
        setLoading(false);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    
    setError(null);
    setLoading(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        setError(`Sign Out Error: ${signOutError.message}`);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Supabase Auth Test Page</h1>
          <p className="text-white/70">
            This page demonstrates proper Supabase + Google Auth + Cookies implementation
          </p>
        </div>

        {/* Auth Status */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1">Authentication Status</h2>
            <p className="text-sm text-white/70">Current session and user information</p>
          </div>
          <div className="space-y-4">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-semibold">Authenticated</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>User ID:</strong> {user.id}</p>
                  <p><strong>Email Verified:</strong> {user.email_confirmed_at ? 'Yes' : 'No'}</p>
                  {session && (
                    <p><strong>Session Expires:</strong> {new Date(session.expires_at! * 1000).toLocaleString()}</p>
                  )}
                </div>
                <Button onClick={handleSignOut} disabled={loading} className="mt-4">
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="font-semibold">Not Authenticated</span>
                </div>
                <p className="text-sm text-white/70">Click the button below to sign in with Google</p>
                <Button onClick={handleGoogleSignIn} disabled={loading || !supabase} className="mt-4">
                  Sign In with Google
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Client-Side Storage */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1">Client-Side Storage (Browser)</h2>
            <p className="text-sm text-white/70">
              Cookies and localStorage that the browser can see
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Cookies ({cookieInfo.length})</h3>
              {cookieInfo.length === 0 ? (
                <p className="text-sm text-white/70">No cookies found</p>
              ) : (
                <div className="space-y-2">
                  {cookieInfo.map((cookie, idx) => {
                    const isCodeVerifier = cookie.name.includes('code-verifier');
                    return (
                      <div key={idx} className={`text-sm font-mono p-2 bg-[#0a0a0a] rounded border ${isCodeVerifier ? 'border-yellow-500/50' : 'border-[#262626]'}`}>
                        <div className={`${isCodeVerifier ? 'text-yellow-400' : 'text-green-400'}`}>
                          {cookie.name} {isCodeVerifier && '🔑'}
                        </div>
                        <div className="text-white/50 text-xs mt-1">{cookie.value}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">localStorage (Code Verifier Related)</h3>
              {localStorageInfo.length === 0 ? (
                <p className="text-sm text-white/70">No code verifier found in localStorage</p>
              ) : (
                <div className="space-y-2">
                  {localStorageInfo.map((item, idx) => (
                    <div key={idx} className="text-sm font-mono p-2 bg-[#0a0a0a] rounded border border-[#262626]">
                      <div className="text-blue-400">{item.key}</div>
                      <div className="text-white/50 text-xs mt-1">
                        {item.hasValue ? 'Has value' : 'Empty'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Server-Side Diagnostics */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-1">Server-Side Diagnostics</h2>
              <p className="text-sm text-white/70">
                What the server sees when processing the callback
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={async () => {
                  if (typeof window !== 'undefined' && supabase) {
                    await debugAuth()
                    // Refresh the debug info after running debugAuth
                    const { data: { session: s }, error: sErr } = await supabase.auth.getSession();
                    const { data: { user: u }, error: uErr } = await supabase.auth.getUser();
                    setDebugInfo(prev => ({
                      ...prev,
                      session: s || null,
                      user: u || null,
                      sessionError: sErr?.message || null,
                      userError: uErr?.message || null,
                    }))
                  }
                }}
                variant="outline"
                size="sm"
              >
                Debug Auth
              </Button>
              <Button 
                onClick={fetchDiagnostics} 
                disabled={loadingDiagnostics}
                variant="outline"
                size="sm"
              >
                {loadingDiagnostics ? 'Loading...' : 'Refresh Diagnostics'}
              </Button>
            </div>
          </div>
          {diagnostics ? (
            <div className="space-y-4">
              {diagnostics.error ? (
                <div className="text-red-400 text-sm">{diagnostics.error}</div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Server Cookies Check</h3>
                    <pre className="text-xs bg-[#0a0a0a] p-3 rounded border border-[#262626] overflow-auto max-h-60">
                      {JSON.stringify(diagnostics.serverCookies, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Server Storage Check</h3>
                    <pre className="text-xs bg-[#0a0a0a] p-3 rounded border border-[#262626] overflow-auto max-h-60">
                      {JSON.stringify(diagnostics.serverStorage, null, 2)}
                    </pre>
                  </div>
                  <div className="text-xs text-white/50">
                    Last updated: {new Date(diagnostics.timestamp).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/70">Click "Refresh Diagnostics" to check server-side state</p>
          )}
        </div>

        {/* Auth Debug Snapshot */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1">Auth Debug Snapshot</h2>
            <p className="text-sm text-white/70">Live client-side view of session, user, cookies, and localStorage</p>
          </div>
          <div className="space-y-3 text-xs bg-[#0a0a0a] p-3 rounded border border-[#262626] max-h-96 overflow-auto">
            <div>
              <div className="text-white/70 mb-1">Session (getSession)</div>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(debugInfo?.session, null, 2) || 'null'}</pre>
            </div>
            <div>
              <div className="text-white/70 mb-1">User (getUser)</div>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(debugInfo?.user, null, 2) || 'null'}</pre>
            </div>
            <div>
              <div className="text-white/70 mb-1">Errors</div>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify({ sessionError: debugInfo?.sessionError, userError: debugInfo?.userError }, null, 2)}</pre>
            </div>
            <div>
              <div className="text-white/70 mb-1">document.cookie</div>
              <pre className="whitespace-pre-wrap break-all">{debugInfo?.cookies || ''}</pre>
            </div>
            <div>
              <div className="text-white/70 mb-1">localStorage</div>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(debugInfo?.localStorage || {}, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* Manual Test Exchange */}
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code') && (
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">Manual Exchange Test</h2>
              <p className="text-sm text-white/70">
                Test the code exchange manually with current cookies
              </p>
            </div>
            <Button 
              onClick={async () => {
                const code = new URLSearchParams(window.location.search).get('code');
                if (!code) return;
                
                try {
                  const res = await fetch(`/api/test-auth/test-exchange?code=${code}`, {
                    credentials: 'include',
                  });
                  const data = await res.json();
                  setDiagnostics((prev: any) => ({
                    ...prev,
                    exchangeTest: data,
                    exchangeTimestamp: new Date().toISOString(),
                  }));
                } catch (err: any) {
                  setError(`Exchange test failed: ${err.message}`);
                }
              }}
              variant="outline"
            >
              Test Exchange
            </Button>
            {diagnostics?.exchangeTest && (
              <div className="mt-4">
                <pre className="text-xs bg-[#0a0a0a] p-3 rounded border border-[#262626] overflow-auto max-h-60">
                  {JSON.stringify(diagnostics.exchangeTest, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Best Practices */}
        <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-1">Best Practices</h2>
            <p className="text-sm text-white/70">How this page implements proper Supabase auth</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-400">✅</span>
                <div>
                  <strong>Uses standard createClient:</strong>
                  <p className="text-white/70">Works reliably in client components with PKCE flow</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400">✅</span>
                <div>
                  <strong>No manual cookie manipulation:</strong>
                  <p className="text-white/70">Supabase handles all cookie creation, reading, and expiration</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400">✅</span>
                <div>
                  <strong>Proper OAuth redirect:</strong>
                  <p className="text-white/70">Uses redirectTo pointing to /test-auth/callback route</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* URL Parameters */}
        {typeof window !== 'undefined' && window.location.search && (
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">URL Parameters</h2>
              <p className="text-sm text-white/70">Current URL query parameters</p>
            </div>
            <div>
              <pre className="text-xs bg-[#0a0a0a] p-3 rounded border border-[#262626] overflow-auto">
                {window.location.search}
              </pre>
              <div className="mt-2 text-sm">
                {new URLSearchParams(window.location.search).get('code') && (
                  <div className="text-yellow-400">⚠️ Code parameter detected - callback in progress</div>
                )}
                {new URLSearchParams(window.location.search).get('error') && (
                  <div className="text-red-400">❌ Error parameter detected</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <div>
              <p className="text-red-400 font-semibold">Error:</p>
              <p className="text-sm text-red-300 mt-1">{error}</p>
              {error.includes('code verifier') && (
                <div className="mt-4 text-xs text-red-200">
                  <p className="font-semibold mb-2">🔍 Troubleshooting Code Verifier Error:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Check if code verifier cookie exists in "Client-Side Storage" section</li>
                    <li>Click "Refresh Diagnostics" to see what server sees</li>
                    <li>Verify the cookie name matches what Supabase expects</li>
                    <li>Check if cookie has proper path and SameSite attributes</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-6">
          <div>
            <p className="text-blue-400 font-semibold mb-2">📋 How to Test:</p>
            <ol className="text-sm text-white/70 space-y-1 list-decimal list-inside">
              <li>Click "Sign In with Google" button</li>
              <li>Complete Google OAuth flow</li>
              <li>You'll be redirected back to this page</li>
              <li>Check "Cookies" section - you should see Supabase auth cookies</li>
              <li>Check "Authentication Status" - should show your user info</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}