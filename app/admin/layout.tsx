"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
// TEMPORARY: Auth imports commented out
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/lib/hooks/useAuth";
// import { normalizeRole } from "@/lib/utils/auth-utils";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // TEMPORARY: Auth disabled - uncomment to re-enable
  // const router = useRouter();
  // const { user, role, isLoading } = useAuth();
  const [authorized] = useState(true); // TEMPORARY: Always authorized - change back to false when re-enabling

  // TEMPORARY: Auth check disabled - uncomment this entire block to re-enable
  /*
  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push("/admin-login?redirect=" + encodeURIComponent(pathname || "/admin"));
      return;
    }

    // Verify user is an admin
    if (normalizeRole(role) !== "ADMIN") {
      // Not an admin - redirect to appropriate page
      if (role === "DIETITIAN") {
        router.push("/dashboard");
      } else if (role === "USER") {
        router.push("/user-dashboard");
      } else {
        router.push("/");
      }
      return;
    }

    // User is authorized
    setAuthorized(true);
  }, [user, role, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }
  */

  return (
    <div className="flex min-h-screen bg-[#0b0b0b] text-white">
      <AdminSidebar />
      <main className="flex-1 md:ml-72">
        <header className="sticky top-0 z-10 bg-[#0b0b0b]/80 backdrop-blur border-b border-[#1f1f1f] px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] sm:text-xs uppercase tracking-widest text-white/50">
              Admin
            </div>
            <div className="text-base sm:text-lg font-semibold">
              {pathname?.replace("/admin", "") || "Overview"}
            </div>
          </div>
        </header>
        <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
