/**
 * Email utility functions for guaranteed email retrieval
 * Provides a single source of truth for email with guaranteed fallback to authenticated session
 */

import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Get email from authenticated session
 * This is the ultimate fallback - if user is authenticated, they should have an email
 */
export async function getEmailFromSession(): Promise<string | null> {
  try {
    const supabase = createBrowserClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error fetching session for email:", error);
      return null;
    }
    
    return session?.user?.email || null;
  } catch (err) {
    console.error("Error in getEmailFromSession:", err);
    return null;
  }
}

/**
 * Get email with priority order
 * Priority: formEmail > profileEmail > sessionEmail
 */
export function getEmailPriority(
  formEmail?: string,
  profileEmail?: string | null,
  sessionEmail?: string | null
): string | null {
  return formEmail || profileEmail || sessionEmail || null;
}

/**
 * Get guaranteed email - always returns an email if user is authenticated
 * Fetches from session if other sources are empty
 */
export async function getGuaranteedEmail(
  formEmail?: string,
  profileEmail?: string | null,
  sessionEmail?: string | null
): Promise<string | null> {
  // First, try priority order
  const priorityEmail = getEmailPriority(formEmail, profileEmail, sessionEmail);
  
  if (priorityEmail) {
    return priorityEmail;
  }
  
  // If no email from priority sources, fetch from session as ultimate fallback
  const sessionEmailValue = await getEmailFromSession();
  return sessionEmailValue;
}

/**
 * Validate email exists and is not empty
 */
export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().length > 0;
}
