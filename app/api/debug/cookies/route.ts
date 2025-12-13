import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookieStore = request.cookies;
  const cookieHeader = request.headers.get("cookie") || "";
  
  const allCookies = cookieStore.getAll().map(c => ({
    name: c.name,
    value: c.value.substring(0, 50) + (c.value.length > 50 ? '...' : ''), // Truncate for security
    hasValue: !!c.value,
  }));

  const supabaseCookies = allCookies.filter(c => 
    c.name.includes('sb-') || 
    c.name.includes('supabase') ||
    c.name.toLowerCase().includes('auth')
  );

  return NextResponse.json({
    cookieCount: cookieStore.size,
    cookieHeader: cookieHeader.substring(0, 200) + (cookieHeader.length > 200 ? '...' : ''),
    allCookies: allCookies,
    supabaseCookies: supabaseCookies,
    hasSupabaseCookies: supabaseCookies.length > 0,
  });
}
