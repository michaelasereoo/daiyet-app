import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOAuth2Client } from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server/client";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard/settings/calendars?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/settings/calendars?error=no_code", request.url));
  }

  try {
    // Exchange code for tokens (for Google Calendar API)
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to get tokens from Google");
    }

    // Get user from Supabase session using proper server client
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      // If no session, redirect to login
      return NextResponse.redirect(new URL("/dietitian-login?redirect=/dashboard/settings/calendars", request.url));
    }

    // Calculate expiry (default to 1 hour if not provided)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600000).toISOString();

    // Store tokens in database
    await supabaseAdmin.from("google_oauth_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      },
      {
        onConflict: "user_id",
      }
    );

    // Redirect based on state or default
    const redirectPath = state ? decodeURIComponent(state) : "/dashboard/settings/calendars";
    return NextResponse.redirect(new URL(`${redirectPath}?connected=true`, request.url));
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    return NextResponse.redirect(new URL("/dashboard/settings/calendars?error=oauth_failed", request.url));
  }
}
