"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Pencil, 
  Trash2, 
  Plus, 
  Copy, 
  ChevronDown,
  ArrowLeft,
  Check
} from "lucide-react";
import { TimeSelect } from "@/components/availability/TimeSelect";
import { CopyTimesModal } from "@/components/availability/CopyTimesModal";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
  timezone: string;
  days: Record<string, { enabled: boolean; slots: Array<{ start: string; end: string }> }>;
}

export default function AvailabilityDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Preload from cache, then fetch fresh data
  useEffect(() => {
    const resolvedParams = params instanceof Promise ? params : Promise.resolve(params);
    
    resolvedParams.then(async (resolved) => {
      const scheduleId = resolved.id;
      
      // Try to load from cache first
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(`availability_schedule_${scheduleId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            // Use cached data if less than 5 minutes old
            if (Date.now() - parsed.timestamp < 300000) {
              setSchedule(parsed.data);
              setScheduleName(parsed.data.name);
              setLoading(false);
            }
          } catch (err) {
            console.error("Error parsing cached schedule:", err);
          }
        }
      }

      // Fetch fresh data
      try {
        setError(null);

        const response = await fetch(`/api/availability/${scheduleId}`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Failed to fetch schedule (${response.status})`);
        }

        const data = await response.json();
        setSchedule(data.schedule);
        setScheduleName(data.schedule.name);
        
        // Cache the schedule
        if (typeof window !== "undefined") {
          localStorage.setItem(`availability_schedule_${scheduleId}`, JSON.stringify({
            data: data.schedule,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load schedule";
        setError(errorMessage);
        console.error("Error fetching schedule:", err);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const toggleDay = (day: string) => {
    if (!schedule) return;
    
    setSchedule((prev) => {
      if (!prev) return prev;
      const dayData = prev.days[day as keyof typeof prev.days];
      const isCurrentlyEnabled = dayData.enabled;
      
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day as keyof typeof prev.days],
            enabled: !isCurrentlyEnabled,
            // If toggling on and no slots exist, add a default slot
            // If toggling off, keep slots but they won't be visible
            slots: !isCurrentlyEnabled && dayData.slots.length === 0
              ? [{ start: "9:00am", end: "5:00pm" }]
              : dayData.slots,
          },
        },
      };
    });
  };

  const addTimeSlot = (day: string) => {
    if (!schedule) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      const currentSlots = prev.days[day as keyof typeof prev.days]?.slots || [];
      const lastSlot = currentSlots[currentSlots.length - 1];
      // If there's a last slot, start the new one where it ended, otherwise default
      const newStart = lastSlot ? lastSlot.end : "9:00am";
      // Calculate end time (add 1 hour to start, or default to 5:00pm)
      const newEnd = lastSlot ? lastSlot.end : "5:00pm";
      
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day as keyof typeof prev.days],
            slots: [
              ...currentSlots,
              { start: newStart, end: newEnd },
            ],
          },
        },
      };
    });
  };

  const handleCopyTimes = (day: string) => {
    setCopySourceDay(day);
    setCopyModalOpen(true);
  };

  const handleApplyCopy = (selectedDays: string[]) => {
    if (!schedule || !copySourceDay) return;

    const sourceDayData = schedule.days[copySourceDay as keyof typeof schedule.days];
    const sourceSlots = sourceDayData?.slots || [];

    setSchedule((prev) => {
      if (!prev) return prev;
      const updatedDays = { ...prev.days };

      selectedDays.forEach((targetDay) => {
        updatedDays[targetDay as keyof typeof updatedDays] = {
          enabled: true,
          slots: sourceSlots.map((slot) => ({ ...slot })),
        };
      });

      return {
      ...prev,
        days: updatedDays,
      };
    });

    setCopyModalOpen(false);
    setCopySourceDay(null);
  };

  const deleteTimeSlot = (day: string, slotIndex: number) => {
    if (!schedule) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      const newSlots = [...(prev.days[day as keyof typeof prev.days]?.slots || [])];
      newSlots.splice(slotIndex, 1);
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day as keyof typeof prev.days],
            slots: newSlots,
          },
        },
      };
    });
  };

  const updateTimeSlot = (day: string, slotIndex: number, field: "start" | "end", value: string) => {
    if (!schedule) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      const newSlots = [...(prev.days[day as keyof typeof prev.days]?.slots || [])];
      newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day as keyof typeof prev.days],
            slots: newSlots,
          },
        },
      };
    });
  };

  const getSummary = () => {
    if (!schedule) return "Loading...";
    const enabledDays = daysOfWeek.filter(
      (day) => schedule.days[day as keyof typeof schedule.days]?.enabled
    );
    if (enabledDays.length === 0) return "No days selected";
    if (enabledDays.length === 5 && enabledDays.includes("Monday") && enabledDays.includes("Friday") && !enabledDays.includes("Sunday") && !enabledDays.includes("Saturday")) {
      return "Mon - Fri, 9:00 AM - 5:00 PM";
    }
    return `${enabledDays.map((d) => d.slice(0, 3)).join(", ")}, 9:00 AM - 5:00 PM`;
  };

  const handleSave = async () => {
    if (!schedule) return;

    try {
      setSaving(true);
      setError(null);

      const resolvedParams = params instanceof Promise ? await params : params;
      const scheduleId = resolvedParams.id;

      const response = await fetch(`/api/availability/${scheduleId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: scheduleName || schedule.name,
          timezone: schedule.timezone,
          days: schedule.days,
          isDefault: schedule.isDefault,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save schedule");
      }

      // Show success modal
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        router.push("/dashboard/availability");
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save schedule";
      setError(errorMessage);
      console.error("Error saving schedule:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule) return;

    if (!confirm("Are you sure you want to delete this schedule?")) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const resolvedParams = params instanceof Promise ? await params : params;
      const scheduleId = resolvedParams.id;

      const response = await fetch(`/api/availability/${scheduleId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete schedule");
      }

      // Navigate back to availability page
      router.push("/dashboard/availability");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete schedule";
      setError(errorMessage);
      console.error("Error deleting schedule:", err);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
          <div className="p-8">
            <div className="text-white">Loading schedule...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error && !schedule) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
          <div className="p-8">
            <button
              onClick={() => router.push("/dashboard/availability")}
              className="mb-4 text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-red-300 font-semibold mb-1">Error loading schedule</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!schedule) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
        <div className="p-8">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-semibold mb-1">Error</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push("/dashboard/availability")}
              className="mb-4 text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {isEditingName ? (
                  <Input
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    onBlur={() => {
                      setIsEditingName(false);
                      setSchedule((prev) => prev ? { ...prev, name: scheduleName } : prev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setIsEditingName(false);
                        setSchedule((prev) => prev ? { ...prev, name: scheduleName } : prev);
                      }
                    }}
                    className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] text-lg font-semibold px-2 py-1"
                    autoFocus
                  />
                ) : (
                  <>
                    <h1 className="text-lg font-semibold text-[#f9fafb]">
                      {schedule.name}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-[#9ca3af] hover:text-[#f9fafb]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#D4D4D4]">Set as Default</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.isDefault}
                      onChange={(e) =>
                        setSchedule((prev) => prev ? { ...prev, isDefault: e.target.checked } : prev)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
                  </label>
                </div>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-[#D4D4D4] hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <p className="text-sm text-[#9ca3af]">{getSummary()}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Days Configuration */}
            <div className="lg:col-span-2 space-y-4">
              {daysOfWeek.map((day) => {
                const dayData = schedule.days[day as keyof typeof schedule.days];
                return (
                  <div
                    key={day}
                    className="border border-[#262626] rounded-lg p-4 bg-transparent"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dayData.enabled}
                          onChange={() => toggleDay(day)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
                      </label>
                      <span className="text-sm font-medium text-[#f9fafb] min-w-[80px]">
                        {day}
                      </span>
                      
                      {dayData.enabled && dayData.slots.length > 0 && (
                        <>
                          {/* First time slot on the same line */}
                          <div className="flex items-center gap-2">
                            <TimeSelect
                              value={dayData.slots[0].start}
                              onChange={(value) =>
                                updateTimeSlot(day, 0, "start", value)
                              }
                            />
                            <span className="text-[#9ca3af]">-</span>
                            <TimeSelect
                              value={dayData.slots[0].end}
                              onChange={(value) =>
                                updateTimeSlot(day, 0, "end", value)
                              }
                            />
                            <button
                              onClick={() => addTimeSlot(day)}
                              className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCopyTimes(day)}
                              className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors relative"
                              title="Copy times to"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Additional time slots below on separate lines - aligned with first slot */}
                    {dayData.enabled && dayData.slots.length > 1 && (
                      <div className="mt-2 space-y-2">
                        {dayData.slots.slice(1).map((slot, slotIndex) => (
                          <div key={slotIndex + 1} className="flex items-center gap-2 ml-[148px]">
                            <TimeSelect
                              value={slot.start}
                              onChange={(value) =>
                                updateTimeSlot(day, slotIndex + 1, "start", value)
                              }
                            />
                            <span className="text-[#9ca3af]">-</span>
                            <TimeSelect
                              value={slot.end}
                              onChange={(value) =>
                                updateTimeSlot(day, slotIndex + 1, "end", value)
                              }
                            />
                            <button
                              onClick={() => deleteTimeSlot(day, slotIndex + 1)}
                              className="text-[#D4D4D4] hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Panel */}
            <div className="space-y-4">
              {/* Timezone */}
              <div className="border border-[#262626] rounded-lg p-4 bg-transparent">
                <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                  Timezone
                </label>
                <div className="relative">
                  <select
                    value="Africa/Lagos"
                    disabled
                    className="w-full bg-[#0a0a0a] border border-[#262626] text-[#9ca3af] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] opacity-60 cursor-not-allowed"
                  >
                    <option value="Africa/Lagos">Africa/Lagos</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none opacity-60" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Copy Times Modal */}
      {copyModalOpen && copySourceDay && schedule && (
        <CopyTimesModal
          isOpen={copyModalOpen}
          onClose={() => {
            setCopyModalOpen(false);
            setCopySourceDay(null);
          }}
          sourceDay={copySourceDay}
          sourceSlots={schedule.days[copySourceDay as keyof typeof schedule.days]?.slots || []}
          allDays={daysOfWeek}
          onApply={handleApplyCopy}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#f9fafb]">Availability saved successfully!</h3>
            </div>
            <p className="text-sm text-[#9ca3af] mb-4">
              Your changes have been saved and will be reflected immediately.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push("/dashboard/availability");
                }}
                className="bg-white hover:bg-gray-100 text-black px-4 py-2"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
