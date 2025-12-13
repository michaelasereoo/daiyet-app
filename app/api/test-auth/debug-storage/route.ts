import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    
    // Parse cookies from header
    const parsedCookies: Record<string, string> = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name) {
          parsedCookies[name] = decodeURIComponent(rest.join('='));
        }
      });
    }

    // Find code verifier in cookies
    const codeVerifierKeys = Object.keys(parsedCookies).filter(key => 
      key.includes('code-verifier') || 
      key.includes('codeVerifier') ||
      key.endsWith('-code-verifier')
    );

    const codeVerifierInfo = codeVerifierKeys.map(key => ({
      name: key,
      hasValue: !!parsedCookies[key],
      valueLength: parsedCookies[key]?.length || 0,
      valuePreview: parsedCookies[key]?.substring(0, 20) + (parsedCookies[key]?.length > 20 ? '...' : '') || null,
    }));

    // Find Supabase cookies
    const supabaseKeys = Object.keys(parsedCookies).filter(key => 
      key.includes('sb-') || 
      key.includes('supabase')
    );

    return NextResponse.json({
      success: true,
      cookieHeaderLength: cookieHeader.length,
      totalCookies: Object.keys(parsedCookies).length,
      codeVerifierInfo: codeVerifierInfo,
      hasCodeVerifier: codeVerifierInfo.length > 0,
      supabaseCookies: supabaseKeys,
      allCookieNames: Object.keys(parsedCookies),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
