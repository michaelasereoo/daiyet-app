"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Link as LinkIcon, Code, Trash2, ChevronRight, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  length: number;
  price: number;
  currency: string;
  active: boolean;
  user_id: string;
}

// Default event type slugs that should have disabled Basics fields
const DEFAULT_EVENT_TYPE_SLUGS = [
  "1-on-1-nutritional-counselling-and-assessment",
  "1-on-1-nutritional-counselling-and-assessment-meal-plan",
  "monitoring",
];

export default function EventTypeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventTypeId = params?.id as string | undefined;
  const { user } = useAuth();

  const [eventType, setEventType] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"basics" | "availability">("basics");
  const [isActive, setIsActive] = useState(false);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<string>("inherit");
  const [availabilitySchedules, setAvailabilitySchedules] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [defaultScheduleId, setDefaultScheduleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isDefaultEventType = eventType && DEFAULT_EVENT_TYPE_SLUGS.includes(eventType.slug);

  useEffect(() => {
    const fetchEventType = async () => {
      console.log("EventTypeDetailPage params:", { params, eventTypeId });
      
      if (!eventTypeId) {
        const errorMsg = `Event type ID is missing. Params: ${JSON.stringify(params)}`;
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log("Fetching event type with ID:", eventTypeId);
        const response = await fetch(`/api/event-types/${eventTypeId}`, {
          credentials: "include",
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch event type" }));
          console.error("API error response:", errorData);
          const errorMessage = errorData.details || errorData.error || `HTTP ${response.status}: Failed to fetch event type`;
          
          // Provide helpful message based on error
          if (response.status === 404) {
            throw new Error(
              errorMessage + 
              (errorMessage.includes("does not exist") 
                ? ". Have you run the migration to create default event types?" 
                : "")
            );
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("Event type data received:", data);
        
        if (!data.eventType) {
          throw new Error("Event type data not found in response");
        }
        
        setEventType(data.eventType);
        setIsActive(data.eventType.active);
        
        // Set availability schedule selection
        if (data.eventType.availabilitySchedule) {
          setSelectedAvailabilityId(data.eventType.availabilitySchedule.id);
        } else {
          setSelectedAvailabilityId("inherit");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load event type";
        setError(errorMessage);
        console.error("Error fetching event type:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEventType();
  }, [eventTypeId]);

  // Note: We no longer auto-switch away from Basics tab for default event types
  // The Basics content is visible but disabled with a "Coming Soon" message

  // Fetch availability schedules
  useEffect(() => {
    const fetchAvailabilitySchedules = async () => {
      try {
        const response = await fetch("/api/availability", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const schedules = (data.schedules || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            isDefault: s.isDefault,
          }));
          setAvailabilitySchedules(schedules);
          
          // Find default schedule
          const defaultSchedule = schedules.find((s: any) => s.isDefault);
          if (defaultSchedule) {
            setDefaultScheduleId(defaultSchedule.id);
          }
        }
      } catch (err) {
        console.error("Error fetching availability schedules:", err);
        setAvailabilitySchedules([]);
      }
    };

    fetchAvailabilitySchedules();
    
    // Poll for real-time updates every 5 seconds
    const interval = setInterval(fetchAvailabilitySchedules, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    if (!eventType) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/event-types/${eventTypeId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: isActive,
          availabilityScheduleId: selectedAvailabilityId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save event type");
      }

      const data = await response.json();
      setEventType(data.eventType);
      
      // Update availability schedule selection
      if (data.eventType.availabilitySchedule) {
        setSelectedAvailabilityId(data.eventType.availabilitySchedule.id);
      } else {
        setSelectedAvailabilityId("inherit");
      }
      
      // Show success modal
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);
    } catch (err) {
      console.error("Error saving event type:", err);
      setError(err instanceof Error ? err.message : "Failed to save event type");
      alert(err instanceof Error ? err.message : "Failed to save event type");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChange = async (checked: boolean) => {
    setIsActive(checked);
    // Auto-save toggle changes
    if (!eventType) return;
    
    try {
      const response = await fetch(`/api/event-types/${eventTypeId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: checked,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update event type");
      }

      const data = await response.json();
      setEventType(data.eventType);
    } catch (err) {
      console.error("Error updating event type:", err);
      setIsActive(!checked); // Revert on error
      alert(err instanceof Error ? err.message : "Failed to update event type");
    }
  };

  const getBookingUrl = () => {
    if (!eventType) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/user-dashboard/book-a-call?eventTypeId=${eventType.id}`;
  };

  const handleCopyLink = async () => {
    const url = getBookingUrl();
    try {
      await navigator.clipboard.writeText(url);
      alert("Booking link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link. Please copy manually: " + url);
    }
  };

  const handleOpenBookingPage = () => {
    const url = getBookingUrl();
    window.open(url, "_blank");
  };

  const handleDelete = async () => {
    if (!eventType) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/event-types/${eventTypeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete event type");
      }

      // Redirect to event types list
      router.push("/therapist-dashboard/event-types");
    } catch (err) {
      console.error("Error deleting event type:", err);
      alert(err instanceof Error ? err.message : "Failed to delete event type");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getEmbedCode = () => {
    if (!eventType) return "";
    const url = getBookingUrl();
    return `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
          <div className="p-8">
            <div className="text-white">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !eventType) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
          <div className="p-8">
            <div className="text-red-300">Error: {error || "Event type not found"}</div>
          </div>
        </main>
      </div>
    );
  }

  // Get availability subtitle
  const getAvailabilitySubtitle = () => {
    if (selectedAvailabilityId === "inherit") {
      const defaultSchedule = availabilitySchedules.find(s => s.isDefault);
      return defaultSchedule ? `Inherit from ${defaultSchedule.name}` : "Inherit from default";
    }
    const selectedSchedule = availabilitySchedules.find(s => s.id === selectedAvailabilityId);
    return selectedSchedule ? selectedSchedule.name : "Working Hours";
  };

  const sections = [
    { id: "basics" as const, label: "Basics", subtitle: `${eventType.length} mins` },
    { id: "availability" as const, label: "Availability", subtitle: getAvailabilitySubtitle() },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/therapist-dashboard/event-types")}
                className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold text-[#f9fafb]">{eventType.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Active Toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => handleToggleChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
              </label>
              {/* Action Icons - Disabled */}
              <button 
                disabled
                className="text-[#6b7280] cursor-not-allowed opacity-50 p-2"
                title="Open booking page (disabled)"
              >
                <ExternalLink className="h-5 w-5" />
              </button>
              <button 
                disabled
                className="text-[#6b7280] cursor-not-allowed opacity-50 p-2"
                title="Copy booking link (disabled)"
              >
                <LinkIcon className="h-5 w-5" />
              </button>
              <button 
                disabled
                className="text-[#6b7280] cursor-not-allowed opacity-50 p-2"
                title="Show embed code (disabled)"
              >
                <Code className="h-5 w-5" />
              </button>
              <button 
                disabled
                className="text-[#6b7280] cursor-not-allowed opacity-50 p-2"
                title="Delete event type (disabled)"
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

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Sections */}
            <div className="lg:col-span-1 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? "bg-[#404040] text-[#f9fafb]"
                      : "text-[#9ca3af] hover:bg-[#262626] hover:text-[#f9fafb]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{section.label}</div>
                      <div className="text-xs mt-0.5 opacity-75">{section.subtitle}</div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>

            {/* Right Panel - Section Content */}
            <div className="lg:col-span-3">
              {activeSection === "basics" && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-[#f9fafb] mb-2">Basics</h2>
                    <div className="bg-[#262626] border border-[#404040] rounded-lg px-4 py-3 mb-4">
                      <p className="text-sm text-[#9ca3af]">
                        <span className="font-medium text-[#f9fafb]">Coming Soon:</span> Editing basic fields (title, description, duration, price) will be available in a future update. For now, you can view these settings and adjust availability.
                      </p>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Title
                    </label>
                    <Input
                      type="text"
                      value={eventType.title}
                      disabled
                      className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Description
                    </label>
                    <Textarea
                      value={eventType.description || ""}
                      disabled
                      rows={4}
                      className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* URL */}
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      URL
                    </label>
                    <Input
                      type="text"
                      value={`daiyet.co/therapist/${eventType.slug}`}
                      disabled
                      className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Duration
                    </label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        value={eventType.length}
                        disabled
                        className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed w-24"
                      />
                      <span className="text-sm text-[#9ca3af]">Minutes</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="multiple-durations"
                        disabled
                        className="w-4 h-4 rounded border-[#262626] bg-[#0a0a0a] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <label htmlFor="multiple-durations" className="text-sm text-[#D4D4D4]">
                        Allow multiple durations
                      </label>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Location
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value="Google Meet"
                        disabled
                        className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Button
                        variant="outline"
                        disabled
                        className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + Add a location
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "availability" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">Availability</h2>

                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Working Hours
                    </label>
                    <div className="relative">
                      <select
                        value={selectedAvailabilityId}
                        onChange={(e) => setSelectedAvailabilityId(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-4 py-2.5 pr-10 text-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-[#404040] appearance-none cursor-pointer"
                      >
                      {availabilitySchedules.length === 0 ? (
                        <option value="">No schedules available</option>
                      ) : (
                        <>
                          <option value="inherit" className="bg-[#0a0a0a] text-[#f9fafb]">
                            Inherit from default {defaultScheduleId ? `(${availabilitySchedules.find(s => s.id === defaultScheduleId)?.name || ""})` : ""}
                          </option>
                          {availabilitySchedules.map((schedule) => (
                          <option key={schedule.id} value={schedule.id} className="bg-[#0a0a0a] text-[#f9fafb]">
                            {schedule.name} {schedule.isDefault ? "(Default)" : ""}
                          </option>
                          ))}
                        </>
                      )}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
                    </div>
                    <p className="mt-2 text-xs text-[#9ca3af]">
                      Select an availability schedule for this event type. Manage schedules in{" "}
                      <button
                        onClick={() => router.push("/therapist-dashboard/availability")}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Availability settings
                      </button>
                      .
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/therapist-dashboard/availability")}
                      className="mt-4 bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626]"
                    >
                      + Add a schedule
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Embed Code Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#f9fafb]">Embed Code</h3>
              <button
                onClick={() => setShowEmbedModal(false)}
                className="text-[#9ca3af] hover:text-[#f9fafb]"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-[#9ca3af] mb-4">
              Copy and paste this code into your website to embed the booking form:
            </p>
            <div className="bg-[#0a0a0a] border border-[#262626] rounded p-4 mb-4">
              <code className="text-sm text-[#f9fafb] break-all">{getEmbedCode()}</code>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(getEmbedCode());
                    alert("Embed code copied to clipboard!");
                  } catch (err) {
                    console.error("Failed to copy:", err);
                  }
                }}
                className="bg-white hover:bg-gray-100 text-black px-4 py-2"
              >
                Copy Code
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[#f9fafb] mb-2">Delete Event Type</h3>
            <p className="text-sm text-[#9ca3af] mb-6">
              Are you sure you want to delete "{eventType?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-[#f9fafb]">Event type saved successfully!</h3>
            </div>
            <p className="text-sm text-[#9ca3af] mb-4">
              Your changes have been saved and will be reflected immediately.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowSuccessModal(false)}
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
