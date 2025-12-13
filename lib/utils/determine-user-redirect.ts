import { createAdminClient } from "@/lib/supabase/server/admin";
import { getRedirectPathForRole, getAccountStatusRedirect, normalizeRole, getUserRoleWithRetry } from "./auth-utils";

/**
 * Determine where to redirect user after authentication
 * Handles role-based redirects and account status checks
 * Uses retry logic to handle race conditions
 */
export async function determineUserRedirect(userId: string): Promise<string> {
  try {
    const supabaseAdmin = createAdminClient();

    // Use retry logic to get user role (handles race conditions)
    const { role: userRole, error: roleError } = await getUserRoleWithRetry(
      supabaseAdmin,
      userId,
      3,
      500
    );

    if (roleError === "User role not found") {
      // User doesn't exist in database - redirect to enrollment
      console.info("DetermineRedirectUserNotFound", {
        userId,
        timestamp: new Date().toISOString(),
      });
      return "/dietitian-enrollment";
    }

    if (roleError || !userRole) {
      console.error("Error fetching user role for redirect:", roleError);
      return "/";
    }

    // Fetch full user data to check account status
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status")
      .eq("id", userId)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      // Error other than "not found" - log but use role we already have
      console.warn("Error fetching user details for redirect:", dbError);
    }

    // Check account status if we have user data
    if (dbUser) {
      const accountStatus = dbUser.account_status || "ACTIVE";
      const statusRedirect = getAccountStatusRedirect(accountStatus);

      if (statusRedirect) {
        return statusRedirect;
      }
    }

    // Get role-based redirect using the role we fetched with retry
    const normalizedRole = normalizeRole(userRole);
    return getRedirectPathForRole(normalizedRole);
  } catch (error) {
    console.error("Error determining user redirect:", error);
    return "/";
  }
}

