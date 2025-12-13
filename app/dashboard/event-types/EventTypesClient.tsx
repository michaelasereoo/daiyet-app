"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { EventTypesList } from "@/components/event-types/EventTypesList";
import { CreateEventTypeModal } from "@/components/event-types/CreateEventTypeModal";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  duration: number;
  price: number;
  currency?: string;
  guests?: number;
  isActive?: boolean;
  isHidden?: boolean;
  dietitianName?: string;
}

interface EventTypesClientProps {
  initialEventTypes: EventType[];
}

export default function EventTypesClient({ initialEventTypes }: EventTypesClientProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypes, setEventTypes] = useState<EventType[]>(initialEventTypes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch event types when component mounts
  // Note: We let the API route handle authentication server-side
  // This way we don't depend on client-side auth state which may not be ready yet
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("EventTypesClient: Fetching event types (auth will be handled server-side)");

        const response = await fetch("/api/event-types", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          const errorMessage = errorData.error || errorData.details || `Failed to fetch event types (${response.status})`;
          
          // Handle authentication errors specifically
          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication required. Please log in to view event types.");
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("EventTypesClient: Received event types data", { count: data.eventTypes?.length || 0, data });
        
        // Transform API data to match component expectations
        const transformed = (data.eventTypes || []).map((et: any) => ({
          id: et.id,
          title: et.title,
          slug: et.slug,
          description: et.description || "",
          duration: et.length || 30,
          price: Number(et.price) || 0,
          currency: et.currency === "NGN" ? "₦" : et.currency || "₦",
          guests: 1,
          isActive: et.active !== false,
          isHidden: !et.active,
        }));

        console.log("EventTypesClient: Transformed event types", { count: transformed.length });
        setEventTypes(transformed);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load event types";
        setError(errorMessage);
        console.error("EventTypesClient: Error fetching event types:", err);
      } finally {
        setLoading(false);
      }
    };

    // Only wait a short time for auth to initialize, then fetch anyway
    // The API route will handle authentication server-side
    if (authLoading) {
      // Wait a bit for auth to initialize, but don't wait forever
      const timeout = setTimeout(() => {
        fetchEventTypes();
      }, 500);
      return () => clearTimeout(timeout);
    }

    fetchEventTypes();
  }, [authLoading]);

  const handleCreateSuccess = async () => {
    // Refetch event types after successful creation
    try {
      const response = await fetch("/api/event-types", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch event types");
      }

      const data = await response.json();
      
      // Transform API data to match component expectations
      const transformed = (data.eventTypes || []).map((et: any) => ({
        id: et.id,
        title: et.title,
        slug: et.slug,
        description: et.description || "",
        duration: et.length || 30,
        price: Number(et.price) || 0,
        currency: et.currency === "NGN" ? "₦" : et.currency || "₦",
        guests: 1,
        isActive: et.active !== false,
        isHidden: !et.active,
      }));

      setEventTypes(transformed);
    } catch (err) {
      console.error("Error fetching event types:", err);
    }
  };

  const filteredEventTypes = eventTypes.filter((eventType) =>
    eventType.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eventType.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
          <div className="p-8">
            <div className="text-white">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
          <div className="p-8">
            <div className="mb-6">
              <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Event Types</h1>
              <p className="text-[13px] text-[#9ca3af] mb-6">
                Create events to share for people to book on your calendar.
              </p>
            </div>
            <div className="text-red-300 bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="font-semibold mb-1">Error loading event types</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Event Types</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Create events to share for people to book on your calendar.
            </p>
            
            {/* Search Bar and New Button */}
            <div className="flex items-center justify-between">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#A2A2A2]" />
                <Input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-transparent border-[#262626] text-[#A2A2A2] placeholder:text-[#A2A2A2] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#262626]"
                />
              </div>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                disabled
                className="bg-gray-400 hover:bg-gray-400 text-gray-600 px-4 py-2 cursor-not-allowed opacity-50"
                title="Creating new event types is disabled for now"
              >
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </div>
          </div>

          {/* Event Types List */}
          <EventTypesList eventTypes={filteredEventTypes} />
        </div>
      </main>

      {/* Create Event Type Modal */}
      <CreateEventTypeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}