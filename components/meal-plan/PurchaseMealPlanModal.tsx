"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, X, Loader2 } from "lucide-react";
import { formatDietitianName } from "@/lib/utils/dietitian-name";

interface Dietitian {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface PurchaseMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPackage: { id: string; name: string; price: number; currency: string } | null;
  onCheckout: (data: { dietitianId: string; dietitianName: string; packageName: string; packageId: string; price: number }) => void;
}

export function PurchaseMealPlanModal({ 
  isOpen, 
  onClose, 
  selectedPackage,
  onCheckout 
}: PurchaseMealPlanModalProps) {
  const [selectedDietitian, setSelectedDietitian] = useState<string>("");
  const [dietitians, setDietitians] = useState<Dietitian[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available dietitians when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDietitian("");
      fetchDietitians();
    }
  }, [isOpen]);

  const fetchDietitians = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dietitians", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setDietitians(data.dietitians || []);
      } else {
        setError("Failed to load dietitians");
      }
    } catch (err) {
      console.error("Error fetching dietitians:", err);
      setError("Failed to load dietitians");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedDietitianData = dietitians.find(d => d.id === selectedDietitian);

  const handleCheckout = () => {
    if (selectedDietitian && selectedPackage && selectedDietitianData) {
      onCheckout({
        dietitianId: selectedDietitian,
        dietitianName: selectedDietitianData.name,
        packageName: selectedPackage.name,
        packageId: selectedPackage.id,
        price: selectedPackage.price,
      });
      setSelectedDietitian("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl p-6 shadow-lg">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#f9fafb]">Purchase Meal Plan</h2>
          <button
            onClick={onClose}
            className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 mb-6">
          {/* Selected Package (Read-only) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Meal Plan Package
            </label>
            <div className="bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2">
              {selectedPackage ? selectedPackage.name : "No package selected"}
            </div>
            {selectedPackage && (
              <div className="text-sm text-[#9ca3af] mt-1">
                Price: ₦{selectedPackage.price.toLocaleString()}
              </div>
            )}
          </div>

          {/* Select Dietitian */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Select Dietitian
            </label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-[#9ca3af] text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading dietitians...
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm py-2">{error}</div>
            ) : dietitians.length === 0 ? (
              <div className="text-[#9ca3af] text-sm py-2">
                No dietitians available. Please try again later.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedDietitian}
                  onChange={(e) => setSelectedDietitian(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
                >
                  <option value="">Select a dietitian...</option>
                  {dietitians.map((dietitian) => (
                    <option key={dietitian.id} value={dietitian.id}>
                      {formatDietitianName(dietitian.name)} ({dietitian.email})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
              </div>
            )}
            <p className="text-xs text-[#9ca3af] mt-1">
              Select a licensed dietitian to prepare your meal plan
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={!selectedDietician || !selectedPackage}
            className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
