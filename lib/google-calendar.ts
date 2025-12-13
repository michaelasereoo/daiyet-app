import { google } from "googleapis";
import { createAdminClientServer } from "./supabase/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/google/callback`
  );
}

async function getOrRefreshToken(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const supabaseAdmin = createAdminClientServer();
  
  // Get stored tokens from database
  const { data: tokenData, error } = await supabaseAdmin
    .from("google_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    throw new Error("Google OAuth tokens not found for user. Please connect your Google Calendar in settings.");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  });

  // Check if token is expired
  if (new Date(tokenData.expires_at) <= new Date()) {
    // Refresh the token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update stored tokens
    await supabaseAdmin
      .from("google_oauth_tokens")
      .update({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokenData.refresh_token,
        expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      })
      .eq("user_id", userId);

    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || tokenData.refresh_token,
    };
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
  };
}

/**
 * Creates a minimal Google Calendar event solely to generate a Google Meet link.
 * This function creates a minimal event (no attendees) to avoid full calendar integration
 * and potential timezone issues with availability syncing.
 * 
 * @param dietitianId - The ID of the dietitian (user who owns the Google Calendar)
 * @param eventDetails - Minimal event details (title, start/end times)
 * @returns The Google Meet link string
 */
export async function createGoogleMeetLinkOnly(
  dietitianId: string,
  eventDetails: {
    summary: string;
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
  }
): Promise<string> {
  const { accessToken, refreshToken } = await getOrRefreshToken(dietitianId);
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Create minimal event - just enough to get a Meet link
  const event = {
    summary: eventDetails.summary,
    start: {
      dateTime: eventDetails.startTime,
      timeZone: "Africa/Lagos",
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: "Africa/Lagos",
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
    // No attendees - minimal calendar sync
    // No description - minimal event
  };

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: 1,
    });

    const meetLink =
      response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === "video"
      )?.uri || "";

    if (!meetLink) {
      throw new Error("Failed to create Google Meet link");
    }

    return meetLink;
  } catch (error) {
    console.error("Error creating Google Meet link:", error);
    throw error;
  }
}

/**
 * Creates a full Google Calendar event with Google Meet link and attendees.
 * Use this for full calendar integration. For Meet links only, use createGoogleMeetLinkOnly.
 * 
 * @deprecated For Meet links only, use createGoogleMeetLinkOnly to avoid calendar sync issues
 */
export async function createCalendarEventWithMeet(
  dietitianId: string,
  eventDetails: {
    summary: string;
    description?: string;
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
    attendeeEmails?: string[];
  }
): Promise<{ meetLink: string; eventId: string }> {
  const { accessToken, refreshToken } = await getOrRefreshToken(dietitianId);
  
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const event = {
    summary: eventDetails.summary,
    description: eventDetails.description || "",
    start: {
      dateTime: eventDetails.startTime,
      timeZone: "Africa/Lagos",
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: "Africa/Lagos",
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
    attendees: eventDetails.attendeeEmails?.map((email) => ({ email })) || [],
  };

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: 1,
    });

    const meetLink =
      response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === "video"
      )?.uri || "";

    if (!meetLink) {
      throw new Error("Failed to create Google Meet link");
    }

    return {
      meetLink,
      eventId: response.data.id || "",
    };
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}
