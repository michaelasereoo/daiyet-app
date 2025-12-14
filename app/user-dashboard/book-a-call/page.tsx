import { createClient } from "@/lib/supabase/server/client";
import BookACallPageContentWrapper from "./BookACallClient";

export default async function BookACallPage() {
  // Server-side: Fetch user profile securely from Supabase session
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  let initialUserProfile: { name: string; email: string; image?: string | null } | null = null;

  if (!sessionError && session?.user) {
    // Extract name and email from Google auth metadata (server-side - secure)
    const extractedSessionName =
      session.user.user_metadata?.name ||
      session.user.user_metadata?.full_name ||
      "";
    
    // CRITICAL: session.user.email is the primary source for Google OAuth users
    // This should ALWAYS be available for authenticated users
    const sessionEmail = session.user.email;

    // Get Google auth image
    const googleImage =
      session.user.user_metadata?.avatar_url ||
      session.user.user_metadata?.picture ||
      session.user.user_metadata?.image ||
      null;

    // Try to fetch from database for more complete profile
    try {
      const { data: dbUser } = await supabase
        .from("users")
        .select("name, email, image, role")
        .eq("id", session.user.id)
        .single();

      if (dbUser) {
        const profileImage = dbUser.role === "DIETITIAN"
          ? (dbUser.image || googleImage)
          : (googleImage || dbUser.image);

        // Priority for email: session email (most reliable) > db email > empty
        // Session email from Google OAuth should always be valid
        const finalEmail = sessionEmail || dbUser.email || "";

        initialUserProfile = {
          name: dbUser.name || extractedSessionName || "User",
          email: finalEmail,
          image: profileImage || null,
        };
      } else {
        // Fallback to Google auth data
        initialUserProfile = {
          name: extractedSessionName || "User",
          email: sessionEmail || "",
          image: googleImage,
        };
      }
    } catch (err) {
      console.error("Error fetching user from database:", err);
      // Fallback to Google auth data
      initialUserProfile = {
        name: extractedSessionName || "User",
        email: sessionEmail || "",
        image: googleImage,
      };
    }
  }

  return <BookACallPageContentWrapper initialUserProfile={initialUserProfile} />;
}
