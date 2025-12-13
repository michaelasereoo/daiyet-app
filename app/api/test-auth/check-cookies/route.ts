import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const cookieHeader = request.headers.get("cookie") || "";
    
    const allCookies = cookieStore.getAll().map(c => ({
      name: c.name,
      value: c.value.substring(0, 100) + (c.value.length > 100 ? '...' : ''),
      fullLength: c.value.length,
      hasValue: !!c.value,
    }));

    // Find code verifier cookies
    const codeVerifierCookies = allCookies.filter(c => 
      c.name.includes('code-verifier') || 
      c.name.includes('codeVerifier') ||
      c.name.endsWith('-code-verifier')
    );

    // Find Supabase auth cookies
    const supabaseCookies = allCookies.filter(c => 
      c.name.includes('sb-') || 
      c.name.includes('supabase')
    );

    return NextResponse.json({
      success: true,
      cookieCount: cookieStore.size,
      cookieHeaderLength: cookieHeader.length,
      cookieHeaderPreview: cookieHeader.substring(0, 200) + (cookieHeader.length > 200 ? '...' : ''),
      allCookies: allCookies,
      codeVerifierCookies: codeVerifierCookies,
      supabaseCookies: supabaseCookies,
      hasCodeVerifier: codeVerifierCookies.length > 0,
      hasSupabaseCookies: supabaseCookies.length > 0,
      codeVerifierNames: codeVerifierCookies.map(c => c.name),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
