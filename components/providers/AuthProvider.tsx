"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { normalizeRole, type UserRole } from "@/lib/utils/auth-utils";

export interface UserProfile {
  name: string | null;
  image: string | null;
}

type AuthContextType = {
  supabase: ReturnType<typeof createBrowserClient>;
  user: User | null;
  role: UserRole | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setProfileDirect: (profile: UserProfile | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialProfile?: UserProfile | null;
}

export function AuthProvider({ children, initialProfile }: AuthProviderProps) {
  // Use singleton browser client to prevent multiple instances
  // Handle SSR gracefully - only create client in browser
  const [supabase] = useState<ReturnType<typeof createBrowserClient> | null>(() => {
    if (typeof window === 'undefined') {
      // During SSR, return null - will be created on client side
      return null;
    }
    return createBrowserClient(); // Will return singleton instance
  });
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  
  // Initialize profile from props, localStorage, or null
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (initialProfile) return initialProfile;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user_profile');
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.warn("AuthProvider: Error loading profile from localStorage", error);
        localStorage.removeItem('user_profile');
      }
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Sync profile from initialProfile prop
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_profile', JSON.stringify(initialProfile));
      }
    }
  }, [initialProfile]);

  useEffect(() => {
    // Skip if no supabase client (SSR)
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Get session - don't use timeout race, let it complete naturally
        // The onAuthStateChange listener will handle updates anyway
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("AuthProviderInitError", error);
          // Loading will be set to false by onAuthStateChange INITIAL_SESSION
          return;
        }

        if (session?.user) {
          setUser(session.user);

          // Fetch user role and profile - with better error handling (no timeout race)
          try {
            const { data: userData, error: roleError } = await supabase
              .from("users")
              .select("role, name, image")
              .eq("id", session.user.id)
              .single();

            if (roleError) {
              console.warn("AuthProviderRoleFetchWarning", {
                error: roleError.message,
                code: roleError.code,
                userId: session.user.id,
              });
              // Continue without role - will be fetched later via onAuthStateChange
              setRole(null);
            } else {
              const normalizedRole = userData?.role ? normalizeRole(userData.role) : null;
              console.log("InitializeAuth: Role fetched", {
                userId: session.user.id,
                role: normalizedRole,
              });
              setRole(normalizedRole);
              
              // Set profile if we got it and don't already have initialProfile
              if (!initialProfile && userData) {
                const newProfile: UserProfile = {
                  name: userData.name || null,
                  image: userData.image || null,
                };
                setProfile(newProfile);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('user_profile', JSON.stringify(newProfile));
                }
              }
            }
          } catch (roleError: any) {
            console.warn("AuthProviderRoleFetchException", {
              error: roleError?.message || "Unknown error",
              userId: session.user.id,
            });
            // Continue without role - will be fetched later
            setRole(null);
          }
        } else {
          // No session - user is not logged in
          console.log("InitializeAuth: No session found");
          setUser(null);
          setRole(null);
          setProfile(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user_profile');
          }
        }
      } catch (error: any) {
        // Only log unexpected errors, don't fail the entire auth initialization
        console.error("AuthProviderError", {
          error: error?.message || "Unknown error",
          stack: error?.stack,
        });
        // Set loading to false and continue - user might still be able to use the app
        setUser(null);
        setRole(null);
      } finally {
        // Don't set loading here - let onAuthStateChange INITIAL_SESSION handle it
        // This prevents race conditions
        console.log("AuthProvider: initializeAuth completed (loading will be set by onAuthStateChange)");
      }
    };

    // Initialize auth first - this will set user/role from getSession()
    initializeAuth();

    // Listen for auth changes - this will also handle initial session
    // and updates even if the manual getSession() call fails
    let subscription: any = null;
    
    try {
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
      const userId = session?.user?.id;
      
      // Improved logging with context
      if (event === "INITIAL_SESSION") {
        if (userId) {
          console.log("AuthStateChange INITIAL_SESSION", { 
            event, 
            userId,
            email: session.user.email,
            status: "Session found - will set loading to false"
          });
        } else {
          console.log("AuthStateChange INITIAL_SESSION", { 
            event, 
            userId: undefined,
            status: "No active session (user not logged in) - will set loading to false"
          });
        }
      } else {
        console.log("AuthStateChange", { 
          event, 
          userId: userId || undefined,
          email: session?.user?.email,
        });
      }

      // Update user state immediately
      setUser(session?.user || null);

      if (session?.user) {
        // Fetch updated role and profile
        try {
          const { data: userData, error: roleError } = await supabase
            .from("users")
            .select("role, name, image")
            .eq("id", session.user.id)
            .single();

          if (roleError) {
            console.warn("AuthStateChangeRoleFetchWarning", {
              event,
              error: roleError.message,
              code: roleError.code,
              userId: session.user.id,
            });
            // If user record doesn't exist (PGRST116), set role to null
            // This allows the UI to handle "user needs enrollment" state
            if (roleError.code === "PGRST116") {
              console.log("User record not found in database - user needs enrollment");
              setRole(null);
              setProfile(null);
              if (typeof window !== 'undefined') {
                localStorage.removeItem('user_profile');
              }
            } else {
              // For other errors, don't clear role if we already have one
              // But log it for debugging
              console.warn("Role fetch failed but keeping existing role if available", roleError);
            }
          } else {
            const normalizedRole = userData?.role ? normalizeRole(userData.role) : null;
            console.log("Role fetched successfully", {
              event,
              userId: session.user.id,
              role: normalizedRole,
              rawRole: userData?.role,
            });
            setRole(normalizedRole);
            
            // Update profile
            const newProfile: UserProfile = {
              name: userData.name || null,
              image: userData.image || null,
            };
            setProfile(newProfile);
            if (typeof window !== 'undefined') {
              localStorage.setItem('user_profile', JSON.stringify(newProfile));
            }
          }

          // Handle specific events
          if (event === "SIGNED_IN") {
            // Set loading to false after sign-in completes
            setIsLoading(false);
            // Small delay to ensure cookies are set and state is updated
            setTimeout(() => {
              router.refresh();
            }, 100);
          }
        } catch (error: any) {
          console.error("AuthStateChangeRoleFetchException", {
            event,
            error: error?.message || "Unknown error",
            userId: session.user.id,
          });
          // Set role to null on exception
          setRole(null);
          // Still set loading to false so UI can render
          if (event === "SIGNED_IN") {
            setIsLoading(false);
          }
        }
      } else {
        // No session - clear role, user, and profile
        setRole(null);
        setProfile(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user_profile');
        }
        
        // Handle specific events when no session
        if (event === "SIGNED_OUT") {
          setIsLoading(false);
          // Don't redirect if on enrollment page - allow user to reconnect
          if (pathname !== "/dietitian-enrollment") {
            router.push("/");
          }
        }
        // INITIAL_SESSION with no user is normal - user just isn't logged in
        if (event === "INITIAL_SESSION") {
          // Always set loading to false on INITIAL_SESSION event
          setIsLoading(false);
        }
      }
      
      // For non-INITIAL_SESSION events, set loading to false
      // INITIAL_SESSION is handled above
      if (event !== "INITIAL_SESSION") {
        setIsLoading(false);
      }
    });
      
      subscription = sub;
      console.log("AuthProvider: onAuthStateChange subscription created");
    } catch (error: any) {
      console.error("AuthProvider: Failed to create auth state change listener", error);
      // If subscription fails, still set loading to false after a delay
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }

    // Safety timeout - ensure loading is set to false after max 2 seconds
    // This prevents infinite loading if INITIAL_SESSION doesn't fire
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn("AuthProvider: Safety timeout - INITIAL_SESSION didn't fire, forcing loading to false");
        setIsLoading(false);
      }
    }, 2000);

    return () => {
      clearTimeout(safetyTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [supabase, router, pathname, initialProfile]);

  // Listen for storage events (multi-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_profile') {
        if (e.newValue) {
          try {
            const newProfile = JSON.parse(e.newValue);
            setProfile(newProfile);
            console.log("AuthProvider: Profile synced from another tab", newProfile);
          } catch (error) {
            console.warn("AuthProvider: Error parsing profile from storage event", error);
          }
        } else {
          setProfile(null);
          console.log("AuthProvider: Profile cleared from another tab");
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const refreshProfile = async () => {
    if (!supabase || !user) return;
    
    try {
      const { data: userData, error } = await supabase
        .from("users")
        .select("name, image")
        .eq("id", user.id)
        .single();

      if (error) {
        console.warn("AuthProvider: Error refreshing profile", error);
        return;
      }

      if (userData) {
        const newProfile: UserProfile = {
          name: userData.name || null,
          image: userData.image || null,
        };
        setProfile(newProfile);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user_profile', JSON.stringify(newProfile));
          // Trigger storage event for other tabs
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'user_profile',
            newValue: JSON.stringify(newProfile),
            storageArea: localStorage,
          }));
        }
      }
    } catch (error) {
      console.error("AuthProvider: Exception refreshing profile", error);
    }
  };

  // Set profile directly (for initialization from server-side data, no DB update)
  const setProfileDirect = (newProfile: UserProfile | null) => {
    setProfile(newProfile);
    if (typeof window !== 'undefined') {
      if (newProfile) {
        localStorage.setItem('user_profile', JSON.stringify(newProfile));
      } else {
        localStorage.removeItem('user_profile');
      }
      // Trigger storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'user_profile',
        newValue: newProfile ? JSON.stringify(newProfile) : null,
        storageArea: localStorage,
      }));
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        console.error("AuthProvider: Error updating profile", error);
        throw error;
      }

      // Update local state
      setProfile((prev) => {
        const newProfile = prev ? { ...prev, ...updates } : { name: null, image: null, ...updates };
        setProfileDirect(newProfile);
        return newProfile;
      });
    } catch (error) {
      console.error("AuthProvider: Exception updating profile", error);
      throw error;
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setProfile(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user_profile');
      }
      // Don't redirect if on enrollment page - allow user to reconnect
      if (pathname !== "/dietitian-enrollment") {
        router.push("/");
      }
    } catch (error) {
      console.error("SignOutError", error);
    }
  };

  const refreshSession = async () => {
    if (!supabase) return;
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error) throw error;

      if (session?.user) {
        setUser(session.user);
      }
    } catch (error) {
      console.error("RefreshSessionError", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        supabase,
        user,
        role,
        profile,
        isLoading,
        signOut,
        refreshSession,
        refreshProfile,
        updateProfile,
        setProfileDirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
