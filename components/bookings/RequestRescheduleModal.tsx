"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, X } from "lucide-react";

interface RequestRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  bookingTitle?: string;
}

export function RequestRescheduleModal({
  isOpen,
  onClose,
  onConfirm,
  bookingTitle,
}: RequestRescheduleModalProps) {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-[#262626]">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#262626] flex-shrink-0">
            <Clock className="h-5 w-5 text-[#f9fafb]" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[#f9fafb] mb-1">
              Request reschedule
            </h2>
            <p className="text-sm text-[#9ca3af]">
              This will cancel the scheduled meeting, notify the scheduler and ask them to pick a new time.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-[#9ca3af] hover:text-[#f9fafb] transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Reason for reschedule request (Optional)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a reason..."
              rows={4}
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-[#404040] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#262626]">
          <Button
            variant="outline"
            onClick={handleClose}
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#1a1a1a] hover:bg-[#262626] text-[#f9fafb] border border-[#262626] px-4 py-2"
          >
            Request reschedule
          </Button>
        </div>
      </div>
    </div>
  );
}
