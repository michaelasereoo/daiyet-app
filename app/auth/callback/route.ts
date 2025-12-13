import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { authRateLimit } from "@/lib/rate-limit";
import { determineUserRedirect } from "@/lib/utils/determine-user-redirect";
import { getUserRoleWithRetry } from "@/lib/utils/auth-utils";
import { ADMIN_EMAIL } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/**
 * OAuth Callback Handler - SIMPLIFIED VERSION
 * 
 * Flow:
 * 1. Handle OAuth errors FIRST
 * 2. Check for authorization code
 * 3. Exchange code for session
 * 4. Get/create user in database
 * 5. Redirect based on role/status
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  // Use NEXT_PUBLIC_SITE_URL if available (for production), otherwise use request origin
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL 
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin 
    : requestUrl.origin;
  const { code, error: oauthError, error_description } = Object.fromEntries(requestUrl.searchParams);

  // STEP 1: Handle OAuth errors FIRST
  if (oauthError) {
    console.error("AuthCallbackOAuthError", {
      error: oauthError,
      description: error_description,
      timestamp: new Date().toISOString(),
      url: requestUrl.toString(),
    });

    return NextResponse.redirect(
      new URL(
        `/auth/error?code=${oauthError}&desc=${encodeURIComponent(error_description || "")}`,
        siteOrigin
      )
    );
  }

  // STEP 2: NO CODE = REDIRECT TO LOGIN
  if (!code) {
    console.error("AuthCallbackMissingCode", {
      requestUrl: requestUrl.toString(),
      timestamp: new Date().toISOString(),
    });
    return NextResponse.redirect(new URL("/auth/signin", siteOrigin));
  }

  try {
    // Rate limiting
    try {
      await authRateLimit.check(request, 10, "AUTH_CALLBACK");
    } catch (rateLimitError) {
      console.warn("AuthCallbackRateLimit", {
        ip: request.headers.get("x-forwarded-for"),
        timestamp: new Date().toISOString(),
      });
      return NextResponse.redirect(
        new URL("/auth/error?type=rate_limit", siteOrigin)
      );
    }

    // STEP 3: Create Supabase client and exchange code for session
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    console.info("AuthCallbackExchangingCode", {
      timestamp: new Date().toISOString(),
      hasCode: !!code,
    });

    // THIS IS THE MAGIC - Exchange code for session
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("AuthCallbackSessionError", {
        error: exchangeError.message,
        errorCode: exchangeError.status,
        timestamp: new Date().toISOString(),
      });
      throw exchangeError;
    }

    if (!session?.user) {
      console.error("AuthCallbackNoSession", {
        timestamp: new Date().toISOString(),
      });
      throw new Error("No session or user after code exchange");
    }

    const user = session.user;
    const userMetadata = user.user_metadata;

    console.info("AuthCallbackUserAuthenticated", {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    // STEP 4: Check source parameter early to determine if this is a dietitian login or enrollment
    const source = requestUrl.searchParams.get("source");
    const cameFromDietitianLogin = source === "dietitian-login";
    const cameFromDietitianEnrollment = source === "dietitian-enrollment";
    
    // Check if this is the admin email
    const isAdminEmail = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // STEP 5: Get or create user in database with retry logic for role fetching
    const googleImage = userMetadata?.avatar_url || userMetadata?.picture || userMetadata?.image || null;
    let dbUser = null;
    let createdUser = null;

    // First, try to get existing user with retry logic (handles race conditions)
    const { role: existingRole, error: roleError } = await getUserRoleWithRetry(
      supabaseAdmin,
      user.id,
      3,
      500
    );

    // Fetch full user data - try regardless of role fetch result to handle all cases
    const { data: fetchedUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, role, email, name, image, account_status, email_verified")
      .eq("id", user.id)
      .single();

    if (!fetchError && fetchedUser) {
      dbUser = fetchedUser;
      
      // If this is admin email and user is not ADMIN, update role to ADMIN
      const shouldBeAdmin = isAdminEmail && dbUser.role !== "ADMIN";
      
      // Update last sign-in for existing user, and role if needed
      await supabaseAdmin
        .from("users")
        .update({
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(googleImage && !dbUser.image ? { image: googleImage } : {}),
          ...(shouldBeAdmin ? { role: "ADMIN" } : {}),
        })
        .eq("id", user.id);
      
      // Update dbUser if role was changed
      if (shouldBeAdmin) {
        dbUser = { ...dbUser, role: "ADMIN" };
      }

      console.info("AuthCallbackUserUpdated", {
        userId: user.id,
        role: dbUser.role,
        isAdminEmail,
        timestamp: new Date().toISOString(),
      });
    } else if (fetchError?.code === "PGRST116" || roleError === "User role not found") {
      // User doesn't exist - will create below
      console.info("AuthCallbackUserNotFound", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    } else if (fetchError || roleError) {
      // Other error - log but continue
      console.warn("AuthCallbackUserFetchError", {
        fetchError: fetchError?.message,
        roleError: roleError,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    }

    // If user doesn't exist, create new user
    if (!dbUser) {
      // Determine initial role based on email (admin) or login source (default to USER)
      // Admin email always gets ADMIN role, others start as USER (enrollment will upgrade to DIETITIAN)
      const initialRole = isAdminEmail ? "ADMIN" : "USER";
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          id: user.id,
          email: user.email!,
          name: userMetadata?.name || userMetadata?.full_name || user.email!.split("@")[0],
          image: googleImage,
          role: initialRole,
          account_status: "ACTIVE",
          email_verified: user.email_confirmed_at || null,
          last_sign_in_at: new Date().toISOString(),
          metadata: {
            provider: userMetadata?.provider || "google",
            provider_id: userMetadata?.provider_id,
          },
        })
        .select()
        .single();

      if (createError) {
        // If insert fails (e.g., race condition), try to fetch again with retry
        if (createError.code === "23505") {
          // Unique constraint violation - user was created by another request
          const { role: retryRole } = await getUserRoleWithRetry(
            supabaseAdmin,
            user.id,
            3,
            500
          );

          if (retryRole) {
            // User exists now - fetch full data and continue
            const { data: existingUser } = await supabaseAdmin
              .from("users")
              .select("id, role, account_status")
              .eq("id", user.id)
              .single();

            if (existingUser) {
              dbUser = existingUser;
            }
          }
        } else {
          console.error("AuthCallbackCreateUserError", {
            error: createError,
            userId: user.id,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (newUser) {
        createdUser = newUser;
        dbUser = newUser;
        console.info("AuthCallbackUserCreated", {
          userId: newUser.id,
          role: newUser.role,
          source: cameFromDietitianLogin ? "dietitian-login" : "regular",
          timestamp: new Date().toISOString(),
        });
      }
    }

    // STEP 6: Determine redirect path
    // Get final user role (use retry logic if we don't have it yet)
    let finalRole: string | null = null;
    
    if (dbUser?.role) {
      finalRole = dbUser.role;
    } else {
      // Last resort: use retry logic to get role
      const { role: retryRole } = await getUserRoleWithRetry(
        supabaseAdmin,
        user.id,
        3,
        500
      );
      finalRole = retryRole || "USER";
    }

    // Handle dietitian enrollment flow: if user is already DIETITIAN, redirect to dashboard
    if (cameFromDietitianEnrollment && finalRole === "DIETITIAN") {
      console.info("AuthCallbackDietitianEnrollmentAlreadyEnrolled", {
        userId: user.id,
        role: finalRole,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/dashboard";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      return response;
    }

    // If came from dietitian-login and user is not enrolled (not DIETITIAN), redirect to enrollment
    if (cameFromDietitianLogin && finalRole !== "DIETITIAN") {
      console.info("AuthCallbackDietitianLoginNotEnrolled", {
        userId: user.id,
        role: finalRole,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/dietitian-enrollment";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      return response;
    }
    
    // Otherwise, use normal redirect logic (handles DIETITIAN, ADMIN, and USER roles correctly)
    const redirectTo = await determineUserRedirect(user.id);

    console.info("AuthCallbackSuccess", {
      userId: user.id,
      email: user.email,
      redirectTo,
      timestamp: new Date().toISOString(),
    });

    // Audit log successful sign-in
    try {
      await supabaseAdmin.from("auth_audit_log").insert({
        user_id: user.id,
        action: "signin",
        provider: "google",
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent"),
        success: true,
        metadata: {
          email: user.email,
          redirect_to: redirectTo,
        },
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.warn("AuthCallbackAuditLogError", logError);
    }

    // Create response with security headers
    const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
    
    // Security headers
    response.headers.set("X-Auth-Status", "success");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;

  } catch (error: any) {
    console.error("AuthCallbackFatalError", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      url: requestUrl.toString(),
    });

    // Redirect to error page with sanitized error
    const errorUrl = new URL("/auth/error", siteOrigin);
    errorUrl.searchParams.set("type", "callback_error");

    const response = NextResponse.redirect(errorUrl);
    response.cookies.set({
      name: "auth_error",
      value: JSON.stringify({
        message: "Authentication failed",
        timestamp: new Date().toISOString(),
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60,
    });

    return response;
  }
}
