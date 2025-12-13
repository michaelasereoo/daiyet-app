import { NextResponse } from "next/server";

export async function GET() {
  try {
    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      status: "ok",
      checks: {},
    };

    // Check environment variables
    diagnostics.checks.env = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // Check Supabase connection (only if env vars are set)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createAdminClientServer } = await import("@/lib/supabase/server");
        const supabaseAdmin = createAdminClientServer();
        const { data, error } = await supabaseAdmin.from("users").select("id").limit(1);
        
        diagnostics.checks.database = {
          connected: !error,
          error: error?.message || null,
        };

        // Check if tables exist
        const tables = ["users", "auth_audit_log", "access_logs"];
        const tableChecks: Record<string, boolean> = {};
        
        for (const table of tables) {
          const { error: tableError } = await supabaseAdmin.from(table).select("id").limit(1);
          tableChecks[table] = !tableError;
        }
        
        diagnostics.checks.tables = tableChecks;
      } catch (err: any) {
        diagnostics.checks.database = {
          connected: false,
          error: err?.message || "Unknown error",
        };
        diagnostics.status = "error";
      }
    } else {
      diagnostics.checks.database = {
        connected: false,
        error: "Environment variables not set",
      };
      diagnostics.status = "warning";
    }

    const statusCode = diagnostics.status === "ok" ? 200 : diagnostics.status === "warning" ? 200 : 500;
    return NextResponse.json(diagnostics, { status: statusCode });
  } catch (error: any) {
    console.error("HealthCheckError", {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: "error",
        error: error?.message || "Unknown error",
        errorName: error?.name,
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

