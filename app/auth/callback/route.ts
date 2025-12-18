import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { authRateLimit } from "@/lib/rate-limit";
import { determineUserRedirect } from "@/lib/utils/determine-user-redirect";
import { getUserRoleWithRetry, normalizeRole } from "@/lib/utils/auth-utils";
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
  // In development (localhost), always use request origin
  // In production, use NEXT_PUBLIC_SITE_URL if available, otherwise use request origin
  // Trim any whitespace to prevent URL parsing errors
  const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
  const siteOrigin = isLocalhost 
    ? requestUrl.origin
    : (process.env.NEXT_PUBLIC_SITE_URL 
        ? new URL(process.env.NEXT_PUBLIC_SITE_URL.trim()).origin 
        : requestUrl.origin);
  const { code, error: oauthError, error_description, source } = Object.fromEntries(requestUrl.searchParams);
  
  // Determine signup_source from source parameter
  // If source is "therapy-signup" or "therapy-login", set signup_source to "therapy"
  const signupSource = (source === "therapy-signup" || source === "therapy-login") ? "therapy" : null;

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
    let supabase;
    let supabaseAdmin;
    
    try {
      supabase = await createClient();
      supabaseAdmin = createAdminClient();
    } catch (clientError: any) {
      console.error("AuthCallbackClientCreationError", {
        error: clientError?.message || "Failed to create Supabase client",
        stack: clientError?.stack,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Failed to initialize authentication client: ${clientError?.message || "Unknown error"}`);
    }

    console.info("AuthCallbackExchangingCode", {
      timestamp: new Date().toISOString(),
      hasCode: !!code,
      codeLength: code?.length || 0,
    });

    // THIS IS THE MAGIC - Exchange code for session
    let session;
    let exchangeError;
    
    try {
      const result = await supabase.auth.exchangeCodeForSession(code);
      session = result.data?.session;
      exchangeError = result.error;
    } catch (exchangeException: any) {
      console.error("AuthCallbackExchangeException", {
        error: exchangeException?.message,
        errorName: exchangeException?.name,
        errorCode: exchangeException?.code || exchangeException?.status,
        stack: exchangeException?.stack,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Code exchange failed: ${exchangeException?.message || "Unknown error"}`);
    }

    if (exchangeError) {
      console.error("AuthCallbackSessionError", {
        error: exchangeError.message,
        errorCode: exchangeError.status || exchangeError.code,
        errorName: exchangeError.name,
        errorDetails: exchangeError,
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
    const cameFromTherapistEnrollment = source === "therapist-enrollment";
    const cameFromPublicBooking = source === "public-booking";
    const cameFromTherapyBooking = source === "therapy-booking";
    const redirectPath = requestUrl.searchParams.get("redirect");
    
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
      .select("id, role, email, name, image, account_status, email_verified, signup_source")
      .eq("id", user.id)
      .single();

    if (!fetchError && fetchedUser) {
      dbUser = fetchedUser;
      
      // If this is admin email and user is not ADMIN, update role to ADMIN
      const shouldBeAdmin = isAdminEmail && dbUser.role !== "ADMIN";
      
      // Update last sign-in for existing user, and role if needed
      // Also update signup_source if logging in from therapy flow and not already set
      const updateData: any = {
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(googleImage && !dbUser.image ? { image: googleImage } : {}),
        ...(shouldBeAdmin ? { role: "ADMIN" } : {}),
      };
      
      // Set signup_source if logging in from therapy flow and user doesn't have it set
      if (signupSource && !dbUser.signup_source) {
        updateData.signup_source = signupSource;
      }
      
      await supabaseAdmin
        .from("users")
        .update(updateData)
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
          signup_source: signupSource,
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
      console.info("AuthCallbackFinalRoleFromDbUser", {
        userId: user.id,
        role: finalRole,
        dbUserRole: dbUser.role,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Last resort: use retry logic to get role
      const { role: retryRole, error: retryError } = await getUserRoleWithRetry(
        supabaseAdmin,
        user.id,
        3,
        500
      );
      finalRole = retryRole || "USER";
      console.info("AuthCallbackFinalRoleFromRetry", {
        userId: user.id,
        role: finalRole,
        retryRole,
        retryError,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Normalize the role to ensure consistency
    finalRole = normalizeRole(finalRole);
    
    console.info("AuthCallbackRoleDetermined", {
      userId: user.id,
      email: user.email,
      finalRole,
      cameFromDietitianLogin,
      cameFromDietitianEnrollment,
      source,
      timestamp: new Date().toISOString(),
    });

    // Handle public booking flow FIRST - redirect back to the public profile page with connected=true
    // This takes precedence over role-based redirects since user is in the middle of booking
    if (cameFromPublicBooking || cameFromTherapyBooking) {
      console.info("AuthCallbackPublicBookingRedirect", {
        userId: user.id,
        email: user.email,
        finalRole,
        redirectPath,
        hasRedirectPath: !!redirectPath,
        source,
        timestamp: new Date().toISOString(),
      });
      
      // If redirectPath is provided, use it; otherwise try to extract from referer or default to a public profile
      let targetPath = redirectPath;
      
      if (!targetPath) {
        // Try to get from referer header as fallback
        const referer = request.headers.get("referer");
        if (referer) {
          try {
            const refererUrl = new URL(referer);
            if (refererUrl.pathname.startsWith('/Dietitian/')) {
              targetPath = refererUrl.pathname;
            } else if (refererUrl.pathname.startsWith('/Therapist/')) {
              targetPath = refererUrl.pathname;
            } else if (refererUrl.pathname.startsWith('/therapy/')) {
              targetPath = refererUrl.pathname;
            }
          } catch (e) {
            console.warn("Could not parse referer URL:", e);
          }
        }
      }
      
      // If we still don't have a path, default based on source
      if (!targetPath) {
        if (cameFromTherapyBooking) {
          targetPath = "/therapy/book-a-call";
        } else {
          // Default for public booking (dietitian)
          targetPath = "/";
        }
      }
      
      // Ensure redirectPath starts with / and is a valid path
      const cleanRedirectPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
      const redirectUrl = new URL(`${cleanRedirectPath}?connected=true`, siteOrigin);
      const response = NextResponse.redirect(redirectUrl);
      response.headers.set("X-Auth-Status", "success");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
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

    // Handle therapist enrollment flow: if user is already THERAPIST, redirect to dashboard
    if (cameFromTherapistEnrollment && finalRole === "THERAPIST") {
      console.info("AuthCallbackTherapistEnrollmentAlreadyEnrolled", {
        userId: user.id,
        role: finalRole,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/therapist-dashboard";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      return response;
    }

    // If came from therapist-enrollment and user is not enrolled (not THERAPIST), redirect back to enrollment with connected=true
    if (cameFromTherapistEnrollment && finalRole !== "THERAPIST") {
      console.info("AuthCallbackTherapistEnrollmentNotEnrolled", {
        userId: user.id,
        role: finalRole,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/therapist-enrollment?connected=true";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
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

    // If came from dietitian-login and user IS a DIETITIAN, redirect to dashboard immediately
    // This prevents race conditions with determineUserRedirect
    if (cameFromDietitianLogin && finalRole === "DIETITIAN") {
      console.info("AuthCallbackDietitianLoginSuccess", {
        userId: user.id,
        role: finalRole,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/dashboard";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    }
    
    // Otherwise, use normal redirect logic (handles DIETITIAN, THERAPIST, ADMIN, and USER roles correctly)
    // If user is DIETITIAN, ensure they go to /dashboard regardless of source
    if (finalRole === "DIETITIAN") {
      console.info("AuthCallbackDietitianDetected", {
        userId: user.id,
        email: user.email,
        finalRole,
        cameFromDietitianLogin,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/dashboard";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    }

    // If user is THERAPIST, ensure they go to /therapist-dashboard regardless of source
    if (finalRole === "THERAPIST") {
      console.info("AuthCallbackTherapistDetected", {
        userId: user.id,
        email: user.email,
        finalRole,
        cameFromTherapistEnrollment,
        source,
        timestamp: new Date().toISOString(),
      });
      const redirectTo = "/therapist-dashboard";
      const response = NextResponse.redirect(new URL(redirectTo, siteOrigin));
      response.headers.set("X-Auth-Status", "success");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      return response;
    }

    const redirectTo = await determineUserRedirect(user.id);

    console.info("AuthCallbackSuccess", {
      userId: user.id,
      email: user.email,
      finalRole,
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
    // Enhanced error logging with more details
    const errorDetails = {
      error: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : typeof error,
      errorCode: error?.code || error?.status || error?.error_code,
      errorMessage: error?.msg || error?.message,
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : "No error object",
      timestamp: new Date().toISOString(),
      url: requestUrl.toString(),
      hasCode: !!code,
      codeLength: code?.length || 0,
    };

    console.error("AuthCallbackFatalError", errorDetails);

    // Check if this is a Supabase error with specific error codes
    if (error?.code || error?.status) {
      console.error("AuthCallbackSupabaseError", {
        code: error.code || error.status,
        message: error.message || error.msg,
        details: error.details,
        hint: error.hint,
      });
    }

    // Redirect to error page with sanitized error
    const errorUrl = new URL("/auth/error", siteOrigin);
    errorUrl.searchParams.set("type", "callback_error");
    
    // Add error code if available for better debugging
    if (error?.code || error?.status) {
      errorUrl.searchParams.set("code", String(error.code || error.status));
    }

    const response = NextResponse.redirect(errorUrl);
    response.cookies.set({
      name: "auth_error",
      value: JSON.stringify({
        message: "Authentication failed",
        errorCode: error?.code || error?.status,
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
