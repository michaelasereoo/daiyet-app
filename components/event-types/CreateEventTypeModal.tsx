"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface CreateEventTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateEventTypeModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEventTypeModalProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("NGN");
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from title
  useEffect(() => {
    if (title && !slug) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  }, [title, slug]);

  const handleClose = () => {
    setTitle("");
    setSlug("");
    setDescription("");
    setDuration("30");
    setPrice("0");
    setCurrency("NGN");
    setActive(true);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!title || !slug) {
        setError("Title and slug are required");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch("/api/event-types", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          length: parseInt(duration) || 30,
          price: parseFloat(price) || 0,
          currency: currency || "NGN",
          active: active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create event type");
      }

      // Success - close modal and refresh list
      handleClose();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event type");
      console.error("Error creating event type:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#262626]">
          <h2 className="text-lg font-semibold text-[#f9fafb]">
            Create New Event Type
          </h2>
          <button
            onClick={handleClose}
            className="text-[#9ca3af] hover:text-[#f9fafb] transition-colors"
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

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
              placeholder="e.g., Initial Consultation"
              required
              autoFocus
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              URL Slug <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
              placeholder="initial-consultation"
              required
            />
            <p className="mt-1 text-xs text-[#9ca3af]">
              Used in the booking URL. Auto-generated from title if left blank.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
              placeholder="Describe what this event type is for..."
              rows={3}
            />
          </div>

          {/* Duration and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                Duration (minutes)
              </label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
                placeholder="30"
                min="5"
                step="5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                Price
              </label>
              <div className="flex">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-[#0a0a0a] border border-r-0 border-[#262626] rounded-l-md px-3 text-sm text-[#f9fafb] focus:outline-none focus:ring-0"
                >
                  <option value="NGN">₦</option>
                  <option value="USD">$</option>
                  <option value="EUR">€</option>
                  <option value="GBP">£</option>
                </select>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-[#0a0a0a] border-[#262626] border-l-0 rounded-l-none text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-[#262626] bg-[#0a0a0a] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="active" className="text-sm text-[#D4D4D4] cursor-pointer">
              Active (event type will be visible for booking)
            </label>
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
              disabled={isSubmitting || !title || !slug}
              className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Event Type"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
