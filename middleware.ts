import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware/client";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { authConfig, ADMIN_EMAIL } from "@/lib/auth/config";
import { normalizeRole, canAccessRoute, getAccountStatusRedirect } from "@/lib/utils/auth-utils";

// Define public routes (no authentication required)
const PUBLIC_ROUTES = [
  "/",
  "/auth/signin",
  "/auth/callback",
  "/auth/error",
  "/dietitian-login",
  "/dietitian-enrollment",
  "/login",
  "/signup",
  "/admin-login",
  // Admin utility routes (for setup/debugging - consider protecting these)
  "/admin/quick-fix",
  "/admin/create-users",
  "/admin/fix-dietitian",
  "/api/health",
  "/api/admin/check-user",
  "/api/admin/fix-dietitian",
  "/api/admin/create-users",
  "/api/admin/generate-meeting-links",
  "/api/auth/health",
  "/privacy-policy",
  "/terms-of-service",
];

// Define role-based route access
const ROLE_ROUTES = {
  DIETITIAN: ["/dashboard", "/dietitian", "/profile"],
  ADMIN: ["/admin", "/analytics", "/users"], // Admin should NOT access /dashboard - that's for dietitians only
  USER: ["/user-dashboard", "/profile", "/settings", "/book"],
} as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip for static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }
  
  // Skip for public API routes only
  if (pathname.startsWith("/api")) {
    // Check if it's a public API route
    const isPublicApiRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
    if (isPublicApiRoute) {
      return NextResponse.next();
    }
    // Otherwise, API routes require authentication - continue to auth check below
  }

  // Create Supabase client using @supabase/ssr
  const { supabase, response } = createClient(request);

  try {
    // Get user (more reliable than getSession in middleware)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    
    // If no user, redirect to signin
    if (error || !user) {
      console.warn("MiddlewareAuthError", {
        path: pathname,
        error: error?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });

      // Redirect to appropriate signin based on route
      let signinPath = "/auth/signin";
      if (pathname.startsWith("/dashboard")) {
        signinPath = "/dietitian-login";
      } else if (pathname.startsWith("/admin")) {
        signinPath = "/admin-login";
      }

      const signinUrl = new URL(signinPath, request.url);
      signinUrl.searchParams.set("callbackUrl", encodeURIComponent(request.url));

      return NextResponse.redirect(signinUrl);
    }
    
    // Create session object from user for compatibility
    const session = { user };

    // Get user from database (using admin client for reliability)
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (adminError: any) {
      console.error("MiddlewareAdminClientError", {
        error: adminError?.message,
        timestamp: new Date().toISOString(),
      });
      // Fallback: redirect to signin if admin client fails
      const signinUrl = new URL("/auth/signin", request.url);
      signinUrl.searchParams.set("error", "server_config");
      return NextResponse.redirect(signinUrl);
    }

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("role, email_verified, account_status")
      .eq("id", session.user.id)
      .single();

    if (userError || !dbUser) {
      console.error("MiddlewareUserFetchError", {
        userId: session.user.id,
        error: userError?.message,
        timestamp: new Date().toISOString(),
      });

      // User doesn't exist in database - redirect to complete profile
      return NextResponse.redirect(new URL("/dietitian-enrollment", request.url));
    }

    // Check account status
    const accountStatus = dbUser.account_status || "ACTIVE";
    const statusRedirect = getAccountStatusRedirect(accountStatus);

    if (statusRedirect) {
      console.warn("MiddlewareAccountStatusRedirect", {
        userId: session.user.id,
        accountStatus,
        redirectTo: statusRedirect,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.redirect(new URL(statusRedirect, request.url));
    }

    // Role-based access control
    const userRole = normalizeRole(dbUser.role);
    
    // Special check for admin routes: verify email matches admin email
    if (pathname.startsWith("/admin")) {
      const userEmail = session.user.email?.toLowerCase();
      const isAdminEmail = userEmail === ADMIN_EMAIL.toLowerCase();
      
      if (!isAdminEmail || userRole !== "ADMIN") {
        console.warn("MiddlewareAdminAccessDenied", {
          userId: session.user.id,
          userEmail,
          userRole,
          requestedPath: pathname,
          timestamp: new Date().toISOString(),
        });
        
        // Redirect to appropriate dashboard based on role
        const redirectPath = authConfig.redirects[userRole] || "/";
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
    }
    
    // Special check for dietitian dashboard: only DIETITIAN role can access
    if (pathname.startsWith("/dashboard") && userRole !== "DIETITIAN") {
      console.warn("MiddlewareDashboardAccessDenied", {
        userId: session.user.id,
        userRole,
        requestedPath: pathname,
        timestamp: new Date().toISOString(),
      });
      
      // Redirect to appropriate dashboard based on role
      const redirectPath = authConfig.redirects[userRole] || "/";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    
    const allowedRoutes = ROLE_ROUTES[userRole] || ROLE_ROUTES.USER;

    // Check if user has access to this route
    const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route));

    if (!hasAccess) {
      console.warn("MiddlewareAccessDenied", {
        userId: session.user.id,
        userRole,
        requestedPath: pathname,
        allowedRoutes,
        timestamp: new Date().toISOString(),
      });

      // Redirect to appropriate dashboard based on role
      const redirectPath = authConfig.redirects[userRole] || "/";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Add security headers (response already created by createClient)
    response.headers.set("X-User-ID", session.user.id);
    response.headers.set("X-User-Role", userRole);

    // Add cache control for authenticated pages
    if (!pathname.startsWith("/api/")) {
      response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    }

    // Audit log for sensitive actions
    if (pathname.includes("/admin") || pathname.includes("/settings") || pathname.includes("/dashboard/settings")) {
      try {
        await supabaseAdmin.from("access_logs").insert({
          user_id: session.user.id,
          path: pathname,
          method: request.method,
          user_agent: request.headers.get("user-agent"),
          ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("MiddlewareAccessLogError", {
          error: logError,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return response;
  } catch (error) {
    console.error("MiddlewareError", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: pathname,
      timestamp: new Date().toISOString(),
    });

    // Don't crash on middleware errors - redirect to error page
    const errorUrl = new URL("/auth/error", request.url);
    errorUrl.searchParams.set("type", "middleware_error");

    return NextResponse.redirect(errorUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
