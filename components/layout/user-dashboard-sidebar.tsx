"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  Calendar, 
  Phone,
  FileText,
  Settings, 
  Search,
  User,
  LogOut,
  Menu,
  X
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/user-dashboard", icon: LayoutDashboard },
  { name: "Book a Call", href: "/user-dashboard/book-a-call", icon: Phone },
  { name: "Upcoming Meetings", href: "/user-dashboard/upcoming-meetings", icon: Calendar },
  { name: "Meal Plan", href: "/user-dashboard/meal-plan", icon: FileText },
  { name: "Profile Settings", href: "/user-dashboard/profile-settings", icon: User },
];

interface UserDashboardSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialUserProfile?: { name: string; image: string | null } | null;
}

// Cache key for localStorage
const USER_PROFILE_CACHE_KEY = "user_dashboard_profile";

// Module-level cache - persists across component unmount/remount (same JS module in memory)
// This ensures profile is only fetched once per browser session, not on every navigation
let cachedProfile: { name: string; image: string | null } | null = null;
let hasInitializedThisSession = false;

export function UserDashboardSidebar({ isOpen = false, onClose, initialUserProfile }: UserDashboardSidebarProps) {
  const pathname = usePathname();
  
  // Initialize with module cache first (instant, no flash on navigation)
  // Fall back to initialUserProfile prop if provided
  const [userProfile, setUserProfile] = useState<{ name: string; image: string | null } | null>(
    cachedProfile || initialUserProfile || null
  );
  const [isLoading, setIsLoading] = useState(!cachedProfile && !initialUserProfile);
  const [supabase, setSupabase] = useState<ReturnType<typeof createBrowserClient> | null>(null);

  // Create Supabase client instance only in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const client = createBrowserClient();
        console.log("UserDashboardSidebar: Created supabase client", !!client);
        setSupabase(client);
      } catch (error) {
        console.error("UserDashboardSidebar: Failed to create supabase client", error);
      }
    }
  }, []);

  useEffect(() => {
    // If we already initialized this browser session, use the cached profile and stop
    // This is the key fix - module-level flag persists across component mounts
    if (hasInitializedThisSession) {
      console.log("UserDashboardSidebar: Already initialized this session, using cached profile");
      if (cachedProfile && !userProfile) {
        setUserProfile(cachedProfile);
      }
      setIsLoading(false);
      return;
    }
    
    // If we have initialUserProfile prop, use it immediately
    if (initialUserProfile && !userProfile) {
      console.log("UserDashboardSidebar: Using initialUserProfile from props");
      const profile = { name: initialUserProfile.name, image: initialUserProfile.image };
      cachedProfile = profile;
      hasInitializedThisSession = true;
      setUserProfile(profile);
      setIsLoading(false);
      return;
    }
    
    // Try to load from localStorage on first mount (client-side only)
    if (!cachedProfile && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(USER_PROFILE_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Cache valid for 1 hour
          if (Date.now() - parsed.timestamp < 3600000) {
            console.log("UserDashboardSidebar: Using localStorage cache");
            const profile = { name: parsed.name, image: parsed.image };
            cachedProfile = profile;
            hasInitializedThisSession = true;
            setUserProfile(profile);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }

    if (!supabase) {
      console.log("UserDashboardSidebar: Supabase client not ready yet");
      return;
    }

    console.log("UserDashboardSidebar: Starting profile fetch (first time this session)");

    let mounted = true;

    const fetchUserProfile = async () => {
      setIsLoading(true);
      console.log("UserDashboardSidebar: Starting profile fetch...");
      
      try {
        console.log("UserDashboardSidebar: Entered try block");
        
        // Try getSession() first since it's faster (reads from cookies)
        // If that fails or times out, try getUser()
        let sessionUser = null;
        let authError = null;
        
        console.log("UserDashboardSidebar: About to call getSession()...");
        try {
          console.log("UserDashboardSidebar: Calling getSession() with timeout...");
          // Increased timeout to 5 seconds for slower connections
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("getSession timeout")), 5000))
          ]) as any;
          
          if (sessionResult?.data?.session?.user) {
            sessionUser = sessionResult.data.session.user;
            console.log("UserDashboardSidebar: getSession() succeeded", {
              userId: sessionUser.id,
              email: sessionUser.email,
            });
          } else {
            console.log("UserDashboardSidebar: getSession() returned no user, trying getUser()...");
            // Try getUser() as fallback
            // Increased timeout to 5 seconds for slower connections
            const userResult = await Promise.race([
              supabase.auth.getUser(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("getUser timeout")), 5000))
            ]) as any;
            
            if (userResult?.data?.user) {
              sessionUser = userResult.data.user;
              console.log("UserDashboardSidebar: getUser() succeeded", {
                userId: sessionUser.id,
                email: sessionUser.email,
              });
            } else {
              authError = userResult?.error || new Error("No user found");
            }
          }
        } catch (timeoutError: any) {
          console.warn("UserDashboardSidebar: Auth methods timed out, using fallback", timeoutError);
          // Both methods timed out - use initialUserProfile if available, otherwise set default
          if (mounted) {
            const fallbackProfile = initialUserProfile 
              ? { name: initialUserProfile.name, image: initialUserProfile.image }
              : { name: "User", image: null };
            cachedProfile = fallbackProfile;
            hasInitializedThisSession = true;
            setUserProfile(fallbackProfile);
            setIsLoading(false);
          }
          return;
        }
        
        if (!sessionUser || authError) {
          console.warn("UserDashboardSidebar: No user found after all attempts", {
            authError: authError?.message,
            hasSessionUser: !!sessionUser,
          });
          if (mounted) {
            const defaultProfile = { name: "User", image: null };
            cachedProfile = defaultProfile;
            hasInitializedThisSession = true;
            setUserProfile(defaultProfile);
            setIsLoading(false);
          }
          return;
        }

        if (!mounted) {
          return;
        }

        // For users, get image from Google auth metadata first, then fall back to database
        const googleImage = 
          sessionUser.user_metadata?.avatar_url ||
          sessionUser.user_metadata?.picture ||
          sessionUser.user_metadata?.image ||
          null;

        const googleName = 
          sessionUser.user_metadata?.name ||
          sessionUser.user_metadata?.full_name ||
          sessionUser.email?.split("@")[0] ||
          null;

        // Set profile immediately from Google auth metadata (fast, no database query needed)
        // This prevents the "Loading..." state from showing too long
        const quickProfile = {
          name: googleName || sessionUser.email?.split("@")[0] || "User",
          image: googleImage,
        };
        
        console.log("UserDashboardSidebar: Setting quick profile from auth metadata", {
          userId: sessionUser.id,
          name: quickProfile.name,
          hasImage: !!quickProfile.image,
        });
        
        if (mounted) {
          // Update module cache with quick profile
          cachedProfile = quickProfile;
          setUserProfile(quickProfile);
          // Cache to localStorage for page refresh persistence
          try {
            localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify({
              ...quickProfile,
              timestamp: Date.now()
            }));
          } catch (e) {
            // Ignore cache errors
          }
          // Don't stop loading yet - we'll fetch from database and update
        }

        // Get user data from database using the authenticated user's ID
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("name, email, image, role")
          .eq("id", sessionUser.id)
          .single();

        if (userError) {
          console.warn("UserDashboardSidebar: Error fetching user from database", {
            error: userError,
            code: userError.code,
            message: userError.message,
          });
          
          // We already set the profile from Google auth, mark as initialized
          if (mounted) {
            hasInitializedThisSession = true;
            setIsLoading(false);
          }
          return;
        }

        // Update profile with database data if available (prefer database name, but keep Google image for users)
        if (user && mounted) {
          // For regular users, prefer Google image; for dietitians, use uploaded image
          const profileImage = user.role === "DIETITIAN" 
            ? (user.image || googleImage)
            : (googleImage || user?.image);

          // Prefer database name, fallback to Google auth name
          const finalName = user.name || googleName || sessionUser.email?.split("@")[0] || "User";

          const profile = {
            name: finalName,
            image: profileImage,
          };

          console.log("UserDashboardSidebar: Setting final profile from database", {
            name: finalName,
            hasImage: !!profileImage,
            role: user.role,
          });

          // Update module cache - this is the final profile
          cachedProfile = profile;
          hasInitializedThisSession = true;
          setUserProfile(profile);
          setIsLoading(false);
          
          // Cache to localStorage for page refresh persistence
          try {
            localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify({
              ...profile,
              timestamp: Date.now()
            }));
          } catch (e) {
            // Ignore cache errors
          }
        } else if (mounted) {
          hasInitializedThisSession = true;
          setIsLoading(false);
        }
      } catch (error) {
        console.error("UserDashboardSidebar: Error fetching profile", error);
        // Set a default profile on error to ensure loading stops
        if (mounted) {
          const defaultProfile = { name: "User", image: null };
          cachedProfile = defaultProfile;
          hasInitializedThisSession = true;
          setUserProfile(defaultProfile);
          setIsLoading(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserProfile();

    // Safety timeout - force loading to false after 8 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted && !hasInitializedThisSession) {
        const fallbackProfile = initialUserProfile 
          ? { name: initialUserProfile.name, image: initialUserProfile.image }
          : { name: "User", image: null };
        
        console.warn("UserDashboardSidebar: Safety timeout - using fallback profile");
        cachedProfile = fallbackProfile;
        hasInitializedThisSession = true;
        setUserProfile(fallbackProfile);
        setIsLoading(false);
      }
    }, 8000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [supabase, initialUserProfile]); // Run when supabase client is ready

  // Close sidebar when pathname changes on mobile
  useEffect(() => {
    if (onClose && isOpen) {
      // Small delay to allow navigation to start
      const timer = setTimeout(() => {
        onClose();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, isOpen, onClose]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Sidebar - Hidden on mobile, always visible on desktop */}
      <aside
        className={cn(
          "w-64 bg-[#171717] flex flex-col h-screen fixed left-0 top-0 overflow-hidden z-50",
          "hidden lg:flex", // Hide completely on mobile, flex on desktop
          // Desktop mode (when onClose doesn't exist): always visible
          !onClose && "translate-x-0"
        )}
      >
      {/* Top Section with Logo and Search */}
          <div className="p-4 pb-3 flex-shrink-0 relative">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <Image
                  src="/daiyet logo.svg"
                  alt="Daiyet"
                  width={120}
                  height={32}
                  className="h-8 w-auto"
                />
              </Link>
              <button className="text-[#D4D4D4] hover:text-[#f9fafb]">
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

      {/* Divider */}
      <div className="border-t border-[#374151] mx-4"></div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/user-dashboard" && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-md text-[15px] font-medium transition-colors min-h-[48px]",
                isActive
                  ? "bg-[#404040] text-[#f9fafb]"
                  : "text-[#D4D4D4] hover:bg-[#374151] hover:text-[#f9fafb]"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Links */}
      <div className="p-4 border-t border-[#374151] space-y-2 flex-shrink-0">
        {/* Profile with online status */}
        <div className="flex items-center gap-2 pb-2">
          <div className="relative">
            {userProfile?.image ? (
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <Image
                  src={userProfile.image}
                  alt={userProfile.name}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : userProfile ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center">
                <span className="text-white text-xs font-semibold">
                  {getInitials(userProfile.name)}
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center">
                <span className="text-white text-xs font-semibold">U</span>
              </div>
            )}
            {/* Online status indicator */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#171717]"
              style={{ backgroundColor: "#E5FF53" }}
            ></div>
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-[#D4D4D4]">
              {isLoading && !userProfile ? "Loading..." : (userProfile?.name || "User")}
            </div>
          </div>
        </div>
        {/* Refer and earn disabled */}
        <Link
          href="/user-dashboard/settings/profile"
          className="flex items-center gap-2 text-sm text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] transition-colors rounded px-2 py-1"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button className="flex items-center gap-2 text-sm text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] transition-colors w-full rounded px-2 py-1">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#374151] flex-shrink-0">
        <p className="text-xs text-[#D4D4D4]">
          © 2025 Daiyet.com, Inc. v.1.0.0
        </p>
      </div>
    </aside>
    </>
  );
}

/**
 * Mobile Menu Button Component
 */
export function UserDashboardSidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#171717] text-[#D4D4D4] hover:text-[#f9fafb] rounded-md border border-[#374151] hover:bg-[#374151] transition-colors"
      aria-label="Open menu"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}
