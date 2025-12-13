"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, Clock, MoreHorizontal, Phone, FileText } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: "Event Types", href: "/dashboard/event-types", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Availability", href: "/dashboard/availability", icon: Clock },
  { name: "More", href: "/dashboard", icon: MoreHorizontal },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#171717] border-t border-[#374151] lg:hidden">
      <div className="grid grid-cols-4 h-16">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-h-[64px] transition-colors",
                isActive
                  ? "text-[#f9fafb]"
                  : "text-[#9ca3af] hover:text-[#f9fafb]"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive && "text-[#f9fafb]"
              )} />
              <span className="text-[10px] font-medium leading-tight text-center px-1">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// User dashboard bottom navigation
const userNavigation: NavItem[] = [
  { name: "Dashboard", href: "/user-dashboard", icon: LayoutDashboard },
  { name: "Book a Call", href: "/user-dashboard/book-a-call", icon: Phone },
  { name: "Meetings", href: "/user-dashboard/upcoming-meetings", icon: Calendar },
  { name: "More", href: "/user-dashboard/meal-plan", icon: FileText },
];

export function UserBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#171717] border-t border-[#374151] lg:hidden">
      <div className="grid grid-cols-4 h-16">
        {userNavigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/user-dashboard" && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-h-[64px] transition-colors",
                isActive
                  ? "text-[#f9fafb]"
                  : "text-[#9ca3af] hover:text-[#f9fafb]"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5",
                isActive && "text-[#f9fafb]"
              )} />
              <span className="text-[10px] font-medium leading-tight text-center px-1">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

