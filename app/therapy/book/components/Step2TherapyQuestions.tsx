"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface Step2TherapyQuestionsProps {
  therapyData: {
    whatBringsYou: string;
    specialPreferences: string;
    therapistGenderPreference: string;
    howDidYouHear: string;
    therapyType: string;
  };
  availableEventTypes: Array<{
    id: string;
    title: string;
    slug: string;
    description: string;
    length: number;
    price: number;
    currency: string;
  }>;
  validationErrors: Record<string, string>;
  prefillTherapistId?: string;
  onTherapyDataChange: (data: Partial<Step2TherapyQuestionsProps["therapyData"]>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Step2TherapyQuestions({
  therapyData,
  availableEventTypes,
  validationErrors,
  prefillTherapistId,
  onTherapyDataChange,
  onBack,
  onContinue,
}: Step2TherapyQuestionsProps) {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-white mb-6">Tell Us About Your Therapy Needs</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Please describe what brings you into therapy and what you're hoping to gain <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={therapyData.whatBringsYou}
              onChange={(e) => onTherapyDataChange({ whatBringsYou: e.target.value })}
              rows={5}
              className={`bg-[#0a0a0a] border-[#262626] text-[#f9fafb] ${validationErrors.whatBringsYou ? "border-red-500" : ""}`}
              placeholder="Tell us about your concerns, goals, and what you hope to achieve through therapy..."
            />
            {validationErrors.whatBringsYou && (
              <p className="text-xs text-red-400 mt-1">{validationErrors.whatBringsYou}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Any special preferences we should be aware of? <span className="text-[#6b7280]">(Optional)</span>
            </label>
            <Textarea
              value={therapyData.specialPreferences}
              onChange={(e) => onTherapyDataChange({ specialPreferences: e.target.value })}
              rows={3}
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
              placeholder="Any accessibility needs, communication preferences, or other considerations..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Therapist Gender Preference
              {prefillTherapistId && (
                <span className="text-xs text-[#6b7280] ml-2">(Therapist already selected)</span>
              )}
            </label>
            <div className="relative">
              <select
                value={therapyData.therapistGenderPreference}
                onChange={(e) => onTherapyDataChange({ therapistGenderPreference: e.target.value })}
                disabled={!!prefillTherapistId}
                className={`w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] ${
                  prefillTherapistId ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <option value="random">No preference (Random)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
            </div>
            {prefillTherapistId && (
              <p className="text-xs text-[#6b7280] mt-1">
                A therapist has been pre-selected for you. This preference will not be used.
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              How did you hear about Therapy by Daiyet? <span className="text-[#6b7280]">(Optional)</span>
            </label>
            <div className="relative">
              <select
                value={therapyData.howDidYouHear}
                onChange={(e) => onTherapyDataChange({ howDidYouHear: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
              >
                <option value="">Select an option</option>
                <option value="google">Google Search</option>
                <option value="social-media">Social Media</option>
                <option value="friend-family">Friend or Family</option>
                <option value="referral">Professional Referral</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <Button
            onClick={onBack}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
          >
            Back
          </Button>
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

