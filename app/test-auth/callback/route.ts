import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorParam = requestUrl.searchParams.get("error");
  const redirectTo = requestUrl.searchParams.get("redirect") || "/test-auth";

  // Handle OAuth errors from provider
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/test-auth?error=${encodeURIComponent(errorParam)}`, requestUrl.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/test-auth?error=no_code", requestUrl.origin)
    );
  }

  try {
    const cookieStore = await cookies();
    
    // Create Supabase client with proper cookie handling using @supabase/ssr
    // This is the PROPER way - let Supabase manage cookies automatically
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
              // Handle cookie setting errors (e.g., in middleware)
              console.error("Error setting cookies:", error);
            }
          },
        },
      }
    );

    // Exchange code for session - Supabase handles cookies automatically
    // No manual cookie manipulation needed!
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(
        new URL(`/test-auth?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }

    // Success! Redirect to test page
    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
  } catch (error: any) {
    console.error("Unexpected error in auth callback:", error);
    return NextResponse.redirect(
      new URL(`/test-auth?error=${encodeURIComponent(error.message || "Unknown error")}`, requestUrl.origin)
    );
  }
}