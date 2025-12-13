import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    
    if (!code) {
      return NextResponse.json({
        success: false,
        error: "No code parameter provided",
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    
    // Get all cookies before exchange
    const cookiesBefore = cookieStore.getAll().map(c => ({
      name: c.name,
      hasValue: !!c.value,
    }));

    // Find code verifier
    const codeVerifierCookies = cookieStore.getAll().filter(c => 
      c.name.includes('code-verifier') || 
      c.name.includes('codeVerifier') ||
      c.name.endsWith('-code-verifier')
    );

    const codeVerifier = codeVerifierCookies.length > 0 ? codeVerifierCookies[0].value : null;

    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error("Error setting cookies:", error);
            }
          },
        },
      }
    );

    // Attempt exchange
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Get cookies after exchange
    const cookiesAfter = cookieStore.getAll().map(c => ({
      name: c.name,
      hasValue: !!c.value,
    }));

    return NextResponse.json({
      success: !error,
      error: error?.message || null,
      hasCodeVerifier: !!codeVerifier,
      codeVerifierLength: codeVerifier?.length || 0,
      codeVerifierCookieName: codeVerifierCookies.length > 0 ? codeVerifierCookies[0].name : null,
      codeLength: code.length,
      cookiesBefore: cookiesBefore,
      cookiesAfter: cookiesAfter,
      sessionCreated: !!data?.session,
      userCreated: !!data?.user,
      userId: data?.user?.id || null,
      userEmail: data?.user?.email || null,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
