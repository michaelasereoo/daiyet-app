"use client";

import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-[#f9fafb] mb-1">Push Notifications</h1>
        <p className="text-sm text-[#9ca3af]">
          Receive push notifications when booker submits instant meeting booking.
        </p>
      </div>

      <div className="max-w-3xl">
        <Button className="bg-white hover:bg-gray-100 text-black px-4 py-2">
          Allow Browser Notifications
        </Button>
      </div>
    </div>
  );
}
