"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Calendar } from "lucide-react";

interface CreateSessionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Meal plan types with pricing
const MEAL_PLAN_TYPES = [
  { id: "7-day", name: "7-day meal plan", price: 10000, currency: "NGN" },
  { id: "14-day", name: "14-day meal plan", price: 16000, currency: "NGN" },
  { id: "1-month", name: "1 month meal plan", price: 20000, currency: "NGN" },
  { id: "smoothie", name: "Smoothie recipe", price: 8000, currency: "NGN" },
];

interface Client {
  id: string;
  name: string;
  email: string;
}

export function CreateSessionRequestModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSessionRequestModalProps) {
  const [requestType, setRequestType] = useState<"CONSULTATION" | "MEAL_PLAN">("CONSULTATION");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [mealPlanType, setMealPlanType] = useState("");
  const [eventTypes, setEventTypes] = useState<Array<{ id: string; title: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients when modal opens
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const response = await fetch("/api/session-request/clients", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (err) {
        console.error("Error fetching clients:", err);
      } finally {
        setLoadingClients(false);
      }
    };

    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  // Fetch event types on mount
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const response = await fetch("/api/event-types", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setEventTypes(data.eventTypes || []);
          if (data.eventTypes && data.eventTypes.length > 0) {
            setEventTypeId(data.eventTypes[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching event types:", err);
      }
    };

    if (isOpen) {
      fetchEventTypes();
    }
  }, [isOpen]);

  // Auto-populate name/email when client is selected
  useEffect(() => {
    if (selectedClientId) {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        setClientName(selectedClient.name);
        setClientEmail(selectedClient.email);
      }
    } else {
      setClientName("");
      setClientEmail("");
    }
  }, [selectedClientId, clients]);

  const handleClose = () => {
    setRequestType("CONSULTATION");
    setSelectedClientId(null);
    setClientName("");
    setClientEmail("");
    setMessage("");
    setEventTypeId("");
    setMealPlanType("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!clientName || !clientEmail) {
        setError("Client name and email are required");
        setIsSubmitting(false);
        return;
      }

      if (requestType === "CONSULTATION") {
        if (!eventTypeId || !requestedDate || !requestedTime) {
          setError("Event type, date, and time are required for consultation requests");
          setIsSubmitting(false);
          return;
        }
      } else {
        if (!mealPlanType) {
          setError("Meal plan type is required");
          setIsSubmitting(false);
          return;
        }
      }

      const requestData: any = {
        requestType,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        message: message.trim() || null,
      };

      if (requestType === "CONSULTATION") {
        requestData.eventTypeId = eventTypeId;
        // Combine date and time into ISO string
        const dateTime = new Date(`${requestedDate}T${requestedTime}`);
        requestData.requestedDate = dateTime.toISOString();
      } else {
        requestData.mealPlanType = mealPlanType;
        const selectedMealPlan = MEAL_PLAN_TYPES.find(mp => mp.id === mealPlanType);
        requestData.price = selectedMealPlan?.price || 0;
        requestData.currency = selectedMealPlan?.currency || "NGN";
      }

      const response = await fetch("/api/session-request", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session request");
      }

      // Success - close modal and refresh list
      handleClose();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session request");
      console.error("Error creating session request:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedMealPlan = MEAL_PLAN_TYPES.find(mp => mp.id === mealPlanType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#262626]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#262626] flex-shrink-0">
              <Send className="h-5 w-5 text-[#f9fafb]" />
            </div>
            <h2 className="text-lg font-semibold text-[#f9fafb]">
              Send Session Request
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-[#9ca3af] hover:text-[#f9fafb] transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-md p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Request Type Selection */}
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Request Type <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRequestType("CONSULTATION")}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  requestType === "CONSULTATION"
                    ? "border-[#404040] bg-[#262626] text-[#f9fafb]"
                    : "border-[#262626] bg-transparent text-[#9ca3af] hover:bg-[#262626]"
                }`}
              >
                <Calendar className="h-5 w-5 mx-auto mb-2" />
                <div className="text-sm font-medium">Consultation</div>
                <div className="text-xs mt-1">Client selects preferred slot</div>
              </button>
              <button
                type="button"
                onClick={() => setRequestType("MEAL_PLAN")}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  requestType === "MEAL_PLAN"
                    ? "border-[#404040] bg-[#262626] text-[#f9fafb]"
                    : "border-[#262626] bg-transparent text-[#9ca3af] hover:bg-[#262626]"
                }`}
              >
                <Send className="h-5 w-5 mx-auto mb-2" />
                <div className="text-sm font-medium">Meal Plan</div>
                <div className="text-xs mt-1">Payment only, no booking</div>
              </button>
            </div>
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Select Client <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedClientId || ""}
              onChange={(e) => setSelectedClientId(e.target.value || null)}
              disabled={loadingClients || clients.length === 0}
              className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-[#404040] appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="" className="bg-[#0a0a0a] text-[#f9fafb]">
                {loadingClients ? "Loading clients..." : clients.length === 0 ? "No previous clients found" : "Select a client..."}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id} className="bg-[#0a0a0a] text-[#f9fafb]">
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
            {loadingClients && (
              <p className="mt-1 text-xs text-[#9ca3af]">Fetching clients...</p>
            )}
            {!loadingClients && clients.length === 0 && (
              <p className="mt-1 text-xs text-[#9ca3af]">No clients found. Users who have booked with you will appear here.</p>
            )}
          </div>

          {/* Client Information Display (Read-only) */}
          {selectedClientId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                  Client Name
                </label>
                <Input
                  type="text"
                  value={clientName}
                  disabled
                  className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af] opacity-50 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                  Client Email
                </label>
                <Input
                  type="email"
                  value={clientEmail}
                  disabled
                  className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af] opacity-50 cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {/* Consultation-specific fields */}
          {requestType === "CONSULTATION" && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                  Event Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={eventTypeId}
                  onChange={(e) => setEventTypeId(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-[#404040] appearance-none cursor-pointer"
                  required
                >
                  {eventTypes.map((et) => (
                    <option key={et.id} value={et.id} className="bg-[#0a0a0a] text-[#f9fafb]">
                      {et.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Meal Plan-specific fields */}
          {requestType === "MEAL_PLAN" && (
            <div>
              <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                Meal Plan Type <span className="text-red-400">*</span>
              </label>
              <select
                value={mealPlanType}
                onChange={(e) => setMealPlanType(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-[#404040] appearance-none cursor-pointer"
                required
              >
                <option value="" className="bg-[#0a0a0a] text-[#f9fafb]">Select meal plan...</option>
                {MEAL_PLAN_TYPES.map((mp) => (
                  <option key={mp.id} value={mp.id} className="bg-[#0a0a0a] text-[#f9fafb]">
                    {mp.name} - ₦{mp.price.toLocaleString()}
                  </option>
                ))}
              </select>
              {selectedMealPlan && (
                <p className="mt-2 text-sm text-[#9ca3af]">
                  Price: ₦{selectedMealPlan.price.toLocaleString()} {selectedMealPlan.currency}
                </p>
              )}
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Message (Optional)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message for the client..."
              rows={3}
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-[#404040] resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#262626]">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
