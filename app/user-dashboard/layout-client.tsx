"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function UserDashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBookACallPage = pathname === "/user-dashboard/book-a-call";

  return (
    <>
      {children}
      
      {/* Floating Plus Button - Mobile only, show on all pages except book-a-call */}
      {!isBookACallPage && (
        <Link
          href="/user-dashboard/book-a-call"
          className="lg:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center shadow-lg transition-colors"
          aria-label="Book a Call"
        >
          <Plus className="h-6 w-6 text-black" strokeWidth={3} />
        </Link>
      )}
    </>
  );
}

