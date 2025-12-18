import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server/client";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");

  console.log("[Google Calendar Callback] Starting...", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
  });

  if (error) {
    console.error("[Google Calendar Callback] OAuth error from Google:", error);
    return NextResponse.redirect(new URL(`/dashboard/settings/calendars?error=${error}`, request.url));
  }

  if (!code) {
    console.error("[Google Calendar Callback] No code received");
    return NextResponse.redirect(new URL("/dashboard/settings/calendars?error=no_code", request.url));
  }

  try {
    // Check env vars
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[Google Calendar Callback] Missing Google OAuth credentials");
      return NextResponse.redirect(new URL("/dashboard/settings/calendars?error=not_configured", request.url));
    }

    // Use request origin for redirect URI to match what was used in authorize
    const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
    const siteUrl = isLocalhost 
      ? requestUrl.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin);
    
    const redirectUri = `${siteUrl}/api/auth/google/callback`;
    
    console.log("[Google Calendar Callback] Using redirect URI:", redirectUri);

    // Create OAuth2 client with correct redirect URI
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Exchange code for tokens
    console.log("[Google Calendar Callback] Exchanging code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);

    console.log("[Google Calendar Callback] Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    if (!tokens.access_token) {
      throw new Error("No access token received from Google");
    }

    // Refresh token may not be returned if user already granted access before
    // In that case, we need to handle it gracefully
    if (!tokens.refresh_token) {
      console.warn("[Google Calendar Callback] No refresh token received - user may have already granted access");
    }

    // Get user from Supabase session using proper server client
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[Google Calendar Callback] Supabase user check:", {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
    });

    if (userError || !user) {
      console.error("[Google Calendar Callback] No authenticated user");
      return NextResponse.redirect(new URL("/dietitian-login?redirect=/dashboard/settings/calendars", request.url));
    }

    // Calculate expiry (default to 1 hour if not provided)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600000).toISOString();

    // Store tokens in database using admin client
    const supabaseAdmin = createAdminClientServer();
    
    // Check if user already has tokens
    const { data: existingTokens } = await supabaseAdmin
      .from("google_oauth_tokens")
      .select("id, refresh_token")
      .eq("user_id", user.id)
      .single();

    // If no new refresh token but we have an existing one, keep the old refresh token
    const refreshTokenToStore = tokens.refresh_token || existingTokens?.refresh_token;
    
    if (!refreshTokenToStore) {
      console.error("[Google Calendar Callback] No refresh token available (new or existing)");
      return NextResponse.redirect(new URL("/dashboard/settings/calendars?error=no_refresh_token&error_message=Please revoke app access in Google settings and try again", request.url));
    }

    console.log("[Google Calendar Callback] Storing tokens for user:", user.id);
    
    const { error: upsertError } = await supabaseAdmin.from("google_oauth_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: refreshTokenToStore,
        expires_at: expiresAt,
      },
      {
        onConflict: "user_id",
      }
    );

    if (upsertError) {
      console.error("[Google Calendar Callback] Failed to store tokens:", upsertError);
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    console.log("[Google Calendar Callback] Tokens stored successfully");

    // Redirect based on state or default
    const redirectPath = state ? decodeURIComponent(state) : "/dashboard/settings/calendars";
    return NextResponse.redirect(new URL(`${redirectPath}?connected=true`, request.url));
  } catch (error: any) {
    console.error("[Google Calendar Callback] Error:", error?.message || error);
    
    // More specific error messages
    let errorParam = "oauth_failed";
    if (error?.message?.includes("redirect_uri_mismatch")) {
      errorParam = "redirect_uri_mismatch";
    } else if (error?.message?.includes("invalid_grant")) {
      errorParam = "invalid_grant";
    }
    
    return NextResponse.redirect(new URL(`/dashboard/settings/calendars?error=${errorParam}`, request.url));
  }
}
