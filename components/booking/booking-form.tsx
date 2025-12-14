"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BookingFormProps {
  eventType: {
    id: string;
    title: string;
    description?: string;
    length: number;
    price: number;
    currency?: string;
  };
  selectedDate?: Date;
  selectedTime?: string;
  onSubmit: (data: {
    age?: number;
    occupation?: string;
    medicalCondition?: string;
    monthlyFoodBudget?: number;
    complaint?: string;
  }) => void;
  isLoading?: boolean;
  initialAge?: number;
  initialOccupation?: string;
  initialMedicalCondition?: string;
  initialMonthlyFoodBudget?: number;
}

export function BookingForm({
  eventType,
  onSubmit,
  isLoading,
  initialAge,
  initialOccupation,
  initialMedicalCondition,
  initialMonthlyFoodBudget,
}: BookingFormProps) {
  const [formData, setFormData] = useState({
    age: initialAge || undefined,
    occupation: initialOccupation || "",
    medicalCondition: initialMedicalCondition || "",
    monthlyFoodBudget: initialMonthlyFoodBudget || undefined,
    complaint: "",
  });

  // Update form data when initial values change (e.g., from profile)
  useEffect(() => {
    if (initialAge !== undefined) {
      setFormData(prev => ({ ...prev, age: initialAge }));
    }
    if (initialOccupation) {
      setFormData(prev => ({ ...prev, occupation: initialOccupation }));
    }
    if (initialMedicalCondition) {
      setFormData(prev => ({ ...prev, medicalCondition: initialMedicalCondition }));
    }
    if (initialMonthlyFoodBudget !== undefined) {
      setFormData(prev => ({ ...prev, monthlyFoodBudget: initialMonthlyFoodBudget }));
    }
  }, [initialAge, initialOccupation, initialMedicalCondition, initialMonthlyFoodBudget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#f9fafb]">Enter your information</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="age" className="text-[#f9fafb]">
            Age <span className="text-red-500">*</span>
          </Label>
          <Input
            id="age"
            type="number"
            required
            value={formData.age || ""}
            onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Enter your age"
            className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#6b7280] focus:border-[#404040]"
            min="1"
            max="120"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation" className="text-[#f9fafb]">
            Occupation <span className="text-red-500">*</span>
          </Label>
          <Input
            id="occupation"
            type="text"
            required
            value={formData.occupation}
            onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
            placeholder="Enter your occupation"
            className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#6b7280] focus:border-[#404040]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="medicalCondition" className="text-[#f9fafb]">
            Medical Condition <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="medicalCondition"
            required
            value={formData.medicalCondition}
            onChange={(e) => setFormData({ ...formData, medicalCondition: e.target.value })}
            placeholder="Any medical conditions or health concerns..."
            rows={4}
            className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#6b7280] focus:border-[#404040] resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthlyFoodBudget" className="text-[#f9fafb]">
            Monthly Food Budget (NGN) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="monthlyFoodBudget"
            type="number"
            required
            value={formData.monthlyFoodBudget || ""}
            onChange={(e) => setFormData({ ...formData, monthlyFoodBudget: e.target.value ? parseFloat(e.target.value) : undefined })}
            placeholder="Enter your monthly food budget"
            className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#6b7280] focus:border-[#404040]"
            min="0"
            step="1000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="complaint" className="text-[#f9fafb]">
            Additional Notes <span className="text-[#6b7280]">(Optional)</span>
          </Label>
          <Textarea
            id="complaint"
            value={formData.complaint}
            onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
            placeholder="Tell us about your concerns, goals, or any special requirements..."
            rows={4}
            className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#6b7280] focus:border-[#404040] resize-none"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            className="bg-white hover:bg-gray-100 text-black px-6 py-2 font-medium" 
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
