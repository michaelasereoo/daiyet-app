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
  "/therapist-login",
  "/therapist-enrollment",
  "/therapy",
  "/therapy/book",
  "/Therapist",
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
  THERAPIST: ["/therapist-dashboard", "/therapist", "/profile"],
  ADMIN: ["/admin", "/analytics", "/users"], // Admin should NOT access /dashboard - that's for dietitians only
  USER: ["/user-dashboard", "/profile", "/settings"],
} as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DEVELOPMENT MODE: Bypass all auth checks in localhost
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEV MODE] Bypassing auth in middleware for:', pathname);
    return NextResponse.next();
  }

  // CRITICAL: Allow RSC (React Server Component) requests to pass through
  // RSC requests are made by Next.js during client-side navigation to fetch server component data
  // They have special headers and should not be blocked by authentication middleware
  const acceptHeader = request.headers.get("accept") || "";
  const isRSCRequest = 
    acceptHeader.includes("text/x-component") ||
    acceptHeader.includes("application/vnd.nextjs.rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1";
  
  // Also check for Next.js internal RSC routes
  const isNextInternal = 
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_rsc") ||
    pathname.includes("__rsc");

  if (isRSCRequest || isNextInternal) {
    // Allow RSC requests to pass through - they'll handle auth at the component level
    // This prevents blocking Next.js's internal RSC payload fetches
    return NextResponse.next();
  }

  // Check authentication first (before skipping public routes)
  // This allows us to redirect authenticated users from home page to their dashboard
  const { supabase, response } = createClient(request);
  
  let user = null;
  try {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    user = authUser;
    
    // If user is authenticated and visiting home page, redirect to their dashboard
    if (!error && user && pathname === "/") {
      // Get user role from database to determine redirect
      try {
        const supabaseAdmin = createAdminClient();
        const { data: dbUser } = await supabaseAdmin
          .from("users")
          .select("role, account_status")
          .eq("id", user.id)
          .single();
        
        if (dbUser) {
          const userRole = normalizeRole(dbUser.role);
          const redirectPath = authConfig.redirects[userRole] || authConfig.redirects.default;
          console.info("MiddlewareHomePageRedirect", {
            userId: user.id,
            userRole,
            redirectTo: redirectPath,
            timestamp: new Date().toISOString(),
          });
          return NextResponse.redirect(new URL(redirectPath, request.url));
        }
      } catch (adminError) {
        // If we can't get user role, continue to normal flow
        console.warn("MiddlewareHomePageRedirectError", adminError);
      }
    }
  } catch (authCheckError) {
    // If auth check fails, continue to normal flow
    console.warn("MiddlewareAuthCheckError", authCheckError);
  }
  
  // Skip for other public routes (only if not authenticated or not home page)
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
    
    // Allow public access to event-types and availability/timeslots when dietitianId or therapistId is provided
    // These routes handle their own authentication logic
    if (pathname === "/api/event-types" || pathname === "/api/availability/timeslots") {
      const { searchParams } = new URL(request.url);
      const dietitianId = searchParams.get("dietitianId");
      const therapistId = searchParams.get("therapistId");
      // If dietitianId or therapistId is provided, allow public access (for booking flow)
      if (dietitianId || therapistId) {
        return NextResponse.next();
      }
      // Otherwise, continue to auth check below (for private access)
    }
    
    // Otherwise, API routes require authentication - continue to auth check below
  }

  // If we already created supabase client above for home page check, reuse it
  // Otherwise create a new one
  let supabaseForAuth = supabase;
  let responseForAuth = response;
  
  if (!supabaseForAuth) {
    const client = createClient(request);
    supabaseForAuth = client.supabase;
    responseForAuth = client.response;
  }

  try {
    // Get user (more reliable than getSession in middleware)
    // Use the user we already fetched if available, otherwise fetch again
    let authUser = user;
    let authError = null;
    
    if (!authUser) {
      const result = await supabaseForAuth.auth.getUser();
      authUser = result.data.user;
      authError = result.error;
    }
    
    // If no user, redirect to signin
    if (authError || !authUser) {
      console.warn("MiddlewareAuthError", {
        path: pathname,
        error: authError?.message,
        hasUser: !!authUser,
        timestamp: new Date().toISOString(),
      });

      // Redirect to appropriate signin based on route
      let signinPath = "/auth/signin";
      if (pathname.startsWith("/dashboard")) {
        signinPath = "/dietitian-login";
      } else if (pathname.startsWith("/therapist-dashboard")) {
        signinPath = "/therapist-login";
      } else if (pathname.startsWith("/admin")) {
        signinPath = "/admin-login";
      }

      const signinUrl = new URL(signinPath, request.url);
      signinUrl.searchParams.set("callbackUrl", encodeURIComponent(request.url));

      return NextResponse.redirect(signinUrl);
    }
    
    // Create session object from user for compatibility
    const session = { user: authUser };

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

    // Determine target role based on route
    let targetRole: string | null = null;
    if (pathname.startsWith("/dashboard") && !pathname.startsWith("/therapist-dashboard")) {
      targetRole = "DIETITIAN";
    } else if (pathname.startsWith("/therapist-dashboard")) {
      targetRole = "THERAPIST";
    } else if (pathname.startsWith("/user-dashboard")) {
      targetRole = "USER";
    }

    // Look up user by (auth_user_id, role) if we have a target role
    let dbUser = null;
    let userError = null;
    
    if (targetRole) {
      const { data: userByAuthIdRole, error: errorByAuthIdRole } = await supabaseAdmin
        .from("users")
        .select("role, email_verified, account_status, id, auth_user_id")
        .eq("auth_user_id", session.user.id)
        .eq("role", targetRole)
        .maybeSingle();

      if (!errorByAuthIdRole && userByAuthIdRole) {
        dbUser = userByAuthIdRole;
      } else {
        userError = errorByAuthIdRole;
      }
    }

    // Fallback: try by id (for backward compatibility)
    if (!dbUser) {
      const { data: userById, error: errorById } = await supabaseAdmin
        .from("users")
        .select("role, email_verified, account_status, id, auth_user_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!errorById && userById) {
        // If we have a target role and the found user doesn't match, redirect appropriately
        if (targetRole && userById.role !== targetRole) {
          // User exists but with different role - redirect to their dashboard
          const redirectPath = authConfig.redirects[normalizeRole(userById.role)] || "/";
          return NextResponse.redirect(new URL(redirectPath, request.url));
        }
        dbUser = userById;
        
        // Update auth_user_id if not set (backward compatibility)
        if (!dbUser.auth_user_id) {
          await supabaseAdmin
            .from("users")
            .update({ auth_user_id: session.user.id })
            .eq("id", dbUser.id);
        }
      } else {
        userError = errorById;
      }
    }

    if (userError || !dbUser) {
      console.error("MiddlewareUserFetchError", {
        userId: session.user.id,
        targetRole,
        error: userError?.message,
        timestamp: new Date().toISOString(),
      });

      // User doesn't exist in database - redirect to complete profile
      // Check route to determine which enrollment to redirect to
      const enrollmentPath = pathname.startsWith("/therapist-dashboard") 
        ? "/therapist-enrollment" 
        : "/dietitian-enrollment";
      return NextResponse.redirect(new URL(enrollmentPath, request.url));
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
    
    // Special check for therapist dashboard: only THERAPIST role can access
    if (pathname.startsWith("/therapist-dashboard") && userRole !== "THERAPIST") {
      console.warn("MiddlewareTherapistDashboardAccessDenied", {
        userId: session.user.id,
        userRole,
        requestedPath: pathname,
        timestamp: new Date().toISOString(),
      });
      
      // Redirect to appropriate dashboard based on role
      const redirectPath = authConfig.redirects[userRole] || "/";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    
    const allowedRoutes = ROLE_ROUTES[userRole as keyof typeof ROLE_ROUTES] || ROLE_ROUTES.USER;

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
    responseForAuth.headers.set("X-User-ID", session.user.id);
    responseForAuth.headers.set("X-User-Role", userRole);

    // Add cache control for authenticated pages
    if (!pathname.startsWith("/api/")) {
      responseForAuth.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
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

    return responseForAuth;
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
