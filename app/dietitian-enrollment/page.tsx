"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, X } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Step = 1 | 2 | 3;

const experiences = ["0-1", "1-3", "3-5", "5-10", "10+"];
const specializations = [
  "Weight management",
  "Sports nutrition",
  "Pediatrics",
  "Clinical/medical",
  "Plant-based",
  "General wellness",
];

export default function DietitianEnrollmentPage() {
  // Create Supabase client instance (only in browser)
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return createBrowserClient();
  }, []);
  
  const [step, setStep] = useState<Step>(1);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(true);
  const [emailExistsModalOpen, setEmailExistsModalOpen] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");

  const [licenseNumber, setLicenseNumber] = useState("");
  const [experience, setExperience] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [bio, setBio] = useState("");

  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const termsRef = useRef<HTMLDivElement | null>(null);
  const privacyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!supabase) return; // Wait for client to be ready
    
    const init = async () => {
      // Safety timeout - always clear loading state after 8 seconds max
      const safetyTimeout = setTimeout(() => {
        console.warn("Enrollment check taking too long, clearing loading state");
        setCheckingEnrollment(false);
      }, 8000);
      
      try {
        setCheckingEnrollment(true);
        console.log("Starting enrollment check...");
        
        // Check if returning from OAuth callback
        if (typeof window === 'undefined') {
          clearTimeout(safetyTimeout);
          setCheckingEnrollment(false);
          return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const connected = urlParams.get("connected");
        
        if (connected) {
          console.log("Returning from OAuth, cleaning up URL...");
          // Clean up URL
          window.history.replaceState({}, "", window.location.pathname);
          // Small delay to ensure session cookies are set after OAuth redirect
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log("Getting session...");
        // Try to get session with retry logic
        let session = null;
        let sessionError = null;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await Promise.race([
              supabase.auth.getSession(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Session timeout")), 3000)
              )
            ]) as any;
            
            session = result.data?.session;
            sessionError = result.error;
            
            if (session || !connected) {
              console.log("Session retrieved:", session ? "yes" : "no");
              break; // Got session or not returning from OAuth
            }
            
            // Wait a bit before retrying (only if returning from OAuth)
            if (connected && attempt < 2) {
              console.log(`Session not available, retrying... (attempt ${attempt + 1})`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          } catch (timeoutErr) {
            console.error("Session retrieval timeout:", timeoutErr);
            if (attempt === 2) {
              sessionError = timeoutErr as any;
            }
          }
        }
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setError("Failed to get session. Please try signing in again.");
          clearTimeout(safetyTimeout);
          setCheckingEnrollment(false);
          return;
        }
        
        if (session?.user) {
          console.log("User session found, checking enrollment status...");
          
          // Check if user already has DIETITIAN role
          try {
            const roleCheckResponse = await fetch("/api/check-enrollment");
            if (roleCheckResponse.ok) {
              const enrollmentData = await roleCheckResponse.json();
              if (enrollmentData.enrolled && enrollmentData.role === "DIETITIAN") {
                // User is already a dietitian - redirect to dashboard
                console.log("User is already enrolled as DIETITIAN, redirecting to dashboard");
                window.location.href = "/dashboard";
                return;
              }
            }
          } catch (roleCheckError) {
            console.warn("Error checking enrollment status:", roleCheckError);
            // Continue with enrollment form if role check fails
          }
          
          // User doesn't have DIETITIAN role - proceed with enrollment form
          setGoogleConnected(true);
          const name =
            (session.user.user_metadata as any)?.full_name ||
            session.user.user_metadata?.name ||
            "";
          const mail = session.user.email || "";
          setFullName((prev) => prev || name);
          setEmail((prev) => prev || mail);
          console.log("Enrollment check complete, showing form");
        } else {
          // No session - clear loading state
          console.log("No session found");
          setError("No active session. Please connect with Google first.");
          clearTimeout(safetyTimeout);
          setCheckingEnrollment(false);
          return;
        }
      } catch (err: any) {
        // Catch any unexpected errors
        console.error("Unexpected error in enrollment init:", err);
        setError("An error occurred. Please refresh the page and try again.");
      } finally {
        clearTimeout(safetyTimeout);
        setCheckingEnrollment(false);
      }
    };
    void init();
  }, [supabase]);

  // Don't render until client is ready
  if (!supabase) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const checkEmailExists = async (emailToCheck: string): Promise<boolean> => {
    if (!emailToCheck || !emailToCheck.trim()) return false;
    
    setCheckingEmail(true);
    try {
      const response = await fetch("/api/dietitians/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailToCheck.trim() }),
      });

      const data = await response.json();
      
      if (data.exists) {
        setEmailExistsModalOpen(true);
        setCheckingEmail(false);
        return true;
      }
      
      setCheckingEmail(false);
      return false;
    } catch (err) {
      console.error("Error checking email:", err);
      setCheckingEmail(false);
      return false; // Allow OAuth to proceed if check fails
    }
  };

  const handleGoogle = async () => {
    if (!supabase) return;
    
    setConnecting(true);
    setError(null);
    
    // Check if email exists before initiating OAuth
    if (email && email.trim()) {
      const emailExists = await checkEmailExists(email);
      if (emailExists) {
        setConnecting(false);
        return; // Don't proceed with OAuth if email exists
      }
    }
    
    try {
      // Use NEXT_PUBLIC_SITE_URL if available (for production), otherwise use window.location.origin
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback?source=dietitian-enrollment`,
        },
      });

      if (error) {
        // Check if user already exists
        const errorMessage = error.message?.toLowerCase() || "";
        if (
          errorMessage.includes("already registered") ||
          errorMessage.includes("user already exists") ||
          errorMessage.includes("email already") ||
          error.code === "user_already_registered"
        ) {
          setError(
            <>
              This Google account is already registered. Please{" "}
              <a
                href="/dietitian-login"
                className="underline text-white hover:text-white/80 font-medium"
              >
                go to login
              </a>{" "}
              to sign in.
            </>
          );
        } else {
        setError(error.message);
        }
        setConnecting(false);
      }
      // OAuth will redirect, so we don't need to handle success here
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect with Google";
      const lowerMessage = errorMessage.toLowerCase();
      
      if (
        lowerMessage.includes("already registered") ||
        lowerMessage.includes("user already exists") ||
        lowerMessage.includes("email already")
      ) {
        setError(
          <>
            This Google account is already registered. Please{" "}
            <a
              href="/dietitian-login"
              className="underline text-white hover:text-white/80 font-medium"
            >
              go to login
            </a>{" "}
            to sign in.
          </>
        );
      } else {
        setError(errorMessage);
      }
      setConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!supabase) return;
    
    setError(null);
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        setError(error.message);
        return;
      }

      // Reset Google connection state and clear form fields
      setGoogleConnected(false);
      setFullName("");
      setEmail("");
      // Keep other fields as user might want to keep them
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Google");
    }
  };

  const bioWordCount = useMemo(() => {
    return bio.trim() === "" ? 0 : bio.trim().split(/\s+/).length;
  }, [bio]);

  const stepOneValid =
    googleConnected &&
    fullName.trim() &&
    email.trim() &&
    phone.trim() &&
    dob &&
    location.trim() &&
    profilePicture;

  const stepTwoValid =
    licenseNumber.trim() &&
    experience &&
    specialization.trim() &&
    bio.trim() &&
    bioWordCount <= 100;

  const stepThreeValid =
    googleConnected && stepOneValid && stepTwoValid && termsRead && privacyRead && confirmChecked;

  const handleSubmit = async () => {
    if (!stepThreeValid) {
      // Provide specific feedback on what's missing
      const missing = [];
      if (!googleConnected) missing.push("Google connection");
      if (!stepOneValid) missing.push("Step 1 fields");
      if (!stepTwoValid) missing.push("Step 2 fields");
      if (!termsRead) missing.push("Terms of Service (scroll to bottom)");
      if (!privacyRead) missing.push("Privacy Policy (scroll to bottom)");
      if (!confirmChecked) missing.push("Confirmation checkbox");
      setError(`Cannot submit: ${missing.join(", ")}`);
      return;
    }
    
    setError(null);
    setSubmitted(false);
    setSubmitting(true);

    if (!supabase) return;
    
    try {
      // Verify session before proceeding
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError("Session expired. Please connect with Google again.");
        setGoogleConnected(false);
        setSubmitting(false);
        return;
      }

      // Convert profile picture to base64 if available
      let profilePictureBase64 = null;
      if (profilePicture) {
        const reader = new FileReader();
        profilePictureBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(profilePicture);
        });
      }

      // Submit enrollment data
      const response = await fetch("/api/dietitians/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          dob,
          location,
          profilePicture: profilePictureBase64,
          licenseNumber,
          experience,
          specialization,
          bio,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // If response is not JSON, get text
        const text = await response.text();
        console.error("Failed to parse response:", text);
        setError(`Server error: ${text || response.statusText}`);
        setSubmitting(false);
        return;
      }

      if (!response.ok) {
        console.error("Enrollment error:", {
          status: response.status,
          statusText: response.statusText,
          error: data?.error,
          details: data?.details,
        });
        const errorMessage = data?.details 
          ? `${data.error || "Error"}: ${data.details}` 
          : data?.error || `Failed to submit enrollment (${response.status})`;
        setError(errorMessage);
        setSubmitting(false);
        return;
      }

    setSubmitting(false);
    setSubmitted(true);
    
    // Redirect to dashboard after successful enrollment (user is already authenticated)
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit enrollment");
      setSubmitted(false);
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && stepOneValid) setStep(2);
    if (step === 2 && stepTwoValid) setStep(3);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const onScrollCheck = (ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
    const el = ref.current;
    if (!el) return;
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (reachedBottom) setter(true);
  };

  return (
    <div className="relative min-h-screen bg-[#0b0b0b] text-white overflow-hidden flex items-center justify-center px-4 sm:px-6 md:px-8 py-10 md:py-12">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "140px 140px",
          maskImage:
            "radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 75%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 75%)",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl xl:max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left column: Steps */}
        <div className="lg:col-span-1 space-y-4 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </div>
          <div className="text-xs md:text-sm text-white/60">Dietitian enrollment</div>
          <h1 className="text-xl md:text-2xl font-semibold leading-tight">3-step application</h1>

          {/* Progress tracker */}
          <div className="pt-4">
            <div className="flex flex-col gap-3">
              {[
                { id: 1, title: "Basic information", short: "Step 1" },
                { id: 2, title: "Professional details", short: "Step 2" },
                { id: 3, title: "Agreement & submit", short: "Step 3" },
              ].map((item, idx) => {
                const active = step === item.id;
                const done = step > item.id;
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div
                      className={`relative flex items-center gap-3 ${
                        active || done ? "text-white" : "text-white/60"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 md:h-9 md:w-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                          active
                            ? "bg-white text-black"
                            : done
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-white/10 text-white/70"
                        }`}
                      >
                        {item.id}
                      </div>
                      <div className="hidden md:block text-sm font-medium">
                        <span className="md:hidden">{item.short}</span>
                        <span className="hidden md:inline xl:hidden">{item.short}</span>
                        <span className="hidden xl:inline">{item.title}</span>
                      </div>
                      <div className="md:hidden text-xs font-medium">{item.id}</div>
                    </div>
                    {idx < 2 && (
                      <div className="hidden xl:block flex-1 h-px bg-white/15 ml-1 mr-4" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-4 text-[11px] md:text-xs text-white/60">
            Cannot proceed past Step 1 without Google. Submit disabled until all requirements are
            met.
          </div>
        </div>

        {/* Right column: Form */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-7 lg:p-8 backdrop-blur-sm shadow-2xl shadow-black/40">
          {checkingEnrollment ? (
            <div className="flex flex-col items-center text-center space-y-4 py-10 md:py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <h2 className="text-2xl font-semibold">Checking enrollment status...</h2>
              <p className="text-white/70 max-w-xl text-sm md:text-base">
                Please wait while we verify your account.
              </p>
            </div>
          ) : submitted ? (
            <div className="flex flex-col items-center text-center space-y-4 py-10 md:py-12">
              <CheckCircle2 className="h-12 w-12 text-emerald-300" />
              <h2 className="text-2xl font-semibold">Enrollment successful!</h2>
              <p className="text-white/70 max-w-xl text-sm md:text-base">
                You'll be redirected to your dashboard shortly.
              </p>
              <p className="text-white/50 max-w-xl text-xs md:text-sm">
                If you don't see the email, please check your spam folder.
              </p>
            </div>
          ) : (
            <>
              {/* Step 1 */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-semibold">Step 1: Basic information</h2>
                      <p className="text-white/60 text-sm">
                        Connect Google, then complete your profile basics.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {googleConnected ? (
                        <>
                          <Button
                            onClick={handleDisconnectGoogle}
                            variant="outline"
                            className="h-12 w-full sm:w-auto px-5 border-white/20 text-white hover:bg-white/10 inline-flex items-center justify-center gap-2"
                          >
                            <GoogleIcon />
                            Disconnect Google
                          </Button>
                          <Button
                            disabled
                            className="h-12 w-full sm:w-auto px-5 bg-emerald-500 text-black cursor-not-allowed inline-flex items-center justify-center gap-2"
                          >
                            <GoogleIcon />
                            Google connected
                          </Button>
                        </>
                      ) : (
                    <Button
                      onClick={handleGoogle}
                          disabled={connecting}
                          className="h-12 w-full sm:w-auto px-5 bg-white text-black hover:bg-white/90 inline-flex items-center justify-center gap-2"
                        >
                          <GoogleIcon />
                          {connecting ? "Connecting..." : "Continue with Google"}
                    </Button>
                      )}
                    </div>
                  </div>
                  {error && <div className="text-sm text-red-300">{error}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Full name</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Email address</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Phone number</Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                        placeholder="+234 ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Date of birth</Label>
                      <Input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <Label className="text-white/80 text-sm">Location (City, State)</Label>
                      <Input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                        placeholder="Lagos, Nigeria"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-1">
                      <Label className="text-white/80 text-sm">Profile picture</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                      />
                      {profilePicture && (
                        <div className="text-xs text-white/60 truncate">{profilePicture.name}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                    <div className="text-sm text-white/60">
                      You must connect Google before continuing.
                    </div>
                    <Button
                      disabled={!stepOneValid}
                      onClick={handleNext}
                      className="bg-white text-black hover:bg-white/90 h-12 w-full sm:w-auto"
                    >
                      Continue to Step 2 →
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-semibold">Step 2: Professional details</h2>
                      <p className="text-white/60 text-sm">
                        Four quick questions to validate your credentials.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="border-white/20 text-white hover:bg-white/10 h-11"
                      >
                        ← Back
                      </Button>
                      <Button
                        disabled={!stepTwoValid}
                        onClick={handleNext}
                        className="bg-white text-black hover:bg-white/90 h-11"
                      >
                        Continue to Step 3 →
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">License number</Label>
                      <Input
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[52px]"
                        placeholder="State-issued license"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Years of experience</Label>
                      <select
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        className="w-full rounded-md bg-[#0b0b0b] border border-[#1f1f1f] text-white px-3 py-3 min-h-[52px]"
                      >
                        <option value="">Select</option>
                        {experiences.map((exp) => (
                          <option key={exp} value={exp}>
                            {exp}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Primary specialization</Label>
                      <select
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        className="w-full rounded-md bg-[#0b0b0b] border border-[#1f1f1f] text-white px-3 py-3 min-h-[52px]"
                      >
                        <option value="">Select specialization</option>
                        {specializations.map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-white/80 text-sm">Professional bio (100 words max)</Label>
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="bg-[#0b0b0b] border-[#1f1f1f] text-white min-h-[160px]"
                        placeholder="Briefly describe your background, approach, and focus areas."
                      />
                      <div
                        className={`text-xs ${
                          bioWordCount > 100 ? "text-red-300" : "text-white/60"
                        }`}
                      >
                        {bioWordCount} / 100 words
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-semibold">Step 3: Agreement & submit</h2>
                      <p className="text-white/60 text-sm">
                        Read both documents fully, then confirm to submit.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="border-white/20 text-white hover:bg-white/10 h-11"
                      >
                        ← Back
                      </Button>
                      <Button
                        disabled={!stepThreeValid || submitting}
                        className="bg-white text-black hover:bg-white/90 h-11"
                        onClick={handleSubmit}
                      >
                        {submitting ? (
                          <span className="inline-flex items-center gap-2">
                            <svg
                              className="animate-spin h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Submitting...
                          </span>
                        ) : (
                          "Submit application"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Terms of Service</Label>
                      <div
                        ref={termsRef}
                        onScroll={() => onScrollCheck(termsRef, setTermsRead)}
                        className="h-44 md:h-52 overflow-y-auto rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-4 text-sm text-white/70"
                      >
                        <p className="mb-2">
                          Please review these terms. By applying, you agree to abide by Daiyet&apos;s
                          standards of practice, maintain accurate availability, and honor bookings made
                          by patients. You consent to communication for scheduling, reminders, and
                          compliance needs. You agree to keep patient data confidential and use the
                          platform only for its intended purpose. Violations may lead to suspension or
                          removal. Payments and cancellations will follow platform policies. Continue
                          scrolling to confirm you have read this section.
                        </p>
                        <p>
                          You certify that all information you provide is accurate and up to date. You
                          acknowledge that Daiyet may verify your credentials and take action if any
                          misrepresentation is found. These terms may be updated; continued use indicates
                          acceptance. Please contact support with any questions before proceeding.
                        </p>
                      </div>
                      <div className="text-xs text-white/60">
                        Status: {termsRead ? "read" : "scroll to bottom to mark read"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Privacy Policy</Label>
                      <div
                        ref={privacyRef}
                        onScroll={() => onScrollCheck(privacyRef, setPrivacyRead)}
                        className="h-44 md:h-52 overflow-y-auto rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-4 text-sm text-white/70"
                      >
                        <p className="mb-2">
                          We collect your profile, licensing, scheduling, and communications data to
                          operate the platform. We do not sell personal data. Information may be shared
                          with patients for scheduling, with payment processors for payouts, and with
                          compliance vendors as needed. Security measures are applied to protect data,
                          but you should also safeguard your account.
                        </p>
                        <p>
                          You may request data access or deletion as permitted by law. Usage is subject
                          to ongoing compliance and audit. Continue scrolling to confirm you have read
                          this section.
                        </p>
                      </div>
                      <div className="text-xs text-white/60">
                        Status: {privacyRead ? "read" : "scroll to bottom to mark read"}
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={confirmChecked}
                      onChange={(e) => setConfirmChecked(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border border-white/50 bg-transparent"
                    />
                    <span>I have read and understood both documents.</span>
                  </label>

                  <div className="text-xs text-white/60">
                    Submit is disabled until: Google is connected, all fields in Steps 1-2 are
                    completed, both documents are fully read, and the confirmation box is checked.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Email Exists Modal */}
      {emailExistsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-md p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#f9fafb]">Email Already Registered</h2>
              <button
                onClick={() => setEmailExistsModalOpen(false)}
                className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[#D4D4D4] mb-6">
              This email is already registered. Please go to login to access your account.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEmailExistsModalOpen(false)}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/dietitian-login";
                  }
                }}
                className="flex-1 bg-white text-black hover:bg-white/90"
              >
                Go to Login
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="w-4 h-4"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.15 0 5.81 1.08 7.96 2.85l5.95-5.95C33.63 2.3 29.18 0.5 24 0.5 14.7 0.5 6.61 5.97 2.87 13.55l7.12 5.52C12.2 13.9 17.64 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.5 24.5c0-1.57-.14-3.07-.39-4.5H24v9h12.65c-.55 2.86-2.2 5.3-4.7 6.93l7.36 5.72C43.77 37.9 46.5 31.7 46.5 24.5z"
        />
        <path
          fill="#FBBC05"
          d="M10.23 28.93A14.46 14.46 0 0 1 9.5 24c0-1.7.29-3.34.79-4.87l-7.12-5.52A23.95 23.95 0 0 0 .5 24c0 3.9.93 7.58 2.57 10.87l7.16-5.94z"
        />
        <path
          fill="#34A853"
          d="M24 47.5c6.5 0 11.94-2.15 15.92-5.85l-7.36-5.72C30.52 37.53 27.42 38.5 24 38.5c-6.36 0-11.8-4.4-13.95-10.5l-7.12 5.52C6.61 42.03 14.7 47.5 24 47.5z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
  );
}
