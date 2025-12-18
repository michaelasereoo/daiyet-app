"use client";

import { Button } from "@/components/ui/button";
import dayjs from "dayjs";

interface Step6OrderSummaryProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  };
  therapyData: {
    therapyType: string;
  };
  therapistName: string;
  selectedDate: Date | null;
  selectedTime: string;
  availableEventTypes: Array<{
    id: string;
    title: string;
    length: number;
    price: number;
  }>;
  selectedEventTypeId: string;
  eventTypePrice: number;
  isProcessingPayment: boolean;
  onBack: () => void;
  onCheckout: () => void;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${ampm}`;
}

export function Step6OrderSummary({
  formData,
  therapyData,
  therapistName,
  selectedDate,
  selectedTime,
  availableEventTypes,
  selectedEventTypeId,
  eventTypePrice,
  isProcessingPayment,
  onBack,
  onCheckout,
}: Step6OrderSummaryProps) {
  const selectedEventType = availableEventTypes.find(et => et.id === selectedEventTypeId || et.id === therapyData.therapyType);
  
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">Order Summary</h2>
        
        <div className="border border-[#262626] rounded-lg p-6 space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Name</span>
            <span className="text-[#f9fafb]">{formData.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Email</span>
            <span className="text-[#f9fafb] truncate max-w-[200px]">{formData.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Phone</span>
            <span className="text-[#f9fafb]">{formData.phone}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Location</span>
            <span className="text-[#f9fafb]">{formData.city}, {formData.state}</span>
          </div>
          
          <div className="border-t border-[#262626] pt-3 mt-3" />
          
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Therapist</span>
            <span className="text-[#f9fafb]">{therapistName || "Not selected"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Date</span>
            <span className="text-[#f9fafb]">
              {selectedDate ? dayjs(selectedDate).format("MMM D, YYYY") : ""}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Time</span>
            <span className="text-[#f9fafb]">{formatTime(selectedTime)}</span>
          </div>
          <div className="flex justify-between text-sm gap-2">
            <span className="text-[#9ca3af] flex-shrink-0">Therapy Type</span>
            <span className="text-[#f9fafb] truncate text-right">
              {selectedEventType?.title || "Not selected"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9ca3af]">Duration</span>
            <span className="text-[#f9fafb]">
              {selectedEventType?.length || 45} minutes
            </span>
          </div>
          
          <div className="border-t border-[#262626] pt-3 mt-3">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-[#f9fafb]">Total</span>
              <span className="text-lg font-semibold text-[#f9fafb]">₦{eventTypePrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
          >
            Back
          </Button>
          <Button
            onClick={onCheckout}
            disabled={isProcessingPayment}
            className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
          >
            {isProcessingPayment ? "Processing..." : "Proceed to Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

