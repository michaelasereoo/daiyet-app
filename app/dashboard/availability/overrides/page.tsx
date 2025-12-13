"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Info } from "lucide-react";
import { DateOverrideModal } from "@/components/availability/DateOverrideModal";

type Override = {
  id: string;
  date: string | Date;
  type: string;
  startTime?: string;
  endTime?: string;
  slots?: Array<{ start: string; end: string }>;
};

export default function DateOverridesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const isOverridesPage = pathname === "/dashboard/availability/overrides";

  // Preload from cache, then fetch fresh data
  useEffect(() => {
    // Try to load from cache first
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("availability_overrides");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Use cached data if less than 5 minutes old
          if (Date.now() - parsed.timestamp < 300000) {
            setOverrides(parsed.data || []);
            setLoading(false);
          }
        } catch (err) {
          console.error("Error parsing cached overrides:", err);
        }
      }
    }

    const fetchOverrides = async () => {
      try {
        setError(null);

        const response = await fetch("/api/availability/overrides", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Failed to fetch overrides (${response.status})`);
        }

        const data = await response.json();
        const overridesData = data.overrides || [];
        setOverrides(overridesData);
        
        // Cache overrides
        if (typeof window !== "undefined") {
          localStorage.setItem("availability_overrides", JSON.stringify({
            data: overridesData,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load date overrides";
        setError(errorMessage);
        console.error("Error fetching overrides:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverrides();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this override?")) {
      return;
    }

    try {
      setDeleting(id);
      const response = await fetch(`/api/availability/overrides/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete override");
      }

      // Remove from local state
      setOverrides(overrides.filter((override) => override.id !== id));
    } catch (err) {
      console.error("Error deleting override:", err);
      alert(err instanceof Error ? err.message : "Failed to delete override");
    } finally {
      setDeleting(null);
    }
  };

  const handleAddOverride = () => {
    setEditingOverride(null);
    setIsModalOpen(true);
  };

  const handleEditOverride = (id: string) => {
    setEditingOverride(id);
    setIsModalOpen(true);
  };

  const handleSaveDates = async (overrideData: Array<{ date: Date; type: "unavailable" | "available"; slots?: Array<{ start: string; end: string }> }>) => {
    try {
    if (editingOverride) {
      // Update existing override
      if (overrideData.length > 0) {
        const override = overrideData[0];
          const dateStr = typeof override.date === "string" 
            ? override.date 
            : new Date(override.date).toISOString().split("T")[0];

          const response = await fetch(`/api/availability/overrides/${editingOverride}`, {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              date: dateStr,
          type: override.type,
              slots: override.slots,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(errorData.error || "Failed to update override");
          }

          // Refresh overrides
          const refreshResponse = await fetch("/api/availability/overrides", {
            credentials: "include",
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            setOverrides(refreshData.overrides || []);
          }
      }
    } else {
        // Create new overrides
        const response = await fetch("/api/availability/overrides", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            overrides: overrideData.map((override) => ({
              date: typeof override.date === "string" 
                ? override.date 
                : new Date(override.date).toISOString().split("T")[0],
          type: override.type,
              slots: override.slots,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to create overrides");
        }

        // Refresh overrides
        const refreshResponse = await fetch("/api/availability/overrides", {
          credentials: "include",
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setOverrides(refreshData.overrides || []);
    }
      }

    setIsModalOpen(false);
    setEditingOverride(null);
    } catch (err) {
      console.error("Error saving overrides:", err);
      alert(err instanceof Error ? err.message : "Failed to save overrides");
    }
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time: string) => {
    // Convert HH:MM:SS to readable format
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Availability</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Configure times when you are available for bookings.
            </p>
            
            {/* Action Bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => router.push("/dashboard/availability")}
                  className={isOverridesPage 
                    ? "bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                    : "bg-[#404040] border-[#404040] text-[#f9fafb] hover:bg-[#525252] px-4 py-2"
                  }
                >
                  My Availability
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => router.push("/dashboard/availability/overrides")}
                  className={isOverridesPage
                    ? "bg-[#404040] border-[#404040] text-[#f9fafb] hover:bg-[#525252] px-4 py-2"
                    : "bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                  }
                >
                  Date Overrides
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-[#f9fafb]">Date overrides</h2>
              <Info className="h-4 w-4 text-[#9ca3af]" />
            </div>
            <p className="text-sm text-[#9ca3af] mb-6">
              Add dates when your availability changes from your daily hours.
            </p>
          </div>

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-semibold mb-1">Error loading overrides</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12 mb-6">
              <div className="text-white">Loading date overrides...</div>
            </div>
          )}

          {/* Override Entries */}
          {!loading && !error && (
            <>
          {overrides.length > 0 ? (
            <div className="space-y-4 mb-6">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#f9fafb] mb-1">
                        {formatDate(override.date)}
                      </div>
                      {override.type === "unavailable" ? (
                        <div className="text-sm text-[#9ca3af]">Unavailable</div>
                          ) : override.slots && override.slots.length > 0 ? (
                            <div className="space-y-1">
                              {override.slots.map((slot, index) => (
                                <div key={index} className="text-sm text-[#d1d5db]">
                                  {formatTime(slot.start)} - {formatTime(slot.end)}
                                </div>
                              ))}
                            </div>
                      ) : (
                        <div className="text-sm text-[#d1d5db]">
                              {override.startTime && override.endTime
                                ? `${override.startTime} - ${override.endTime}`
                                : "Available"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleEditOverride(override.id)}
                            disabled={deleting === override.id}
                            className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(override.id)}
                            disabled={deleting === override.id}
                            className="text-[#D4D4D4] hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 mb-6">
              <p className="text-sm text-[#9ca3af]">No date overrides yet.</p>
            </div>
              )}
            </>
          )}

          {/* Add Override Button */}
          <Button
            onClick={handleAddOverride}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add an override
          </Button>
        </div>
      </main>

      {/* Date Override Modal */}
      <DateOverrideModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOverride(null);
        }}
        onSave={handleSaveDates}
        existingDates={
          editingOverride
            ? (() => {
                const override = overrides.find((o) => o.id === editingOverride);
                if (!override) return [];
                const date = typeof override.date === "string" ? new Date(override.date) : override.date;
                return [date];
              })()
            : []
        }
        editingOverride={
          editingOverride
            ? overrides.find((o) => o.id === editingOverride) || null
            : null
        }
      />
    </div>
  );
}
