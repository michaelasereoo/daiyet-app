import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  try {
    // Check if Google OAuth credentials are configured
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[Google Calendar Authorize] Missing credentials:", {
        hasClientId: !!GOOGLE_CLIENT_ID,
        hasClientSecret: !!GOOGLE_CLIENT_SECRET,
      });
      
      // Redirect back to calendars page with error
      const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard/settings/calendars";
      const errorUrl = new URL(redirectUrl, request.url);
      errorUrl.searchParams.set("error", "not_configured");
      errorUrl.searchParams.set("error_message", "Google Calendar integration is not configured. Please contact support.");
      
      return NextResponse.redirect(errorUrl);
    }

    // Use request origin for localhost, NEXT_PUBLIC_SITE_URL for production
    const requestUrl = new URL(request.url);
    const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
    const siteUrl = isLocalhost 
      ? requestUrl.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin);
    
    const callbackUrl = `${siteUrl}/api/auth/google/callback`;

    console.log("[Google Calendar Authorize] Using callback URL:", callbackUrl);
    
    // Create OAuth2 client with the correct redirect URI
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      callbackUrl
    );
    
    // Request scopes for Google Calendar API
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard/settings/calendars";

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent to get refresh token
      state: redirectUrl,
    });

    console.log("[Google Calendar Authorize] Redirecting to Google...");

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[Google Calendar Authorize] Error:", error);
    const errorMessage = error?.message || "Unknown error";
    
    // Redirect back to calendars page with error
    const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard/settings/calendars";
    const errorUrl = new URL(redirectUrl, request.url);
    errorUrl.searchParams.set("error", "auth_failed");
    errorUrl.searchParams.set("error_message", errorMessage.includes("not configured") 
      ? "Google Calendar integration is not configured. Please contact support."
      : "Failed to connect Google Calendar. Please try again.");
    
    return NextResponse.redirect(errorUrl);
  }
}
