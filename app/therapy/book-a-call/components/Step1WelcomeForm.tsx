"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { NIGERIA_STATES } from "@/constants/nigeriaStates";
import Link from "next/link";

interface Step1WelcomeFormProps {
  formData: {
    name: string;
    email: string;
    gender: string;
    phone: string;
    city: string;
    state: string;
  };
  validationErrors: Record<string, string>;
  therapistName?: string;
  onFormDataChange: (data: Partial<Step1WelcomeFormProps["formData"]>) => void;
  onContinue: () => void;
}

// Convert name to slug for URL
function nameToSlug(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function Step1WelcomeForm({
  formData,
  validationErrors,
  therapistName,
  onFormDataChange,
  onContinue,
}: Step1WelcomeFormProps) {
  const therapistSlug = therapistName ? nameToSlug(therapistName) : null;
  const backUrl = therapistSlug ? `/Therapist/${therapistSlug}` : "/therapy";

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Button - Only show if therapist is pre-selected */}
        {therapistName && (
          <div className="mb-6">
            <Link
              href={backUrl}
              className="inline-flex items-center gap-2 text-[#9ca3af] hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {therapistName}'s profile
            </Link>
          </div>
        )}
        
        {/* Welcome Message */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-4">Welcome to Therapy by Daiyet!</h1>
          <p className="text-[#9ca3af] leading-relaxed mb-4">
            We're glad you're taking this step toward prioritizing your wellbeing and appreciate you considering our services.
          </p>
          <p className="text-[#9ca3af] leading-relaxed">
            This form helps us understand your therapy needs and match you with an appropriate therapist from our team.
          </p>
        </div>
        
        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => onFormDataChange({ name: e.target.value })}
              className={`bg-[#0a0a0a] border-[#262626] text-[#f9fafb] ${validationErrors.name ? "border-red-500" : ""}`}
              placeholder="Enter your full name"
            />
            {validationErrors.name && (
              <p className="text-xs text-red-400 mt-1">{validationErrors.name}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => onFormDataChange({ email: e.target.value })}
              className={`bg-[#0a0a0a] border-[#262626] text-[#f9fafb] ${validationErrors.email ? "border-red-500" : ""}`}
              placeholder="Enter your email"
            />
            {validationErrors.email && (
              <p className="text-xs text-red-400 mt-1">{validationErrors.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Gender <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={formData.gender}
                onChange={(e) => onFormDataChange({ gender: e.target.value })}
                className={`w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] ${validationErrors.gender ? "border-red-500" : ""}`}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
            </div>
            {validationErrors.gender && (
              <p className="text-xs text-red-400 mt-1">{validationErrors.gender}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => onFormDataChange({ phone: e.target.value })}
              className={`bg-[#0a0a0a] border-[#262626] text-[#f9fafb] ${validationErrors.phone ? "border-red-500" : ""}`}
              placeholder="Enter your phone number"
            />
            {validationErrors.phone && (
              <p className="text-xs text-red-400 mt-1">{validationErrors.phone}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                City <span className="text-red-400">*</span>
              </label>
              <Input
                value={formData.city}
                onChange={(e) => onFormDataChange({ city: e.target.value })}
                className={`bg-[#0a0a0a] border-[#262626] text-[#f9fafb] ${validationErrors.city ? "border-red-500" : ""}`}
                placeholder="Enter your city"
              />
              {validationErrors.city && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.city}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                State <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.state}
                  onChange={(e) => onFormDataChange({ state: e.target.value })}
                  className={`w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] ${validationErrors.state ? "border-red-500" : ""}`}
                >
                  <option value="">Select state</option>
                  {NIGERIA_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
              </div>
              {validationErrors.state && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.state}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          {therapistName && (
            <Link href={backUrl}>
              <Button
                variant="outline"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
              >
                Back
              </Button>
            </Link>
          )}
          <Button
            onClick={onContinue}
            className="bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black px-6 py-2"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

