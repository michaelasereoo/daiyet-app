"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, CheckCircle2, XCircle, Loader2, Link2, Unlink } from "lucide-react";

export default function CalendarsPage() {
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected" | "expired">("unknown");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const loadStatus = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/google-calendar-status", { credentials: "include" });
      if (!res.ok) {
        setStatus("disconnected");
        return;
      }
      const data = await res.json();
      if (data.connected) {
        setStatus(data.expired ? "expired" : "connected");
      } else {
        setStatus("disconnected");
      }
    } catch (err) {
      console.error("Failed to load calendar status:", err);
      setStatus("disconnected");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const error = searchParams.get("error");
    const errorMessage = searchParams.get("error_message");
    const connected = searchParams.get("connected");
    if (connected === "true") {
      setMessage("Google Calendar connected successfully.");
      loadStatus();
      router.replace("/therapist-dashboard/settings/calendars");
    } else if (error) {
      setMessage(errorMessage || "Failed to connect Google Calendar. Please try again.");
    }
  }, [searchParams, router]);

  const handleConnect = () => {
    const redirect = encodeURIComponent("/therapist-dashboard/settings/calendars");
    window.location.href = `/api/auth/google/authorize?redirect=${redirect}`;
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/disconnect-google-calendar", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect Google Calendar");
      }
      setMessage("Google Calendar disconnected.");
      setStatus("disconnected");
    } catch (err: any) {
      setMessage(err.message || "Failed to disconnect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold text-[#f9fafb] mb-1">Calendars</h1>
            <p className="text-sm text-[#9ca3af]">
              Connect Google Calendar to generate Meet links and manage bookings.
            </p>
          </div>
          {status === "connected" ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isLoading}
              className="border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
              Disconnect Google Calendar
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={isLoading} className="bg-[#7c3aed] hover:bg-[#6d28d9]">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-8 max-w-3xl">
        {message && (
          <div className="p-3 border border-[#262626] rounded-lg bg-[#0f172a]/40 text-sm text-[#e5e7eb]">
            {message}
          </div>
        )}

        {/* Add to Calendar Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-[#f9fafb]">Add to calendar</h2>
          <p className="text-sm text-[#9ca3af]">
            Select where to add events when you're booked.
          </p>
          <div className="border border-[#262626] rounded-lg px-4 py-3 bg-[#0a0a0a]">
            <div className="flex items-center gap-3 text-sm text-[#9ca3af]">
              {status === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : status === "expired" ? (
                <XCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span>
                {status === "connected" && "Google Calendar is connected. Meet links will be created after booking payment."}
                {status === "expired" && "Google Calendar token expired. Please reconnect to create Meet links."}
                {status === "disconnected" && "Google Calendar is not connected. Connect to auto-create Meet links."}
              </span>
            </div>
          </div>
          <p className="text-xs text-[#9ca3af]">
            Meet links are generated from your calendar after bookings are paid.
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
              Coming soon
            </Button>
          </div>

          {/* Calendar Cards */}
          <div className="space-y-3">
            <div className="border border-[#262626] rounded-lg px-4 py-3 bg-transparent">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#9ca3af]" />
                <div>
                  <div className="text-sm font-medium text-[#f9fafb]">Google Calendar</div>
                  <div className="text-xs text-[#9ca3af]">
                    {status === "connected"
                      ? "Connected and ready to create Meet links."
                      : "Connect to auto-create Meet links after bookings are paid."}
                  </div>
                  {status === "connected" && (
                    <div className="text-xs text-[#9ca3af] mt-1">Connected to your primary calendar.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#9ca3af]">
            Conflict checking and multi-calendar support are coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
