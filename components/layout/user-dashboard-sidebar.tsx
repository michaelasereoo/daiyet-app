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
}

export function UserDashboardSidebar({ isOpen = false, onClose }: UserDashboardSidebarProps) {
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<{ name: string; image: string | null } | null>(() => {
    // Initialize from sessionStorage if available (prevents flicker on navigation)
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('userProfile');
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log("UserDashboardSidebar: Loaded profile from sessionStorage", parsed);
          return parsed;
        }
      } catch (error) {
        console.warn("UserDashboardSidebar: Error loading cached profile", error);
        // Clear invalid cache
        sessionStorage.removeItem('userProfile');
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!userProfile);
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
    console.log("UserDashboardSidebar: useEffect triggered", {
      hasUserProfile: !!userProfile,
      hasSupabase: !!supabase,
      isLoading,
    });
    
    // Only fetch if we don't have cached data
    if (userProfile) {
      console.log("UserDashboardSidebar: Already have profile, skipping fetch", userProfile);
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      console.log("UserDashboardSidebar: Supabase client not ready yet, will retry when ready");
      return;
    }

    console.log("UserDashboardSidebar: Starting profile fetch effect");

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
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("getSession timeout")), 1500))
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
            const userResult = await Promise.race([
              supabase.auth.getUser(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("getUser timeout")), 1500))
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
          // Both methods timed out - set default profile
          if (mounted) {
            setUserProfile({
              name: "User",
              image: null,
            });
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
            setUserProfile({
              name: "User",
              image: null,
            });
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
        // Always set something, even if it's just "User" - this ensures loading state clears
        const quickProfile = {
          name: googleName || sessionUser.email?.split("@")[0] || "User",
          image: googleImage,
        };
        
        console.log("UserDashboardSidebar: Setting quick profile", quickProfile);
        
        if (mounted) {
          setUserProfile(quickProfile);
          setIsLoading(false); // Always stop loading - we have at least basic info
          
          // Cache in sessionStorage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userProfile', JSON.stringify(quickProfile));
          }
        }

        // Get user data from database (this might be slower, but we already have basic info displayed)
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("name, image, role")
          .eq("id", sessionUser.id)
          .single();

        if (userError) {
          console.warn("UserDashboardSidebar: Error fetching user from database", {
            error: userError,
            code: userError.code,
            message: userError.message,
          });
          
          // We already set the profile from Google auth, so just return
          return;
        }

        // Update profile with database data if available (prefer database name, but keep Google image for users)
        if (user && mounted) {
          // For regular users, prefer Google image; for dietitians, use uploaded image
          const profileImage = user.role === "DIETITIAN" 
            ? (user.image || googleImage)
            : (googleImage || user?.image);

          const profile = {
            name: user.name || googleName || "User",
            image: profileImage,
          };

          setUserProfile(profile);
          
          // Update cache in sessionStorage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('userProfile', JSON.stringify(profile));
          }
        }
      } catch (error) {
        console.error("UserDashboardSidebar: Error fetching profile", error);
        // Set a default profile on error to ensure loading stops
        if (mounted) {
          setUserProfile({
            name: "User",
            image: null,
          });
          setIsLoading(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserProfile();

    // Safety timeout - force loading to false after 3 seconds
    // This ensures we don't show "Loading..." forever
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setUserProfile((current) => {
          if (!current) {
            console.warn("UserDashboardSidebar: Safety timeout - setting default profile");
            return {
              name: "User",
              image: null,
            };
          }
          return current;
        });
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [supabase]); // Run when supabase client is ready

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
