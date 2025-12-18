"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import dayjs from "dayjs";
import { PaymentModal } from "@/components/user/payment-modal";
import { StepIndicator } from "./components/StepIndicator";
import { Step1WelcomeForm } from "./components/Step1WelcomeForm";
import { Step2TherapyQuestions } from "./components/Step2TherapyQuestions";
import { Step3TherapistSelection } from "./components/Step3TherapistSelection";
import { Step4DateSelection } from "./components/Step4DateSelection";
import { Step5TimeSelection } from "./components/Step5TimeSelection";
import { Step6OrderSummary } from "./components/Step6OrderSummary";
import { Step7SuccessScreen } from "./components/Step7SuccessScreen";

interface Therapist {
  id: string;
  name: string;
  qualification: string;
  profileImage?: string;
  description: string;
}

// Default therapist event types
const defaultTherapistEventTypes = [
  {
    id: "individual-therapy-mini",
    title: "Individual Therapy Mini",
    slug: "individual-therapy-mini",
    description: "45-minute individual therapy session for personalized mental health support",
    length: 45,
    price: 15000,
    currency: "NGN"
  },
  {
    id: "student-therapy",
    title: "Student Therapy",
    slug: "student-therapy",
    description: "Affordable therapy session designed for students",
    length: 45,
    price: 10000,
    currency: "NGN"
  },
  {
    id: "individual-therapy-max",
    title: "Individual Therapy Max",
    slug: "individual-therapy-max",
    description: "Extended 90-minute individual therapy session for comprehensive mental health support",
    length: 90,
    price: 50000,
    currency: "NGN"
  }
];

function TherapyBookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillTherapistId = searchParams.get("therapistId");
  
  // Always start at step 1, even when therapist is pre-selected
  const initialStep = 1;
  
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(initialStep);
  
  // Form data for Step 1
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    gender: "",
    phone: "",
    city: "",
    state: "",
  });
  
  // Therapy questions for Step 2
  const [therapyData, setTherapyData] = useState({
    whatBringsYou: "",
    specialPreferences: "",
    therapistGenderPreference: "random",
    howDidYouHear: "",
    therapyType: "",
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Supabase client
  const supabase = useMemo(() => createBrowserClient(), []);
  
  // Google OAuth state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Therapist selection
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadingTherapists, setLoadingTherapists] = useState(true);
  const [selectedTherapist, setSelectedTherapist] = useState<string>(prefillTherapistId || "");
  const [viewingProfile, setViewingProfile] = useState<Therapist | null>(null);
  const [therapistName, setTherapistName] = useState<string>("");
  
  // Event type selection
  const [availableEventTypes, setAvailableEventTypes] = useState(defaultTherapistEventTypes);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>(defaultTherapistEventTypes[0].id);
  const [eventTypePrice, setEventTypePrice] = useState<number>(defaultTherapistEventTypes[0].price);
  
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
        window.history.replaceState({}, "", window.location.pathname);
        checkSession();
      }
    }
  }, [supabase]);
  
  // Fetch therapists
  useEffect(() => {
    const fetchTherapists = async () => {
      try {
        setLoadingTherapists(true);
        const response = await fetch("/api/therapists", {
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          const formattedTherapists: Therapist[] = (data.therapists || []).map((therapist: any) => ({
            id: therapist.id,
            name: therapist.name,
            qualification: therapist.qualification || "Licensed Therapist",
            profileImage: therapist.image || undefined,
            description: therapist.description || therapist.bio || "Professional therapist ready to help you achieve your mental health goals.",
          }));
          setTherapists(formattedTherapists);
          
          // If therapist is pre-selected, set the name and ensure selectedTherapist is set
          if (prefillTherapistId) {
            const therapist = formattedTherapists.find(t => t.id === prefillTherapistId);
            if (therapist) {
              setTherapistName(therapist.name);
              setSelectedTherapist(prefillTherapistId);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching therapists:", err);
      } finally {
        setLoadingTherapists(false);
      }
    };
    
    fetchTherapists();
  }, [prefillTherapistId]);
  
  // Fetch event types when therapist is selected
  useEffect(() => {
    if (selectedTherapist) {
      const fetchEventTypes = async () => {
        try {
          const response = await fetch(`/api/event-types?dietitianId=${selectedTherapist}&filter=book-a-call`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            if (data.eventTypes?.length > 0) {
              // Match with default types to get proper pricing
              const matchedTypes = defaultTherapistEventTypes.map(defaultType => {
                const realType = data.eventTypes.find((et: any) => et.slug === defaultType.slug);
                if (realType) {
                  return {
                    ...defaultType,
                    id: realType.id,
                  };
                }
                return defaultType;
              }).filter(type => type.id && type.id.length === 36 && type.id.includes('-'));
              
              if (matchedTypes.length > 0) {
                setAvailableEventTypes(matchedTypes);
                // Use therapy type from step 2 if available, otherwise first type
                const therapyTypeId = therapyData.therapyType || matchedTypes[0].id;
                setSelectedEventTypeId(therapyTypeId);
                const selectedType = matchedTypes.find(et => et.id === therapyTypeId) || matchedTypes[0];
                setEventTypePrice(selectedType.price);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching event types:", err);
        }
      };
      
      fetchEventTypes();
    }
  }, [selectedTherapist, therapyData.therapyType]);
  
  // Fetch available dates when therapist and event type are selected
  useEffect(() => {
    if (selectedTherapist && selectedEventTypeId) {
      const fetchAvailableDates = async () => {
        setLoadingDates(true);
        try {
          const startDate = currentMonth.startOf("month").format("YYYY-MM-DD");
          const endDate = currentMonth.endOf("month").format("YYYY-MM-DD");
          const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
          const duration = eventType?.length || 45;
          
          const response = await fetch(
            `/api/availability/timeslots?dietitianId=${selectedTherapist}&startDate=${startDate}&endDate=${endDate}&duration=${duration}&eventTypeId=${selectedEventTypeId}`
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
  }, [selectedTherapist, selectedEventTypeId, currentMonth, availableEventTypes]);
  
  // Fetch time slots when date is selected
  useEffect(() => {
    if (selectedTherapist && selectedDate && selectedEventTypeId) {
      const fetchTimeSlots = async () => {
        setLoadingTimeSlots(true);
        try {
          const dateStr = dayjs(selectedDate).format("YYYY-MM-DD");
          const nextDayStr = dayjs(selectedDate).add(1, "day").format("YYYY-MM-DD");
          const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
          const duration = eventType?.length || 45;
          
          const response = await fetch(
            `/api/availability/timeslots?dietitianId=${selectedTherapist}&startDate=${dateStr}&endDate=${nextDayStr}&duration=${duration}&eventTypeId=${selectedEventTypeId}`
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
  }, [selectedTherapist, selectedDate, selectedEventTypeId, availableEventTypes]);
  
  // Handle Google OAuth connection
  const handleGoogleConnect = async () => {
    setConnecting(true);
    setAuthError(null);
    
    try {
      const currentOrigin = window.location.origin;
      const currentPath = window.location.pathname;
      
      if (typeof window !== "undefined") {
        sessionStorage.setItem("therapyBookingRedirect", currentPath);
      }
      
      const callbackUrl = `${currentOrigin}/auth/callback?source=therapy-booking&redirect=${encodeURIComponent(currentPath)}`;
      
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
  
  // Validation
  const validateStep1 = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      errors.name = "Name is required";
    }
    
    if (!formData.email?.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!formData.gender) {
      errors.gender = "Gender is required";
    }
    
    if (!formData.phone?.trim()) {
      errors.phone = "Phone number is required";
    }
    
    if (!formData.city?.trim()) {
      errors.city = "City is required";
    }
    
    if (!formData.state) {
      errors.state = "State is required";
    }
    
    return errors;
  };
  
  const validateStep2 = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!therapyData.whatBringsYou?.trim()) {
      errors.whatBringsYou = "Please describe what brings you into therapy";
    }
    
    // Note: therapyType is not required in Step 2 as event type is selected separately
    
    return errors;
  };
  
  const handleStep1Continue = () => {
    const errors = validateStep1();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setStep(2);
  };
  
  const handleStep2Continue = () => {
    const errors = validateStep2();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    // Skip step 3 if therapist is pre-selected
    if (prefillTherapistId) {
      setStep(4);
    } else {
      setStep(3);
    }
  };
  
  // Calendar navigation
  const handlePreviousMonth = () => setCurrentMonth(currentMonth.subtract(1, "month"));
  const handleNextMonth = () => setCurrentMonth(currentMonth.add(1, "month"));
  
  const handleDateClick = (day: number) => {
    const date = currentMonth.date(day).toDate();
    setSelectedDate(date);
    setSelectedTime("");
  };
  
  // Handle checkout
  const handleCheckout = async () => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    
    try {
      // Check if user is authenticated, if not, trigger Google OAuth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.email) {
        // User not authenticated, trigger Google OAuth signup
        await handleGoogleConnect();
        setIsProcessingPayment(false);
        return;
      }
      
      const finalEmail = session.user.email;
      const finalName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || formData.name || "User";
      
      if (!selectedTherapist || !selectedEventTypeId || !selectedDate || !selectedTime) {
        alert("Please complete all booking details");
        setIsProcessingPayment(false);
        return;
      }
      
      // Create booking
      const bookingResponse = await fetch("/api/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dietitianId: selectedTherapist, // Using dietitianId field for therapist (same table structure)
          eventTypeId: selectedEventTypeId,
          startTime: new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}`).toISOString(),
          name: finalName,
          email: finalEmail,
          phone: formData.phone,
          notes: therapyData.whatBringsYou + (therapyData.specialPreferences ? `\n\nSpecial Preferences: ${therapyData.specialPreferences}` : ""),
          userComplaint: therapyData.whatBringsYou,
        }),
      });
      
      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        const bookingId = bookingData.booking?.id;
        
        if (!bookingId) {
          alert("Failed to create booking. Please try again.");
          setIsProcessingPayment(false);
          return;
        }
        
        const eventType = availableEventTypes.find(et => et.id === selectedEventTypeId);
        const therapist = therapists.find(t => t.id === selectedTherapist);
        
        setBookingForPayment({
          id: bookingId,
          description: `${eventType?.title || "Therapy Session"} with ${therapist?.name || "Therapist"}`,
        });
        
        setBookingDetails({
          id: bookingId,
          date: selectedDate,
          time: selectedTime,
          therapist: therapist?.name || "",
          duration: `${eventType?.length || 45}m`,
          meetingLink: bookingData.booking?.meeting_link || "",
        });
        
        setIsPaymentModalOpen(true);
        setIsProcessingPayment(false);
      } else {
        const errorData = await bookingResponse.json().catch(() => ({}));
        alert(errorData.error || "Failed to create booking. Please try again.");
        setIsProcessingPayment(false);
      }
    } catch (err) {
      console.error("Error creating booking:", err);
      alert("Failed to create booking. Please try again.");
      setIsProcessingPayment(false);
    }
  };
  
  // Handle payment success
  const handlePaymentSuccess = async (paymentData: any) => {
    setIsPaymentModalOpen(false);
    setBookingForPayment(null);
    
    // After payment, automatically sign up user via Google OAuth if not already authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      // Trigger Google OAuth signup
      await handleGoogleConnect();
      // Store payment data to show success screen after auth
      sessionStorage.setItem("therapyBookingPaymentData", JSON.stringify(paymentData));
      sessionStorage.setItem("therapyBookingDetails", JSON.stringify(bookingDetails));
      return;
    }
    
    // User is authenticated, show success screen
    setStep(7);
  };
  
  // Check for payment callback after OAuth
  useEffect(() => {
    const checkPaymentCallback = async () => {
      const paymentDataStr = sessionStorage.getItem("therapyBookingPaymentData");
      const bookingDetailsStr = sessionStorage.getItem("therapyBookingDetails");
      
      if (paymentDataStr && bookingDetailsStr) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // User is now authenticated, show success screen
          setBookingDetails(JSON.parse(bookingDetailsStr));
          setStep(7);
          sessionStorage.removeItem("therapyBookingPaymentData");
          sessionStorage.removeItem("therapyBookingDetails");
        }
      }
    };
    
    checkPaymentCallback();
  }, [supabase, step]);
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#171717] border border-[#262626] rounded-lg shadow-xl">
        {/* Step Indicator */}
        {step < 7 && (
          <StepIndicator currentStep={step} prefillTherapistId={prefillTherapistId} />
        )}
        
        {/* Step 1 - Welcome + Form */}
        {step === 1 && (
          <Step1WelcomeForm
            formData={formData}
            validationErrors={validationErrors}
            therapistName={prefillTherapistId ? therapistName : undefined}
            onFormDataChange={(data) => {
              setFormData(prev => ({ ...prev, ...data }));
              // Clear validation errors when user types
              const newErrors = { ...validationErrors };
              Object.keys(data).forEach(key => {
                delete newErrors[key];
              });
              setValidationErrors(newErrors);
            }}
            onContinue={handleStep1Continue}
          />
        )}
        
        {/* Step 2 - Therapy Questions */}
        {step === 2 && (
          <Step2TherapyQuestions
            therapyData={therapyData}
            availableEventTypes={availableEventTypes}
            validationErrors={validationErrors}
            prefillTherapistId={prefillTherapistId || undefined}
            onTherapyDataChange={(data) => {
              setTherapyData(prev => ({ ...prev, ...data }));
              // Clear validation errors when user types
              const newErrors = { ...validationErrors };
              Object.keys(data).forEach(key => {
                delete newErrors[key];
              });
              setValidationErrors(newErrors);
            }}
            onBack={() => setStep(1)}
            onContinue={handleStep2Continue}
          />
        )}
        
        {/* Step 3 - Therapist Selection */}
        {step === 3 && !prefillTherapistId && (
          <Step3TherapistSelection
            therapists={therapists}
            loadingTherapists={loadingTherapists}
            selectedTherapist={selectedTherapist}
            viewingProfile={viewingProfile}
            onTherapistSelect={(id) => {
              setSelectedTherapist(id);
              const therapist = therapists.find(t => t.id === id);
              if (therapist) {
                setTherapistName(therapist.name);
              }
            }}
            onViewProfile={setViewingProfile}
            onCloseProfile={() => setViewingProfile(null)}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
          />
        )}
        
        {/* Step 4 - Date Selection */}
        {step === 4 && (
          <Step4DateSelection
            currentMonth={currentMonth}
            daysInMonth={daysInMonth}
            firstDayOfWeek={firstDayOfWeek}
            daysOfWeek={daysOfWeek}
            availableDates={availableDates}
            selectedDate={selectedDate}
            loadingDates={loadingDates}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onDateClick={handleDateClick}
            onBack={() => {
              if (prefillTherapistId) {
                setStep(2);
              } else {
                setStep(3);
              }
            }}
            onContinue={() => setStep(5)}
          />
        )}
        
        {/* Step 5 - Time Selection */}
        {step === 5 && (
          <Step5TimeSelection
            selectedDate={selectedDate}
            timeSlots={timeSlots}
            selectedTime={selectedTime}
            loadingTimeSlots={loadingTimeSlots}
            onTimeSelect={setSelectedTime}
            onBack={() => setStep(4)}
            onContinue={() => setStep(6)}
          />
        )}
        
        {/* Step 6 - Order Summary */}
        {step === 6 && (
          <Step6OrderSummary
            formData={formData}
            therapyData={therapyData}
            therapistName={therapistName}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            availableEventTypes={availableEventTypes}
            selectedEventTypeId={selectedEventTypeId}
            eventTypePrice={eventTypePrice}
            isProcessingPayment={isProcessingPayment}
            onBack={() => setStep(5)}
            onCheckout={handleCheckout}
          />
        )}
        
        {/* Step 7 - Success Screen */}
        {step === 7 && bookingDetails && (
          <Step7SuccessScreen bookingDetails={bookingDetails} />
        )}
      </div>
      
      {/* Payment Modal */}
      {bookingForPayment && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setBookingForPayment(null);
            setStep(6);
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

export default function TherapyBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading booking page...</div>
      </div>
    }>
      <TherapyBookingContent />
    </Suspense>
  );
}

