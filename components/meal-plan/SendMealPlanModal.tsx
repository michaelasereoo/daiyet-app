"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, ChevronDown, X } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  sessionRequestId?: string;
  mealPlanType?: string;
}

interface SendMealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { userId: string; sessionRequestId?: string; packageName: string; file: File }) => void;
}

const mealPlanPackages = [
  "Weight Loss Plan",
  "Muscle Gain Plan",
  "Diabetes Management Plan",
  "General Wellness Plan",
];

export function SendMealPlanModal({ isOpen, onClose, onSend }: SendMealPlanModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fetch users with pending meal plan requests
  useEffect(() => {
    if (isOpen) {
      fetchPendingMealPlanUsers();
    }
  }, [isOpen]);

  const fetchPendingMealPlanUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/session-request", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const mealPlanRequests = (data.requests || []).filter(
          (req: any) => req.requestType === "MEAL_PLAN" && req.status === "PENDING"
        );

        const usersData: User[] = mealPlanRequests.map((req: any) => ({
          id: req.clientEmail, // Using email as identifier
          name: req.clientName,
          email: req.clientEmail,
          sessionRequestId: req.id,
          mealPlanType: req.mealPlanType,
        }));

        setUsers(usersData);
      }
    } catch (err) {
      console.error("Error fetching pending meal plan users:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleSend = () => {
    if (selectedUser && selectedPackage && selectedFile) {
      const selectedUserData = users.find(u => u.id === selectedUser);
      onSend({
        userId: selectedUser,
        sessionRequestId: selectedUserData?.sessionRequestId,
        packageName: selectedPackage,
        file: selectedFile,
      });
      // Reset form
      setSelectedUser("");
      setSelectedPackage("");
      setSelectedFile(null);
      setFileName("");
      setError(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl p-6 shadow-lg">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#f9fafb]">Send Meal Plan</h2>
          <button
            onClick={onClose}
            className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 mb-6">
          {/* Select User */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Select User
            </label>
            <div className="relative">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                disabled={loading}
                className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{loading ? "Loading users..." : "Select a user..."}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email}) {user.mealPlanType ? `- ${user.mealPlanType}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
            </div>
          </div>

          {/* Select Meal Plan Package */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Meal Plan Package
            </label>
            <div className="relative">
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
              >
                <option value="">Select a package...</option>
                {mealPlanPackages.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
            </div>
          </div>

          {/* Upload PDF */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Upload PDF
            </label>
            <div className="border border-[#262626] rounded-lg p-4 bg-[#0a0a0a]">
              {!selectedFile ? (
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <Upload className="h-8 w-8 text-[#9ca3af] mb-2" />
                  <span className="text-sm text-[#9ca3af] mb-1">Click to upload PDF</span>
                  <span className="text-xs text-[#9ca3af]">or drag and drop</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#f9fafb]">{fileName}</span>
                  <button
                    onClick={handleRemoveFile}
                    className="text-[#D4D4D4] hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

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
            onClick={handleSend}
            disabled={!selectedUser || !selectedPackage || !selectedFile}
            className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
