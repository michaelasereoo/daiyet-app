import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    // Check if Google OAuth credentials are configured
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("Google OAuth credentials not configured:", {
        hasClientId: !!GOOGLE_CLIENT_ID,
        hasClientSecret: !!GOOGLE_CLIENT_SECRET,
      });
      
      // Redirect back to calendars page with error
      const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard/settings/calendars";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
      const errorUrl = new URL(redirectUrl, siteUrl);
      errorUrl.searchParams.set("error", "not_configured");
      errorUrl.searchParams.set("error_message", "Google Calendar integration is not configured. Please contact support.");
      
      return NextResponse.redirect(errorUrl);
    }

    const oauth2Client = getOAuth2Client();
    
    // Request scopes for Google Calendar API
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard/settings/calendars";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
    const callbackUrl = `${siteUrl}/api/auth/google/callback`;

    console.log("🔗 [DEBUG] OAuth redirect URI:", callbackUrl);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent to get refresh token
      state: redirectUrl,
      // Don't override redirect_uri - use the one from OAuth2Client initialization
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("Error generating auth URL:", error);
    const errorMessage = error?.message || "Unknown error";
    
    // Redirect back to calendars page with error instead of returning JSON
    const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/dashboard/settings/calendars";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || "http://localhost:3000";
    const errorUrl = new URL(redirectUrl, siteUrl);
    errorUrl.searchParams.set("error", "auth_failed");
    errorUrl.searchParams.set("error_message", errorMessage.includes("not configured") 
      ? "Google Calendar integration is not configured. Please contact support."
      : "Failed to connect Google Calendar. Please try again.");
    
    return NextResponse.redirect(errorUrl);
  }
}
