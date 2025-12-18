"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PaymentModal } from "@/components/user/payment-modal";
import { ChevronLeft, ChevronRight, Check, Calendar as CalendarIcon, Clock, Video, ExternalLink, Globe } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import dayjs from "dayjs";
import { DietitianProfile } from "@/types";

// Default event types (same as book-a-call)
const defaultEventTypes = [
  {
    id: "1-on-1-nutritional-counselling-and-assessment",
    title: "1-on-1 Nutritional Counselling and Assessment",
    slug: "1-on-1-nutritional-counselling-and-assessment",
    description: "Have one on one consultation with Licensed Dietitician [Nutritional counseling and assessment]",
    length: 45,
    price: 15000,
    currency: "NGN"
  },
  {
    id: "1-on-1-nutritional-counselling-and-assessment-meal-plan",
    title: "1-on-1 Nutritional Counselling and Assessment + Meal Plan",
    slug: "1-on-1-nutritional-counselling-and-assessment-meal-plan",
    description: "Comprehensive nutritional counselling and assessment session with a personalized 7-day meal plan included.",
    length: 45,
    price: 25000,
    currency: "NGN"
  },
  {
    id: "monitoring",
    title: "Monitoring",
    slug: "monitoring",
    description: "Monitoring consultation",
    length: 20,
    price: 5000,
    currency: "NGN"
  },
  {
    id: "test-event",
    title: "Test Event",
    slug: "test-event",
    description: "Test event for payment testing",
    length: 15,
    price: 100,
    currency: "NGN"
  }
];

function PublicProfileContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  // Supabase client
  const supabase = useMemo(() => createBrowserClient(), []);
  
  // Dietitian data
  const [dietitian, setDietitian] = useState<DietitianProfile | null>(null);
  const [loadingDietitian, setLoadingDietitian] = useState(true);
  const [dietitianError, setDietitianError] = useState<string | null>(null);
  
  // Google OAuth state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Steps: 1=Profile, 2=User Info+Google, 3=Date, 4=Time, 5=Summary, 6=Success
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  
  // Form data
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    age: "",
    occupation: "",
    medicalCondition: "",
    monthlyFoodBudget: "",
    complaint: "",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Event type selection
  const [availableEventTypes, setAvailableEventTypes] = useState(defaultEventTypes);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>(defaultEventTypes[0].id);
  const [eventTypePrice, setEventTypePrice] = useState<number>(defaultEventTypes[0].price);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  
  // Payment state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [bookingForPayment, setBookingForPayment] = useState<{
    id: string;
    description: string;
  } | null>(null);
  
  // Booking details for success screen
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  
  // Calendar helpers
  const startOfMonth = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  
  // Fetch dietitian by slug
  useEffect(() => {
    const fetchDietitian = async () => {
      if (!slug) return;
      
      setLoadingDietitian(true);
      setDietitianError(null);
      
      try {
        const response = await fetch(`/api/dietitians/by-slug/${encodeURIComponent(slug)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setDietitianError("Dietitian not found");
          } else {
            setDietitianError("Failed to load dietitian profile");
          }
          return;
        }
        
        const data = await response.json();
        setDietitian(data.dietitian);
        
        // Fetch real event types for this dietitian
        if (data.dietitian?.id) {
          const eventTypesResponse = await fetch(`/api/event-types?dietitianId=${data.dietitian.id}`);
          if (eventTypesResponse.ok) {
            const eventTypesData = await eventTypesResponse.json();
            if (eventTypesData.eventTypes?.length > 0) {
              // Match with default types to get proper pricing
              const matchedTypes = defaultEventTypes.map(defaultType => {
                const realType = eventTypesData.eventTypes.find((et: any) => et.slug === defaultType.slug);
                if (realType) {
                  return {
                    ...defaultType,
                    id: realType.id, // Use the real UUID from database
                  };
                }
                // If no match found, keep the default but log a warning
                console.warn(`Event type not found for slug: ${defaultType.slug}`);
                return defaultType;
              }).filter(type => {
                // Only include types that have a valid UUID (36 chars with dashes)
                return type.id && type.id.length === 36 && type.id.includes('-');
              });
              
              if (matchedTypes.length > 0) {
                setAvailableEventTypes(matchedTypes);
                setSelectedEventTypeId(matchedTypes[0].id);
                setEventTypePrice(matchedTypes[0].price);
              } else {
                console.error("No valid event types found for dietitian");
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching dietitian:", err);
        setDietitianError("Failed to load dietitian profile");
      } finally {
        setLoadingDietitian(false);
      }
    };
    
    fetchDietitian();
  }, [slug]);
  
  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setGoogleConnected(true);
          const name = session.user.user_metadata?.name || session.user.user_metadata?.full_name || "";
          const email = session.user.email || "";
          setFormData(prev => ({
            ...prev,
            name: prev.name || name,
            email: prev.email || email,
          }));
        }
      } catch (err) {
        console.error("Error checking session:", err);
      }
    };
    
    checkSession();
    
    // Check URL params for OAuth callback
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const connected = urlParams.get("connected");
      
      if (connected === "true") {
        setGoogleConnected(true);
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
        // Re-check session to get user data
        checkSession();
      }
    }
  }, [supabase]);
  
  // Handle Google OAuth connection
  const handleGoogleConnect = async () => {
    setConnecting(true);
    setAuthError(null);
    
    try {
      // ALWAYS use the current browser origin for OAuth redirects
      const currentOrigin = window.location.origin;
      const currentPath = window.location.pathname;
      
      // Store the redirect path in sessionStorage as backup
      if (typeof window !== "undefined") {
        sessionStorage.setItem("publicBookingRedirect", currentPath);
      }
      
      const callbackUrl = `${currentOrigin}/auth/callback?source=public-booking&redirect=${encodeURIComponent(currentPath)}`;
      
      console.log("🔐 Public Booking OAuth redirect:", callbackUrl);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      
      if (error) {
        setAuthError(error.message);
        setConnecting(false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to connect with Google");
      setConnecting(false);
    }
  };
  
  // Fetch available dates when dietitian is selected
  useEffect(() => {
    if (dietitian?.id && selectedEventTypeId) {
      const fetchAvailableDates = async () => {
        setLoadingDates(true);
        try {
          const startDate = currentMonth.startOf("month").format("YYYY-MM-DD");
          const endDate = currentMonth.endOf("month").format("YYYY-MM-DD");
          const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
          const duration = eventType?.length || 45;
          
          const response = await fetch(
            `/api/availability/timeslots?dietitianId=${dietitian.id}&startDate=${startDate}&endDate=${endDate}&duration=${duration}&eventTypeId=${selectedEventTypeId}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const dates = new Set(
              (data.slots || [])
                .filter((slot: any) => dayjs(slot.start).isSame(currentMonth, "month"))
                .map((slot: any) => dayjs(slot.start).format("D"))
            );
            setAvailableDates(Array.from(dates) as string[]);
          }
        } catch (err) {
          console.error("Error fetching available dates:", err);
        } finally {
          setLoadingDates(false);
        }
      };
      
      fetchAvailableDates();
    }
  }, [dietitian?.id, selectedEventTypeId, currentMonth, availableEventTypes]);
  
  // Fetch time slots when date is selected
  useEffect(() => {
    if (dietitian?.id && selectedDate && selectedEventTypeId) {
      const fetchTimeSlots = async () => {
        setLoadingTimeSlots(true);
        try {
          const dateStr = dayjs(selectedDate).format("YYYY-MM-DD");
          const nextDayStr = dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD");
          const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
          const duration = eventType?.length || 45;
          
          const response = await fetch(
            `/api/availability/timeslots?dietitianId=${dietitian.id}&startDate=${dateStr}&endDate=${nextDayStr}&duration=${duration}&eventTypeId=${selectedEventTypeId}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const slots = (data.slots || [])
              .filter((slot: any) => dayjs(slot.start).isSame(dayjs(selectedDate), "day"))
              .map((slot: any) => dayjs(slot.start).format("HH:mm"));
            setTimeSlots(slots);
          }
        } catch (err) {
          console.error("Error fetching time slots:", err);
        } finally {
          setLoadingTimeSlots(false);
        }
      };
      
      fetchTimeSlots();
    }
  }, [dietitian?.id, selectedDate, selectedEventTypeId, availableEventTypes]);
  
  // Validation
  const validateStep2 = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!googleConnected) {
      errors.google = "Please connect your Google account to continue";
    }
    
    if (!formData.age || formData.age.trim() === "") {
      errors.age = "Age is required";
    } else {
      const ageNum = parseInt(formData.age);
      if (isNaN(ageNum) || ageNum < 18) {
        errors.age = "Age must be at least 18";
      }
    }
    
    if (!formData.occupation?.trim()) {
      errors.occupation = "Occupation is required";
    }
    
    if (!formData.medicalCondition?.trim()) {
      errors.medicalCondition = "Medical condition is required";
    }
    
    if (!formData.monthlyFoodBudget?.trim()) {
      errors.monthlyFoodBudget = "Monthly food budget is required";
    } else {
      const budget = parseFloat(formData.monthlyFoodBudget);
      if (isNaN(budget) || budget < 0) {
        errors.monthlyFoodBudget = "Please enter a valid budget";
      }
    }
    
    return errors;
  };
  
  const handleStep2Continue = () => {
    const errors = validateStep2();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setStep(3);
  };
  
  // Calendar navigation
  const handlePreviousMonth = () => setCurrentMonth(currentMonth.subtract(1, "month"));
  const handleNextMonth = () => setCurrentMonth(currentMonth.add(1, "month"));
  
  const handleDateClick = (day: number) => {
    const date = currentMonth.date(day).toDate();
    setSelectedDate(date);
    setSelectedTime("");
  };
  
  const isDateAvailable = (day: number) => availableDates.includes(String(day));
  const isDateSelected = (day: number) => selectedDate && dayjs(selectedDate).isSame(currentMonth.date(day), "day");
  const isToday = (day: number) => dayjs().isSame(currentMonth.date(day), "day");
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes}${ampm}`;
  };
  
  // Handle checkout
  const handleCheckout = async () => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.email) {
        console.error("Session error:", sessionError);
        alert("Please ensure you are logged in to complete payment.");
        setIsProcessingPayment(false);
        return;
      }
      
      const finalEmail = session.user.email;
      const finalName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || formData.name || "User";
      
      // Validate that we have all required data
      if (!dietitian?.id) {
        alert("Dietitian information is missing. Please refresh the page and try again.");
        setIsProcessingPayment(false);
        return;
      }
      
      if (!selectedEventTypeId) {
        alert("Please select an event type.");
        setIsProcessingPayment(false);
        return;
      }
      
      // Ensure eventTypeId is a UUID (not a slug)
      const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
      if (!eventType) {
        alert("Invalid event type selected. Please refresh the page and try again.");
        setIsProcessingPayment(false);
        return;
      }
      
      // Use the UUID from the matched event type
      const eventTypeUuid = eventType.id;
      
      // Validate it's a UUID format
      if (!eventTypeUuid || eventTypeUuid.length !== 36 || !eventTypeUuid.includes('-')) {
        console.error("Invalid event type ID format:", eventTypeUuid);
        alert("Event type ID is invalid. Please refresh the page and try again.");
        setIsProcessingPayment(false);
        return;
      }
      
      console.log("Creating booking with:", {
        dietitianId: dietitian.id,
        eventTypeId: eventTypeUuid,
        eventTypeSlug: eventType.slug,
        startTime: new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}`).toISOString(),
        email: finalEmail,
        name: finalName,
      });
      
      // Create booking
      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dietitianId: dietitian.id,
          eventTypeId: eventTypeUuid,
          startTime: new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}`).toISOString(),
          name: finalName,
          email: finalEmail,
          notes: formData.complaint,
          userAge: formData.age ? parseInt(formData.age) : null,
          userOccupation: formData.occupation || null,
          userMedicalCondition: formData.medicalCondition || null,
          userMonthlyFoodBudget: formData.monthlyFoodBudget ? parseFloat(formData.monthlyFoodBudget) : null,
          userComplaint: formData.complaint || null,
        }),
      });
      
      console.log("Booking response status:", bookingResponse.status);
      
      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        const bookingId = bookingData.booking?.id;
        
        if (!bookingId) {
          console.error("No booking ID in response:", bookingData);
          alert("Failed to create booking. Please try again.");
          setIsProcessingPayment(false);
          return;
        }
        
        const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
        
        setBookingForPayment({
          id: bookingId,
          description: `${eventType?.title || "Consultation"} with ${dietitian?.name || "Dietitian"}`,
        });
        
        setBookingDetails({
          id: bookingId,
          date: selectedDate,
          time: selectedTime,
          dietician: dietitian?.name || "",
          duration: `${eventType?.length || 45}m`,
          meetingLink: "",
        });
        
        setIsPaymentModalOpen(true);
        setIsProcessingPayment(false);
      } else {
        let errorData;
        try {
          const text = await bookingResponse.text();
          errorData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          errorData = { error: `Server error (${bookingResponse.status})`, details: bookingResponse.statusText };
        }
        
        console.error("Booking creation failed:", {
          status: bookingResponse.status,
          statusText: bookingResponse.statusText,
          error: errorData,
        });
        
        const errorMessage = errorData.details 
          ? `${errorData.error || "Failed to create booking"}: ${errorData.details}`
          : errorData.error || errorData.message || "Failed to create booking. Please try again.";
        
        alert(errorMessage);
        setIsProcessingPayment(false);
      }
    } catch (err) {
      console.error("Error creating booking:", err);
      alert("Failed to create booking. Please try again.");
      setIsProcessingPayment(false);
    }
  };
  
  const handlePaymentSuccess = async () => {
    // Close modal immediately
    setIsPaymentModalOpen(false);
    
    // Attempt to generate Google Meet link after payment
    try {
      if (bookingForPayment?.id) {
        const response = await fetch(`/api/bookings/${bookingForPayment.id}/generate-meet-link`, {
          method: "POST",
          credentials: "include",
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to generate meeting link after payment:", errorData);
          alert(
            errorData.error ||
            "Payment succeeded, but we could not create the meeting link. Please check Upcoming Meetings or try again from the dashboard."
          );
        }
      }
    } catch (err) {
      console.error("Error generating meeting link after payment:", err);
      alert("Payment succeeded, but we could not create the meeting link. Please check Upcoming Meetings later.");
    }
    
    // Clear payment state and move to success step
    setBookingForPayment(null);
    setStep(6);
  };
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "D";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  // Loading state
  if (loadingDietitian) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (dietitianError || !dietitian) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-4">
            {dietitianError || "Dietitian not found"}
          </h1>
          <p className="text-[#9ca3af] mb-6">
            The dietitian profile you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white hover:text-[#FFF4E0] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Main Container - Center Aligned */}
      <div className="w-full max-w-5xl bg-[#171717] border border-[#262626] rounded-lg shadow-xl">
        {/* Step 1 - Profile View */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#262626]">
            {/* Left Column - Dietitian Profile */}
            <div className="p-6 md:p-8 flex flex-col items-center justify-center">
              {/* Profile Image */}
              <div className="w-32 h-32 rounded-full overflow-hidden bg-[#262626] mb-4">
                {dietitian.image ? (
                  <Image
                    src={dietitian.image}
                    alt={dietitian.name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white text-3xl font-semibold">
                      {getInitials(dietitian.name)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Dietitian Info */}
              <div className="text-center">
                <p className="text-sm text-[#9ca3af] mb-1">Daiyet.com</p>
                <h1 className="text-xl font-semibold text-white mb-2">{dietitian.name}</h1>
                <p className="text-sm text-[#9ca3af]">Licensed Dietitian</p>
              </div>
            </div>
            
            {/* Right Column - Professional Summary + Event Types */}
            <div className="p-6 md:p-8">
              {/* Professional Summary */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Professional Summary</h2>
                <p className="text-sm text-[#9ca3af] leading-relaxed">
                  {dietitian.bio || "Professional dietitian ready to help you achieve your health goals with personalized nutrition counseling and meal planning."}
                </p>
              </div>
              
              {/* Event Types */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#D4D4D4] mb-3">Available Services</h3>
                <div className="space-y-2">
                  {availableEventTypes.map((eventType) => {
                    const isSelected = selectedEventTypeId === eventType.id;
                    return (
                      <button
                        key={eventType.id}
                        onClick={() => {
                          setSelectedEventTypeId(eventType.id);
                          setEventTypePrice(eventType.price);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? "border-white bg-[#262626]"
                            : "border-[#262626] hover:border-[#404040]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {eventType.title}
                            </div>
                            <div className="text-xs text-[#9ca3af] mt-1">
                              {eventType.length}m
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-white ml-4">
                            ₦{eventType.price.toLocaleString()}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Service Details */}
              <div className="flex items-center gap-4 text-sm text-[#9ca3af] mb-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{availableEventTypes.find(et => et.id === selectedEventTypeId)?.length || 45}m</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  <span>Google Meet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Africa/Lagos</span>
                </div>
              </div>
              
              {/* Book Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  className="bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black px-6 py-2"
                >
                  Book a Consultation
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 2 - User Info + Google Auth */}
        {step === 2 && (
          <div className="p-6 md:p-8">
            <div className="max-w-xl mx-auto">
              {/* Google Connection */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-4">Connect Your Account</h2>
                {!googleConnected && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-400">
                      <strong>Required:</strong> You must connect your Google account to continue booking.
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {googleConnected ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400">Google Connected</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleGoogleConnect}
                      disabled={connecting}
                      className="bg-white text-black hover:bg-gray-100 flex items-center gap-2"
                    >
                      <GoogleIcon />
                      {connecting ? "Connecting..." : "Continue with Google"}
                    </Button>
                  )}
                </div>
                {authError && (
                  <p className="text-sm text-red-400 mt-2">{authError}</p>
                )}
                {validationErrors.google && !googleConnected && (
                  <p className="text-sm text-red-400 mt-2">{validationErrors.google}</p>
                )}
                <p className="text-xs text-[#9ca3af] mt-3">
                  Connect your Google account to book and manage your consultations.
                </p>
              </div>
              
              {/* User Info Form */}
              <div className="border-t border-[#262626] pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Enter Your Information</h3>
                <div className="space-y-4">
                  {/* Name & Email (auto-filled from Google) */}
                  {googleConnected && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">Name</label>
                        <Input
                          value={formData.name}
                          disabled
                          className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">Email</label>
                        <Input
                          value={formData.email}
                          disabled
                          className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af]"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Age <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => {
                        setFormData({ ...formData, age: e.target.value });
                        if (validationErrors.age) {
                          setValidationErrors(prev => ({ ...prev, age: "" }));
                        }
                      }}
                      className={`bg-[#0a0a0a] border-[#262626] text-white ${validationErrors.age ? "border-red-500" : ""}`}
                      placeholder="Enter your age"
                      min="18"
                    />
                    {validationErrors.age && (
                      <p className="text-xs text-red-400 mt-1">{validationErrors.age}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Occupation <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={formData.occupation}
                      onChange={(e) => {
                        setFormData({ ...formData, occupation: e.target.value });
                        if (validationErrors.occupation) {
                          setValidationErrors(prev => ({ ...prev, occupation: "" }));
                        }
                      }}
                      className={`bg-[#0a0a0a] border-[#262626] text-white ${validationErrors.occupation ? "border-red-500" : ""}`}
                      placeholder="Enter your occupation"
                    />
                    {validationErrors.occupation && (
                      <p className="text-xs text-red-400 mt-1">{validationErrors.occupation}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Medical Condition <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      value={formData.medicalCondition}
                      onChange={(e) => {
                        setFormData({ ...formData, medicalCondition: e.target.value });
                        if (validationErrors.medicalCondition) {
                          setValidationErrors(prev => ({ ...prev, medicalCondition: "" }));
                        }
                      }}
                      rows={3}
                      className={`bg-[#0a0a0a] border-[#262626] text-white ${validationErrors.medicalCondition ? "border-red-500" : ""}`}
                      placeholder="Any medical conditions or health concerns..."
                    />
                    {validationErrors.medicalCondition && (
                      <p className="text-xs text-red-400 mt-1">{validationErrors.medicalCondition}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Monthly Food Budget (NGN) <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="number"
                      value={formData.monthlyFoodBudget}
                      onChange={(e) => {
                        setFormData({ ...formData, monthlyFoodBudget: e.target.value });
                        if (validationErrors.monthlyFoodBudget) {
                          setValidationErrors(prev => ({ ...prev, monthlyFoodBudget: "" }));
                        }
                      }}
                      className={`bg-[#0a0a0a] border-[#262626] text-white ${validationErrors.monthlyFoodBudget ? "border-red-500" : ""}`}
                      placeholder="Enter your monthly food budget"
                      min="0"
                    />
                    {validationErrors.monthlyFoodBudget && (
                      <p className="text-xs text-red-400 mt-1">{validationErrors.monthlyFoodBudget}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                      Additional Notes <span className="text-[#6b7280]">(Optional)</span>
                    </label>
                    <Textarea
                      value={formData.complaint}
                      onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                      rows={3}
                      className="bg-[#0a0a0a] border-[#262626] text-white"
                      placeholder="Tell us about your goals or any special requirements..."
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="bg-transparent border-[#262626] text-white hover:bg-[#262626]"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleStep2Continue}
                    disabled={!googleConnected}
                    className="bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </Button>
                </div>
                {!googleConnected && (
                  <p className="text-sm text-red-400 mt-2 text-center">
                    You must connect your Google account to continue
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Step 3 - Date Selection */}
        {step === 3 && (
          <div className="p-6 md:p-8">
            <div className="max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-white mb-6 text-center">Select a Date</h2>
              
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={handlePreviousMonth} className="text-[#9ca3af] hover:text-white">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="text-sm font-medium text-white">
                  {currentMonth.format("MMMM YYYY")}
                </h3>
                <button onClick={handleNextMonth} className="text-[#9ca3af] hover:text-white">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              
              {/* Days of Week */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="text-xs text-[#9ca3af] text-center py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              {loadingDates ? (
                <div className="text-center py-8 text-[#9ca3af]">Loading availability...</div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-10" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const day = idx + 1;
                    const available = isDateAvailable(day);
                    const selected = isDateSelected(day);
                    const today = isToday(day);
                    
                    return (
                      <button
                        key={day}
                        onClick={() => available && handleDateClick(day)}
                        disabled={!available}
                        className={`h-10 rounded text-sm transition-colors ${
                          selected
                            ? "bg-white text-black font-medium"
                            : available
                            ? "bg-[#262626] text-white hover:bg-[#404040]"
                            : "text-[#9ca3af] opacity-50 cursor-not-allowed"
                        } ${today && !selected ? "ring-1 ring-[#404040]" : ""}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="bg-transparent border-[#262626] text-white hover:bg-[#262626]"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!selectedDate}
                  className="bg-white hover:bg-gray-100 text-black disabled:opacity-50"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 4 - Time Selection */}
        {step === 4 && (
          <div className="p-6 md:p-8">
            <div className="max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-white mb-2">Select Time</h2>
              {selectedDate && (
                <p className="text-sm text-[#9ca3af] mb-6">
                  {dayjs(selectedDate).format("dddd, MMMM D, YYYY")}
                </p>
              )}
              
              {/* Time Slots */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto mb-6">
                {loadingTimeSlots ? (
                  <div className="text-center py-8 text-[#9ca3af]">Loading time slots...</div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-8 text-[#9ca3af]">No available times for this date</div>
                ) : (
                  timeSlots.map((time) => {
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`w-full h-12 rounded text-sm flex items-center gap-2 px-4 transition-colors ${
                          isSelected
                            ? "bg-white text-black font-medium"
                            : "bg-transparent border border-[#262626] text-white hover:bg-[#171717]"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-black" : "bg-green-500"}`} />
                        {formatTime(time)}
                      </button>
                    );
                  })
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(3)}
                  variant="outline"
                  className="bg-transparent border-[#262626] text-white hover:bg-[#262626]"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep(5)}
                  disabled={!selectedTime}
                  className="bg-white hover:bg-gray-100 text-black disabled:opacity-50"
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 5 - Order Summary */}
        {step === 5 && (
          <div className="p-6 md:p-8">
            <div className="max-w-xl mx-auto">
              <h2 className="text-lg font-semibold text-white mb-6">Order Summary</h2>
              
              <div className="border border-[#262626] rounded-lg p-6 space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">Name</span>
                  <span className="text-white">{formData.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">Email</span>
                  <span className="text-white truncate max-w-[200px]">{formData.email}</span>
                </div>
                
                <div className="border-t border-[#262626] pt-3 mt-3" />
                
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">Dietitian</span>
                  <span className="text-white">{dietitian.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">Date</span>
                  <span className="text-white">{selectedDate ? dayjs(selectedDate).format("MMM D, YYYY") : ""}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">Time</span>
                  <span className="text-white">{formatTime(selectedTime)}</span>
                </div>
                <div className="flex justify-between text-sm gap-2">
                  <span className="text-[#9ca3af] flex-shrink-0">Service</span>
                  <span className="text-white truncate text-right">
                    {availableEventTypes.find(et => et.id === selectedEventTypeId)?.title}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#9ca3af]">Duration</span>
                  <span className="text-white">
                    {availableEventTypes.find(et => et.id === selectedEventTypeId)?.length || 45} minutes
                  </span>
                </div>
                
                <div className="border-t border-[#262626] pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-white">Total</span>
                    <span className="text-lg font-semibold text-white">₦{eventTypePrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(4)}
                  variant="outline"
                  className="bg-transparent border-[#262626] text-white hover:bg-[#262626]"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCheckout}
                  disabled={isProcessingPayment}
                  className="bg-white hover:bg-gray-100 text-black disabled:opacity-50"
                >
                  {isProcessingPayment ? "Processing..." : "Proceed to Payment"}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 6 - Success */}
        {step === 6 && bookingDetails && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Booking Confirmed!</h2>
            <p className="text-sm text-[#9ca3af] mb-6">Your booking has been confirmed</p>
            
            <div className="border border-[#262626] rounded-lg p-6 space-y-4 text-left max-w-md mx-auto mb-6">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-[#9ca3af]" />
                <div>
                  <div className="text-xs text-[#9ca3af]">Date</div>
                  <div className="text-sm text-white">
                    {dayjs(bookingDetails.date).format("MMM D, YYYY")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-[#9ca3af]" />
                <div>
                  <div className="text-xs text-[#9ca3af]">Time</div>
                  <div className="text-sm text-white">{formatTime(bookingDetails.time)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-[#9ca3af]" />
                <div>
                  <div className="text-xs text-[#9ca3af]">Meeting</div>
                  <div className="text-sm text-white">Google Meet (link will be sent via email)</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 max-w-md mx-auto">
              <Button
                onClick={() => router.push("/user-dashboard")}
                className="w-full bg-white hover:bg-gray-100 text-black"
              >
                Go to Dashboard
              </Button>
              <Link
                href="/"
                className="block text-sm text-[#9ca3af] hover:text-white transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}
      </div>
      
      {/* Payment Modal */}
      {bookingForPayment && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setBookingForPayment(null);
          }}
          onSuccess={handlePaymentSuccess}
          amount={eventTypePrice}
          currency="NGN"
          description={bookingForPayment.description}
          requestType="CONSULTATION"
          bookingId={bookingForPayment.id}
          userEmail={formData.email}
          userName={formData.name}
        />
      )}
    </div>
  );
}

// Google Icon Component
function GoogleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
        <path fill="#EA4335" d="M24 9.5c3.15 0 5.81 1.08 7.96 2.85l5.95-5.95C33.63 2.3 29.18 0.5 24 0.5 14.7 0.5 6.61 5.97 2.87 13.55l7.12 5.52C12.2 13.9 17.64 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.57-.14-3.07-.39-4.5H24v9h12.65c-.55 2.86-2.2 5.3-4.7 6.93l7.36 5.72C43.77 37.9 46.5 31.7 46.5 24.5z" />
        <path fill="#FBBC05" d="M10.23 28.93A14.46 14.46 0 0 1 9.5 24c0-1.7.29-3.34.79-4.87l-7.12-5.52A23.95 23.95 0 0 0 .5 24c0 3.9.93 7.58 2.57 10.87l7.16-5.94z" />
        <path fill="#34A853" d="M24 47.5c6.5 0 11.94-2.15 15.92-5.85l-7.36-5.72C30.52 37.53 27.42 38.5 24 38.5c-6.36 0-11.8-4.4-13.95-10.5l-7.12 5.52C6.61 42.03 14.7 47.5 24 47.5z" />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
  );
}

export default function PublicProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <PublicProfileContent />
    </Suspense>
  );
}
