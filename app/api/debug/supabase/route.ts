import { NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabaseAdmin = createAdminClientServer();
    
    // Test 1: Simple query to event_types
    const { data: eventTypesData, error: eventTypesError, count } = await supabaseAdmin
      .from('event_types')
      .select('*', { count: 'exact', head: true })
      .limit(1);
    
    // Test 2: Check users table access (more reliable than RPC)
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    
    // Check environment variables (masked)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    return NextResponse.json({
      status: eventTypesError ? 'FAILED' : 'OK',
      timestamp: new Date().toISOString(),
      tests: {
        connection: eventTypesError ? 'FAILED' : 'OK',
        query: count !== null ? 'OK' : 'FAILED',
        tableAccess: usersError ? 'FAILED' : 'OK',
      },
      results: {
        eventTypesCount: count,
        usersTableAccessible: !usersError,
      },
      errors: {
        eventTypes: eventTypesError?.message || null,
        users: usersError?.message || null,
      },
      environment: {
        supabaseUrlPresent: !!supabaseUrl,
        supabaseUrlDomain: supabaseUrl?.replace(/https?:\/\//, '').split('/')[0] || null,
        serviceKeyPresent: hasServiceKey,
        region: supabaseUrl?.includes('.supabase.co') ? 'supabase' : 'custom',
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrlPresent: !!process.env.SUPABASE_URL,
        serviceKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }, { status: 500 });
  }
}
