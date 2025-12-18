"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical } from "lucide-react";
import { AddScheduleModal } from "@/components/availability/AddScheduleModal";
import { useRouter, usePathname } from "next/navigation";

interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
  timezone: string;
  slots: Array<{
    day: string;
    start: string;
    end: string;
  }>;
}

export default function AvailabilityPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availabilityEnabled, setAvailabilityEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  
  const isOverridesPage = pathname === "/therapist-dashboard/availability/overrides";

  // Preload from cache, then fetch fresh data
  useEffect(() => {
    // Try to load from cache first for instant display
    if (typeof window !== "undefined") {
      const cachedSchedules = localStorage.getItem("availability_schedules");
      const cachedToggle = localStorage.getItem("availability_toggle");
      
      if (cachedSchedules) {
        try {
          const parsed = JSON.parse(cachedSchedules);
          // Use cached data if less than 5 minutes old
          if (Date.now() - parsed.timestamp < 300000) {
            setSchedules(parsed.data || []);
            setLoading(false);
          }
        } catch (err) {
          console.error("Error parsing cached schedules:", err);
        }
      }
      
      if (cachedToggle) {
        try {
          const parsed = JSON.parse(cachedToggle);
          if (Date.now() - parsed.timestamp < 300000) {
            setAvailabilityEnabled(parsed.enabled !== false);
          }
        } catch (err) {
          console.error("Error parsing cached toggle:", err);
        }
      }
    }

    const fetchData = async () => {
      try {
        setError(null);

        // Fetch schedules
        const schedulesResponse = await fetch("/api/availability", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!schedulesResponse.ok) {
          const errorData = await schedulesResponse.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Failed to fetch schedules (${schedulesResponse.status})`);
        }

        const schedulesData = await schedulesResponse.json();
        const schedules = schedulesData.schedules || [];
        setSchedules(schedules);
        
        // Cache schedules
        if (typeof window !== "undefined") {
          localStorage.setItem("availability_schedules", JSON.stringify({
            data: schedules,
            timestamp: Date.now()
          }));
        }

        // Fetch toggle state
        const toggleResponse = await fetch("/api/availability/toggle-all", {
          credentials: "include",
        });

        if (toggleResponse.ok) {
          const toggleData = await toggleResponse.json();
          const enabled = toggleData.enabled !== false;
          setAvailabilityEnabled(enabled);
          
          // Cache toggle state
          if (typeof window !== "undefined") {
            localStorage.setItem("availability_toggle", JSON.stringify({
              enabled,
              timestamp: Date.now()
            }));
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load availability schedules";
        setError(errorMessage);
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggleAvailability = async (enabled: boolean) => {
    // Optimistic update
    const previousState = availabilityEnabled;
    setAvailabilityEnabled(enabled);
    
    try {
      setToggling(true);
      const response = await fetch("/api/availability/toggle-all", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        // Update cache
        if (typeof window !== "undefined") {
          localStorage.setItem("availability_toggle", JSON.stringify({
            enabled,
            timestamp: Date.now()
          }));
        }
      } else {
        // Revert on error
        setAvailabilityEnabled(previousState);
        const errorData = await response.json().catch(() => ({ error: "Failed to toggle" }));
        throw new Error(errorData.error || "Failed to toggle availability");
      }
    } catch (err) {
      console.error("Error toggling availability:", err);
      // Revert on error
      setAvailabilityEnabled(previousState);
      alert(err instanceof Error ? err.message : "Failed to toggle availability");
    } finally {
      setToggling(false);
    }
  };

  const handleAddSchedule = async (name: string) => {
    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
      name,
          timezone: "Africa/Lagos",
      isDefault: false,
      slots: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create schedule");
      }

      const data = await response.json();
      
      // Refresh schedules
      const refreshResponse = await fetch("/api/availability", {
        credentials: "include",
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setSchedules(refreshData.schedules || []);
      }

    setIsModalOpen(false);
      
      // Navigate to the new schedule
      if (data.schedule?.id) {
        router.push(`/therapist-dashboard/availability/${data.schedule.id}`);
      }
    } catch (err) {
      console.error("Error creating schedule:", err);
      setError(err instanceof Error ? err.message : "Failed to create schedule");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Availability</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Configure times when you are available for bookings.
            </p>
            
            {/* Toggle All Availability Off */}
            <div className="mb-4 flex items-center justify-between border border-[#262626] rounded-lg px-4 py-3 bg-transparent">
              <span className="text-sm text-[#D4D4D4]">Toggle all availability off</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={availabilityEnabled}
                  onChange={(e) => handleToggleAvailability(e.target.checked)}
                  disabled={toggling}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${
                  availabilityEnabled 
                    ? "bg-[#9ca3af] peer-checked:bg-[#9ca3af]" 
                    : "bg-[#374151]"
                } ${toggling ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${
                    availabilityEnabled ? "translate-x-full" : "translate-x-0"
                  }`}></div>
                </div>
              </label>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => router.push("/therapist-dashboard/availability")}
                  className={isOverridesPage 
                    ? "bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                    : "bg-[#404040] border-[#404040] text-[#f9fafb] hover:bg-[#525252] px-4 py-2"
                  }
                >
                  My Availability
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push("/therapist-dashboard/availability/overrides")}
                  className={isOverridesPage
                    ? "bg-[#404040] border-[#404040] text-[#f9fafb] hover:bg-[#525252] px-4 py-2"
                    : "bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                  }
                >
                  Date Overrides
                </Button>
              </div>
              {!isOverridesPage && (
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-white hover:bg-gray-100 text-black px-4 py-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="text-white">Loading availability schedules...</div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-semibold mb-1">Error loading schedules</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Availability Schedules */}
          {!loading && !error && (
          <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[#9ca3af] mb-4">No availability schedules yet.</p>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-white hover:bg-gray-100 text-black px-4 py-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Schedule
                  </Button>
                </div>
              ) : (
                schedules.map((schedule) => (
              <div
                key={schedule.id}
                onClick={() => router.push(`/therapist-dashboard/availability/${schedule.id}`)}
                className="w-full border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-medium text-[#f9fafb] text-[14px]">
                        {schedule.name}
                      </h3>
                      {schedule.isDefault && (
                        <span className="text-xs text-[#9ca3af] bg-[#262626] px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1 mb-3">
                          {schedule.slots.length === 0 ? (
                            <div className="text-sm text-[#9ca3af] italic">No time slots configured</div>
                          ) : (
                            schedule.slots.map((slot, index) => (
                        <div key={index} className="text-sm text-[#d1d5db]">
                          {slot.day}, {slot.start} - {slot.end}
                        </div>
                            ))
                          )}
                    </div>
                    
                    <div className="text-xs text-[#A2A2A2]">
                      {schedule.timezone}
                    </div>
                  </div>

                  <div className="flex items-center ml-6">
                    <button className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
                ))
              )}
          </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#262626]">
            <p className="text-sm text-[#9ca3af]">
              Temporarily Out-Of-Office?{" "}
              <button className="text-[#f9fafb] hover:underline">
                Add a redirect
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Add Schedule Modal */}
      <AddScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onContinue={handleAddSchedule}
      />
    </div>
  );
}
