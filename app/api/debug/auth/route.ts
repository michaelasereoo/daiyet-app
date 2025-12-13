import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server/client";

/**
 * Debug endpoint to check authentication status
 * 
 * Usage:
 * curl http://localhost:3000/api/debug/auth
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Get cookies (sanitized)
    const cookies = request.cookies.getAll().map(c => ({
      name: c.name,
      value: c.value.length > 20 ? c.value.substring(0, 20) + '...' : c.value,
      hasValue: !!c.value,
    }));

    // Check for Supabase auth cookies
    const supabaseCookies = cookies.filter(c => 
      c.name.startsWith('sb-') || 
      c.name.includes('supabase') ||
      c.name.includes('auth')
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      hasSession: !!session,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        email_confirmed_at: session.user.email_confirmed_at,
      } : null,
      sessionError: sessionError ? {
        message: sessionError.message,
        status: sessionError.status,
      } : null,
      cookies: {
        total: cookies.length,
        supabaseAuthCookies: supabaseCookies.length,
        allCookies: cookies,
      },
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL 
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin 
          : null,
      },
      request: {
        url: request.url,
        method: request.method,
        headers: {
          host: request.headers.get('host'),
          userAgent: request.headers.get('user-agent'),
        },
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

