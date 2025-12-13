import { authConfig } from "@/lib/auth/config";
import type { UserRole, AccountStatus, AppUser } from "@/lib/auth/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export types for backward compatibility
export type { UserRole, AccountStatus } from "@/lib/auth/types";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  account_status?: AccountStatus | string;
  email_verified?: boolean | string | null;
}

/**
 * Normalize role string to ensure consistency
 */
export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role) return "USER";
  const normalized = String(role).toUpperCase().trim();
  if (normalized === "DIETITIAN" || normalized === "ADMIN") {
    return normalized as UserRole;
  }
  return "USER";
}

/**
 * Determine redirect path based on user role
 */
export function getRedirectPathForRole(role: UserRole | string | null | undefined): string {
  const normalizedRole = normalizeRole(role);
  return authConfig.redirects[normalizedRole] || authConfig.redirects.default;
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string | null | undefined, requiredRole: UserRole): boolean {
  return normalizeRole(userRole) === requiredRole;
}

/**
 * Check if user can access route based on role
 */
export function canAccessRoute(userRole: string | null | undefined, allowedRoles: UserRole[]): boolean {
  const normalizedRole = normalizeRole(userRole);
  return allowedRoles.includes(normalizedRole);
}

/**
 * Validate account status
 */
export function isAccountActive(accountStatus: string | null | undefined): boolean {
  return accountStatus === "ACTIVE";
}

/**
 * Check if user should be redirected based on account status
 */
export function getAccountStatusRedirect(
  accountStatus: AccountStatus | string | null | undefined
): string | null {
  if (!accountStatus || accountStatus === "ACTIVE") {
    return null;
  }

  switch (accountStatus.toUpperCase()) {
    case "SUSPENDED":
      return "/account-suspended";
    case "PENDING_VERIFICATION":
      return "/verify-email";
    case "PENDING_ENROLLMENT":
      return "/dietitian-enrollment";
    case "DELETED":
      return "/account-deleted";
    default:
      return null;
  }
}

/**
 * Validate session and return user profile
 */
export async function validateSession(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ user: UserProfile | null; error: string | null }> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, email, role, account_status, email_verified")
      .eq("id", userId)
      .single();

    if (error) {
      return { user: null, error: error.message };
    }

    if (!user) {
      return { user: null, error: "User not found" };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: normalizeRole(user.role),
        account_status: user.account_status,
        email_verified: user.email_verified,
      },
      error: null,
    };
  } catch (error: any) {
    return { user: null, error: error.message || "Validation failed" };
  }
}

/**
 * Get user role with retry logic
 * Useful for handling race conditions when user is just created
 */
export async function getUserRoleWithRetry(
  supabaseAdmin: SupabaseClient,
  userId: string,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<{ role: UserRole | null; error: string | null }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: user, error } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" - retry might help
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        return { role: null, error: error.message };
      }

      if (user?.role) {
        return { role: normalizeRole(user.role), error: null };
      }

      // User not found - retry might help if user was just created
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      return { role: null, error: "User role not found" };
    } catch (error: any) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      return { role: null, error: error.message || "Failed to fetch role" };
    }
  }

  return { role: null, error: "Max retries exceeded" };
}
