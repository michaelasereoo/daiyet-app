"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, XCircle } from "lucide-react";

export default function CalendarsPage() {
  const [isLoading] = useState(false);

  // DISABLED: Google Calendar functionality is disabled

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold text-[#f9fafb] mb-1">Calendars</h1>
            <p className="text-sm text-[#9ca3af]">
              Configure how your event types interact with your calendars.
            </p>
          </div>
          <Button
            disabled
            className="bg-gray-400 text-gray-600 px-4 py-2 cursor-not-allowed opacity-50"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect Google Calendar (Disabled)
          </Button>
        </div>
      </div>

      <div className="space-y-8 max-w-3xl">
        {/* Add to Calendar Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-[#f9fafb]">Add to calendar</h2>
          <p className="text-sm text-[#9ca3af]">
            Select where to add events when you're booked.
          </p>
          <div className="border border-[#262626] rounded-lg px-4 py-3 bg-[#0a0a0a]">
            <div className="flex items-center gap-3 text-sm text-[#9ca3af]">
              <XCircle className="h-5 w-5 text-yellow-500" />
              <span>Google Calendar integration is currently disabled.</span>
            </div>
          </div>
          <p className="text-xs text-[#9ca3af]">
            You can override this setting for individual event types in their advanced options.
          </p>
        </div>

        {/* Check for Conflicts Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[#f9fafb]">Check for conflicts</h2>
              <p className="text-sm text-[#9ca3af] mt-1">
                Select which calendars you want to check for conflicts to prevent double bookings.
              </p>
            </div>
            <Button
              variant="outline"
              disabled
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2 opacity-50 cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Calendar Cards */}
          <div className="space-y-3">
            <div className="border border-[#262626] rounded-lg px-4 py-3 bg-transparent">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#9ca3af]" />
                <div>
                  <div className="text-sm font-medium text-[#9ca3af]">Google Calendar integration disabled</div>
                  <div className="text-xs text-[#9ca3af]">This feature is currently unavailable</div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#9ca3af]">
            Calendar conflict checking is currently disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
