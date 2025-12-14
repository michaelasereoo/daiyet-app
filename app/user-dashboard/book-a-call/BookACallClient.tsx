"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { BookingForm } from "@/components/booking/booking-form";
import { PaymentModal } from "@/components/user/payment-modal";
import { isAllowedEventTypeSlug, isExcludedEventTypeSlug, hasExcludedKeywords } from "@/constants/eventTypes";
import dayjs from "dayjs";

interface EventType {
  id: string;
  title: string;
  description?: string;
  length: number;
  price: number;
  currency?: string;
  slug: string;
  active: boolean;
  user_id?: string;
}

interface Dietitian {
  id: string;
  name: string;
  email: string;
  bio?: string;
  image?: string;
  qualification?: string;
  description?: string;
}

interface BookACallPageContentProps {
  initialUserProfile: { name: string; email: string; image?: string | null } | null;
}

function BookACallPageContent({ initialUserProfile }: BookACallPageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get dietitianId from URL or determine current step
  const urlDietitianId = searchParams.get("dietitianId");
  const urlStep = searchParams.get("step");
  const prefillEventTypeId = searchParams.get("eventTypeId");
  
  // Determine current step: "dietitian" | "event" | "form" | "date" | "payment"
  const getCurrentStep = (): "dietitian" | "event" | "form" | "date" | "payment" => {
    if (!urlDietitianId) return "dietitian";
    if (urlStep === "form") return "form";
    if (urlStep === "date") return "date";
    if (urlStep === "payment") return "payment";
    return "event"; // Default to event selection if dietitianId exists
  };
  
  // State declarations - all useState hooks must be declared before useEffects
  const [dietitianId, setDietitianId] = useState<string | null>(urlDietitianId);
  const [selectedDietitian, setSelectedDietitian] = useState<Dietitian | null>(null);
  const [dietitians, setDietitians] = useState<Dietitian[]>([]);
  const [dietitiansLoading, setDietitiansLoading] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [eventTypesState, setEventTypesState] = useState<{
    loading: boolean;
    error: string | null;
    lastFetched: Date | null;
  }>({
    loading: false,
    error: null,
    lastFetched: null,
  });
  const [step, setStep] = useState<"dietitian" | "event" | "form" | "date" | "payment">(getCurrentStep());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [bookingData, setBookingData] = useState<any>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    age?: number;
    occupation?: string;
    medicalCondition?: string;
    monthlyFoodBudget?: number;
  } | null>(null);
  
  // ✅ Clear any old/invalid event types on mount and when step changes
  useEffect(() => {
    // Check if selectedEventType is invalid
    if (selectedEventType && !isAllowedEventTypeSlug(selectedEventType.slug)) {
      console.log(`[Client] 🧹 Clearing invalid event type: ${selectedEventType.title} (slug: ${selectedEventType.slug})`);
      setSelectedEventType(null);
      
      // If we're on form/date step with invalid event type, reset to event selection
      if (step === "form" || step === "date") {
        if (dietitianId) {
          router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
          setStep("event");
        } else {
          router.push("/user-dashboard/book-a-call");
          setStep("dietitian");
        }
      }
    }
  }, [selectedEventType, step, dietitianId, router]);
  
  // ✅ Validate prefillEventTypeId on mount - clear if invalid
  useEffect(() => {
    if (prefillEventTypeId && eventTypes.length > 0) {
      const isValidPrefill = eventTypes.some(et => 
        et.id === prefillEventTypeId && isAllowedEventTypeSlug(et.slug)
      );
      
      if (!isValidPrefill) {
        console.warn(`[Client] ⚠️ Invalid prefillEventTypeId ${prefillEventTypeId} - clearing from URL`);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('eventTypeId');
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      }
    }
  }, [prefillEventTypeId, eventTypes, router]);

  // ✅ CRITICAL: Clear any invalid selectedEventType on mount
  // This handles stale state from previous sessions or URL parameters
  useEffect(() => {
    if (selectedEventType && !isAllowedEventTypeSlug(selectedEventType.slug)) {
      console.log(`[Client] 🧹 MOUNT: Clearing invalid event type: ${selectedEventType.title}`);
      setSelectedEventType(null);
      // Reset to dietitian selection if no dietitianId, otherwise reset to event selection
      if (!dietitianId) {
        router.push("/user-dashboard/book-a-call");
        setStep("dietitian");
      } else if (step === "form" || step === "date") {
        router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
        setStep("event");
      }
    }
  }, []); // Run once on mount only

  // Fetch user profile data for form pre-population
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch("/api/user/profile", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const profile = data.profile;
          setUserProfile({
            age: profile?.age || undefined,
            occupation: profile?.occupation || undefined,
            medicalCondition: profile?.medical_condition || undefined,
            monthlyFoodBudget: profile?.monthly_food_budget || undefined,
          });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };
    fetchUserProfile();
  }, []);

  // Fetch available dietitians (Step 1: Dietitian Selection)
  useEffect(() => {
    const fetchDietitians = async () => {
      // Only fetch if we're on the dietitian selection step
      if (step !== "dietitian" || dietitians.length > 0) return;
      
      setDietitiansLoading(true);
      try {
        const response = await fetch("/api/dietitians", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setDietitians(data.dietitians || []);
        }
      } catch (err) {
        console.error("Error fetching dietitians:", err);
      } finally {
        setDietitiansLoading(false);
      }
    };
    
    fetchDietitians();
  }, [step]);

  // Update dietitianId when URL changes
  useEffect(() => {
    if (urlDietitianId && urlDietitianId !== dietitianId) {
      setDietitianId(urlDietitianId);
      setStep(getCurrentStep());
    } else if (!urlDietitianId && step !== "dietitian") {
      setStep("dietitian");
    }
  }, [urlDietitianId]);

  // Fetch event types for the dietitian (Step 2: Event Type Selection)
  // Server handles filtering - client trusts server response
  // ✅ CORRECT: Only fetch AFTER dietitian is selected
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchEventTypes = async () => {
      // ✅ Don't fetch if no dietitianId or not on event selection step
      if (!dietitianId || step !== "event") {
        setEventTypes([]);
        setEventTypesState({
          loading: false,
          error: null,
          lastFetched: null,
        });
        return;
      }
      
      // Prevent rapid successive calls
      if (eventTypesState.loading) {
        return;
      }
      
      // ✅ RESET SELECTION FIRST - Clear any stale selections before fetching
      setSelectedEventType(null);
      setEventTypesState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        // Server handles filtering via ?filter=book-a-call parameter
        const cacheBuster = new Date().getTime();
        const response = await fetch(
          `/api/event-types?dietitianId=${dietitianId}&filter=book-a-call&_cb=${cacheBuster}`,
          {
            credentials: "include",
            signal: abortController.signal,
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to fetch event types'}`);
        }
        
        const data = await response.json();
        
        // Server already filtered, but add client-side safety filter to ensure old event types never show
        const fetchedEventTypes = (data.eventTypes || []).filter((et: EventType) => {
          // Double-check: Only allow event types with allowed slugs
          if (!isAllowedEventTypeSlug(et.slug)) {
            console.log(`[Client] ❌ Filtered out old event type: ${et.title} (slug: ${et.slug})`);
            return false;
          }
          
          // Additional safety: Check for excluded slugs
          if (isExcludedEventTypeSlug(et.slug)) {
            console.log(`[Client] ❌ Filtered out excluded slug: ${et.title} (slug: ${et.slug})`);
            return false;
          }
          
          // Additional safety: Check for excluded keywords in title
          if (hasExcludedKeywords(et.title)) {
            console.log(`[Client] ❌ Filtered out excluded title: ${et.title}`);
            return false;
          }
          
          return true;
        });
        
        console.log('📋 Book-a-Call Event types (server + client filtered):', {
          serverCount: (data.eventTypes || []).length,
          clientCount: fetchedEventTypes.length,
          eventTypes: fetchedEventTypes.map((et: EventType) => ({ id: et.id, title: et.title, slug: et.slug }))
        });
        
        setEventTypes(fetchedEventTypes);
        setEventTypesState({
          loading: false,
          error: null,
          lastFetched: new Date(),
        });
        
        // ✅ VALIDATE AND SANITIZE prefillEventTypeId
        let validSelectedType: EventType | null = null;
        
        if (prefillEventTypeId) {
          const prefillType = fetchedEventTypes.find((et: EventType) => et.id === prefillEventTypeId);
          
          // Validate prefill is both found AND allowed
          if (prefillType && isAllowedEventTypeSlug(prefillType.slug)) {
            validSelectedType = prefillType;
            console.log(`[Client] ✅ Valid prefill event type: ${prefillType.title}`);
          } else {
            // Invalid prefill - clear it from URL
            console.warn(`[Client] ⚠️ Invalid prefill event type ${prefillEventTypeId} - clearing from URL`);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('eventTypeId');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false });
          }
        }
        
        // ✅ Always default to first ALLOWED event type if no valid selection
        if (!validSelectedType && fetchedEventTypes.length > 0) {
          const firstAllowed = fetchedEventTypes.find((et: EventType) => isAllowedEventTypeSlug(et.slug));
          if (firstAllowed) {
            validSelectedType = firstAllowed;
            console.log(`[Client] ✅ Auto-selected first allowed event type: ${firstAllowed.title}`);
          }
        }
        
        // Set the validated selection
        if (validSelectedType) {
          setSelectedEventType(validSelectedType);
          // If prefill was valid, advance to date step
          if (prefillEventTypeId && validSelectedType.id === prefillEventTypeId) {
            setStep("date");
          }
        }
        
      } catch (error: any) {
        // Ignore abort errors (component unmounted or new request started)
        if (error.name === 'AbortError') {
          return;
        }
        
        const errorMessage = error.message || 'Failed to load event types';
        console.error("Error fetching event types:", error);
        
        setEventTypesState({
          loading: false,
          error: errorMessage,
          lastFetched: null,
        });
        
        setEventTypes([]);
        setSelectedEventType(null); // Clear selection on error
      }
    };

    fetchEventTypes();
    
    // Cleanup: abort request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [dietitianId, prefillEventTypeId, step, router]);

  // ✅ Clear selected event type if it's an old/excluded one (runs whenever selectedEventType changes)
  useEffect(() => {
    if (selectedEventType && !isAllowedEventTypeSlug(selectedEventType.slug)) {
      console.log(`[Client] ⚠️ Clearing invalid selected event type: ${selectedEventType.title} (slug: ${selectedEventType.slug})`);
      setSelectedEventType(null);
      
      // Reset to appropriate step if we're on form/date step with invalid event type
      if (step === "form" || step === "date") {
        if (dietitianId) {
          router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
          setStep("event");
        } else {
          router.push("/user-dashboard/book-a-call");
          setStep("dietitian");
        }
      }
    }
  }, [selectedEventType, step, dietitianId, router]);

  // Handle dietitian selection (Step 1 → Step 2)
  const handleDietitianSelect = (dietitian: Dietitian) => {
    setSelectedDietitian(dietitian);
    setDietitianId(dietitian.id);
    // Clear any previously selected event type when selecting new dietitian
    setSelectedEventType(null);
    // Update URL with selected dietitian and move to event selection step
    router.push(`/user-dashboard/book-a-call?dietitianId=${dietitian.id}&step=event`);
    setStep("event");
  };

  const handleEventTypeSelect = (eventType: EventType) => {
    setSelectedEventType(eventType);
    // Update URL to form step
    router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=form`);
    setStep("form");
  };

  const handleFormSubmit = (data: any) => {
    setBookingData(data);
    // Update URL to date selection step
    router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=date`);
    setStep("date");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    if (!selectedEventType || !dietitianId) return;
    
    try {
      const startTime = dayjs(selectedDate)
        .hour(parseInt(selectedTime.split(":")[0]))
        .minute(parseInt(selectedTime.split(":")[1]))
        .toDate();
      const endTime = dayjs(startTime).add(selectedEventType.length, "minute").toDate();

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventTypeId: selectedEventType.id,
          dietitianId: dietitianId,
          startTime,
          endTime,
          name: initialUserProfile?.name || "",
          email: initialUserProfile?.email || "",
          userAge: bookingData?.age,
          userOccupation: bookingData?.occupation,
          userMedicalCondition: bookingData?.medicalCondition,
          userMonthlyFoodBudget: bookingData?.monthlyFoodBudget,
          userComplaint: bookingData?.complaint,
          paystackRef: paymentData?.reference,
          paymentData,
        }),
      });

      if (response.ok) {
        setIsPaymentOpen(false);
        // Redirect to dashboard with success
        router.push("/user-dashboard?booking=success");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to create booking" }));
        console.error("Error creating booking:", errorData);
        alert(errorData.error || "Failed to create booking. Please try again.");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("Failed to create booking. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      <UserDashboardSidebar initialUserProfile={initialUserProfile ? { name: initialUserProfile.name, image: initialUserProfile.image } : undefined} />
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Book a Call</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Select a service and schedule your consultation.
            </p>
          </div>

          {/* Step 1: Dietitian Selection */}
          {step === "dietitian" && (
            <div className="max-w-4xl">
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-[#f9fafb] mb-2">Step 1: Select a Dietitian</h2>
                <p className="text-sm text-[#9ca3af]">
                  Choose a licensed dietitian to book your consultation with.
                </p>
              </div>

              {dietitiansLoading ? (
                <div className="text-center py-12">
                  <p className="text-[#9ca3af]">Loading available dietitians...</p>
                </div>
              ) : dietitians.length === 0 ? (
                <div className="border border-[#262626] rounded-lg p-8 text-center">
                  <p className="text-[#9ca3af] mb-4">No dietitians available at this time.</p>
                  <button
                    onClick={() => router.push("/user-dashboard")}
                    className="bg-white hover:bg-gray-100 text-black px-6 py-2 rounded-md text-sm font-medium"
                  >
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dietitians.map((dietitian) => (
                    <div
                      key={dietitian.id}
                      onClick={() => handleDietitianSelect(dietitian)}
                      className="border border-[#262626] rounded-lg p-6 cursor-pointer hover:border-[#404040] hover:bg-[#171717] transition-all"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        {dietitian.image ? (
                          <img
                            src={dietitian.image}
                            alt={dietitian.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-[#262626] flex items-center justify-center">
                            <span className="text-2xl text-[#9ca3af]">
                              {dietitian.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-[#f9fafb] mb-1">
                            {dietitian.name}
                          </h3>
                          <p className="text-sm text-[#9ca3af] mb-2">
                            {dietitian.qualification || "Licensed Dietitian"}
                          </p>
                          {dietitian.bio && (
                            <p className="text-sm text-[#9ca3af] line-clamp-2">
                              {dietitian.bio}
                            </p>
                          )}
                        </div>
                      </div>
                      <button className="w-full bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium transition-colors">
                        Select Dietitian
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Event Type Selection */}
          {step === "event" && dietitianId && (
            <>
              {eventTypesState.loading ? (
                <div className="text-center py-12">
                  <p className="text-[#9ca3af]">Loading available services...</p>
                </div>
              ) : eventTypesState.error ? (
                <div className="max-w-2xl">
                  <div className="border border-red-500/20 rounded-lg p-8 bg-red-500/10">
                    <p className="text-red-400 mb-4">
                      {eventTypesState.error}
                    </p>
                    <button
                      onClick={() => {
                        setEventTypesState(prev => ({ ...prev, error: null }));
                        // Trigger re-fetch by updating state
                        const currentDietitianId = dietitianId;
                        if (currentDietitianId) {
                          // Force re-render to trigger useEffect
                          window.location.reload();
                        }
                      }}
                      className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : eventTypes.length === 0 ? (
                <div className="max-w-2xl">
                  <div className="border border-[#262626] rounded-lg p-8 text-center">
                    <p className="text-[#9ca3af]">No available services at this time.</p>
                    <button
                      onClick={() => {
                        router.push("/user-dashboard/book-a-call");
                        setStep("dietitian");
                      }}
                      className="mt-4 bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Select Different Dietitian
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Progress Indicator */}
                  <div className="max-w-2xl mb-8">
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                          ✓
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Dietitian</span>
                      </div>
                      <div className="h-px w-16 bg-white" />
                      <div className={`flex items-center gap-2 ${step === "event" ? "text-white" : "text-[#9ca3af]"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "event" ? "bg-white text-black" : "bg-[#262626] text-[#9ca3af]"}`}>
                          2
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Service</span>
                      </div>
                      <div className={`h-px w-16 ${step === "form" || step === "date" || step === "payment" ? "bg-white" : "bg-[#262626]"}`} />
                      <div className={`flex items-center gap-2 ${step === "form" ? "text-white" : step === "date" || step === "payment" ? "text-[#9ca3af]" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "form" ? "bg-white text-black" : step === "date" || step === "payment" ? "bg-white text-black" : "bg-[#262626] text-[#9ca3af]"}`}>
                          3
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Details</span>
                      </div>
                      <div className={`h-px w-16 ${step === "date" || step === "payment" ? "bg-white" : "bg-[#262626]"}`} />
                      <div className={`flex items-center gap-2 ${step === "date" || step === "payment" ? "text-white" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "date" || step === "payment" ? "bg-white text-black" : "bg-[#262626] text-[#9ca3af]"}`}>
                          4
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Schedule</span>
                      </div>
                    </div>
                  </div>

                  <div className="max-w-2xl">
                    <div className="mb-4">
                      <button
                        onClick={() => {
                          router.push("/user-dashboard/book-a-call");
                          setStep("dietitian");
                        }}
                        className="text-sm text-[#9ca3af] hover:text-[#f9fafb] mb-4"
                      >
                        ← Back to select dietitian
                      </button>
                    </div>
                    <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">Step 2: Select a Service</h2>
                    <div className="space-y-4">
                      {eventTypes.map((eventType) => (
                        <div
                          key={eventType.id}
                          onClick={() => handleEventTypeSelect(eventType)}
                          className="border border-[#262626] rounded-lg p-6 cursor-pointer hover:border-[#404040] hover:bg-[#171717] transition-all"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-semibold text-[#f9fafb]">{eventType.title}</h3>
                            <span className="text-lg font-semibold text-[#f9fafb]">
                              {eventType.price === 0 ? "Free" : `₦${eventType.price.toLocaleString()}`}
                            </span>
                          </div>
                          {eventType.description && (
                            <p className="text-sm text-[#9ca3af] mb-3">{eventType.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-[#9ca3af]">
                            <span>Duration: {eventType.length} minutes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Step 3: Form, Step 4: Date Selection - Keep existing code */}
          {/* ✅ GUARD: Only show form/date steps if we have a valid selectedEventType */}
          {step !== "dietitian" && step !== "event" && dietitianId && (
            <>
              {/* If selectedEventType is invalid, show error and redirect */}
              {selectedEventType && !isAllowedEventTypeSlug(selectedEventType.slug) ? (
                <div className="max-w-2xl">
                  <div className="border border-red-500/20 rounded-lg p-8 bg-red-500/10">
                    <p className="text-red-400 mb-4">
                      The selected service is no longer available. Please select a different service.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedEventType(null);
                        router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
                        setStep("event");
                      }}
                      className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Select Service
                    </button>
                  </div>
                </div>
              ) : eventTypesState.loading ? (
            <div className="text-center py-12">
              <p className="text-[#9ca3af]">Loading available services...</p>
            </div>
          ) : eventTypesState.error ? (
            <div className="max-w-2xl">
              <div className="border border-red-500/20 rounded-lg p-8 bg-red-500/10">
                <p className="text-red-400 mb-4">
                  {eventTypesState.error}
                </p>
                <button
                  onClick={() => {
                    setEventTypesState(prev => ({ ...prev, error: null }));
                    // Trigger re-fetch by updating state
                    const currentDietitianId = dietitianId;
                    if (currentDietitianId) {
                      // Force re-render to trigger useEffect
                      window.location.reload();
                    }
                  }}
                  className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : eventTypes.length === 0 ? (
            <div className="max-w-2xl">
              <div className="border border-[#262626] rounded-lg p-8 text-center">
                <p className="text-[#9ca3af]">No available services at this time.</p>
              </div>
            </div>
          ) : (
            <>
                  {/* Progress Indicator for Form/Date steps */}
                  <div className="max-w-2xl mb-8">
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                          ✓
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Dietitian</span>
                      </div>
                      <div className="h-px w-16 bg-white" />
                      <div className="flex items-center gap-2 text-[#9ca3af]">
                        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                          ✓
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Service</span>
                      </div>
                      <div className="h-px w-16 bg-white" />
                      <div className={`flex items-center gap-2 ${step === "form" ? "text-white" : "text-[#9ca3af]"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "form" ? "bg-white text-black" : "bg-white text-black"}`}>
                          3
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Details</span>
                      </div>
                      <div className={`h-px w-16 ${step === "date" || step === "payment" ? "bg-white" : "bg-[#262626]"}`} />
                      <div className={`flex items-center gap-2 ${step === "date" || step === "payment" ? "text-white" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "date" || step === "payment" ? "bg-white text-black" : "bg-[#262626] text-[#9ca3af]"}`}>
                          4
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Schedule</span>
                      </div>
                    </div>
                  </div>


                  {step === "form" && selectedEventType && isAllowedEventTypeSlug(selectedEventType.slug) && (
                    <div className="max-w-2xl space-y-6">
                      <div className="mb-4">
                        <button
                          onClick={() => {
                            router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
                            setStep("event");
                          }}
                          className="text-sm text-[#9ca3af] hover:text-[#f9fafb] mb-4"
                        >
                          ← Back to service selection
                        </button>
                      </div>
                      {/* Event Type Display */}
                      <div className="border border-[#262626] rounded-lg p-6 bg-[#171717]">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-2xl font-semibold text-[#f9fafb] mb-2">{selectedEventType.title}</h3>
                            {selectedEventType.description && (
                              <p className="text-sm text-[#9ca3af] mb-4">{selectedEventType.description}</p>
                            )}
                            <div className="flex items-center gap-6 text-sm text-[#9ca3af]">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{selectedEventType.length}m</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Google Meet</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Africa/Lagos</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-[#262626]">
                          <span className={`inline-block px-4 py-2 rounded-md text-sm font-medium ${selectedEventType.price === 0 ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}`}>
                            {selectedEventType.price === 0 ? "Free" : `₦${selectedEventType.price.toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      {/* Booking Form */}
                      <BookingForm
                        eventType={selectedEventType}
                        onSubmit={handleFormSubmit}
                        isLoading={false}
                        initialAge={userProfile?.age}
                        initialOccupation={userProfile?.occupation}
                        initialMedicalCondition={userProfile?.medicalCondition}
                        initialMonthlyFoodBudget={userProfile?.monthlyFoodBudget}
                      />
                    </div>
                  )}

                  {step === "date" && selectedEventType && isAllowedEventTypeSlug(selectedEventType.slug) && (
                    <div className="max-w-2xl">
                      <div className="mb-4">
                        <button
                          onClick={() => {
                            router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=form`);
                            setStep("form");
                          }}
                          className="text-sm text-[#9ca3af] hover:text-[#f9fafb] mb-4"
                        >
                          ← Back to details
                        </button>
                        <h2 className="text-lg font-semibold text-[#f9fafb] mt-2 mb-2">{selectedEventType.title}</h2>
                      </div>
                      <TimeSlotPicker
                        date={selectedDate}
                        duration={selectedEventType.length}
                        onSelectTime={handleTimeSelect}
                        selectedTime={selectedTime}
                        dietitianId={dietitianId || ""}
                        eventTypeId={selectedEventType.id}
                      />
                    </div>
                  )}
                  
                  {/* Show error if invalid event type is selected */}
                  {step === "form" && selectedEventType && !isAllowedEventTypeSlug(selectedEventType.slug) && (
                    <div className="max-w-2xl">
                      <div className="border border-red-500/20 rounded-lg p-8 bg-red-500/10">
                        <p className="text-red-400 mb-4">
                          The selected service is no longer available. Please select a different service.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedEventType(null);
                            router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
                            setStep("event");
                          }}
                          className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium"
                        >
                          Select Service
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {step === "date" && selectedEventType && !isAllowedEventTypeSlug(selectedEventType.slug) && (
                    <div className="max-w-2xl">
                      <div className="border border-red-500/20 rounded-lg p-8 bg-red-500/10">
                        <p className="text-red-400 mb-4">
                          The selected service is no longer available. Please select a different service.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedEventType(null);
                            router.push(`/user-dashboard/book-a-call?dietitianId=${dietitianId}&step=event`);
                            setStep("event");
                          }}
                          className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-md text-sm font-medium"
                        >
                          Select Service
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {selectedEventType && initialUserProfile && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onSuccess={handlePaymentSuccess}
          amount={selectedEventType.price}
          currency={selectedEventType.currency || "NGN"}
          description={selectedEventType.title}
          requestType="CONSULTATION"
          userEmail={initialUserProfile?.email || ""}
          userName={initialUserProfile?.name || ""}
        />
      )}
    </div>
  );
}

export default function BookACallPageContentWrapper(props: BookACallPageContentProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading booking page...</div>
      </div>
    }>
      <BookACallPageContent {...props} />
    </Suspense>
  );
}
