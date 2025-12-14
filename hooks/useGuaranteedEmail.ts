/**
 * Hook for managing email state with guaranteed fallback to authenticated session
 * Automatically fetches email from session if other sources are unavailable
 */

import { useState, useEffect } from "react";
import { getGuaranteedEmail, getEmailFromSession } from "@/lib/email-utils";

interface UseGuaranteedEmailOptions {
  formEmail?: string;
  profileEmail?: string | null;
  sessionEmail?: string | null;
  autoFetch?: boolean; // Automatically fetch from session if email is missing
}

export function useGuaranteedEmail({
  formEmail,
  profileEmail,
  sessionEmail,
  autoFetch = true,
}: UseGuaranteedEmailOptions) {
  const [guaranteedEmail, setGuaranteedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update email when sources change
  useEffect(() => {
    const updateEmail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const email = await getGuaranteedEmail(formEmail, profileEmail, sessionEmail);
        setGuaranteedEmail(email);
      } catch (err) {
        console.error("Error getting guaranteed email:", err);
        setError(err instanceof Error ? err.message : "Failed to get email");
        setGuaranteedEmail(null);
      } finally {
        setIsLoading(false);
      }
    };

    updateEmail();
  }, [formEmail, profileEmail, sessionEmail, autoFetch]);

  // Manually fetch email from session
  const fetchFromSession = async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const email = await getEmailFromSession();
      if (email) {
        setGuaranteedEmail(email);
      }
      return email;
    } catch (err) {
      console.error("Error fetching email from session:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch email from session");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email: guaranteedEmail,
    isLoading,
    error,
    fetchFromSession,
  };
}
