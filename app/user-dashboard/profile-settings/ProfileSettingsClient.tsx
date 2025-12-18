"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { User, Upload } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { NIGERIA_STATES } from "@/constants/nigeriaStates";

interface UserProfile {
  name: string;
  email: string;
  image: string | null;
  age?: number | null;
  occupation?: string | null;
  medicalCondition?: string | null;
  monthlyFoodBudget?: number | null;
  gender?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
}

interface ProfileSettingsClientProps {
  initialUserProfile: UserProfile | null;
}

export default function ProfileSettingsClient({ initialUserProfile }: ProfileSettingsClientProps) {
  // Use server-provided data directly - no sessionStorage needed
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialUserProfile);
  const [saving, setSaving] = useState(false);

  // Fetch additional profile data (age, occupation, etc.) from API if needed
  useEffect(() => {
    const fetchAdditionalProfileData = async () => {
      if (!initialUserProfile) return;

      try {
        const response = await fetch("/api/user/profile", {
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          const profile = data.profile;
          
          // Merge with initial profile data - preserve name/email/image from initialUserProfile
          // Only update additional fields (age, occupation, etc.)
          setUserProfile({
            name: initialUserProfile.name, // Preserve from server-side
            email: initialUserProfile.email, // Preserve from server-side
            image: initialUserProfile.image, // Preserve from server-side
            age: profile?.age || null,
            occupation: profile?.occupation || null,
            medicalCondition: profile?.medical_condition || null,
            monthlyFoodBudget: profile?.monthly_food_budget || null,
            gender: profile?.gender || null,
            phone: profile?.phone || null,
            city: profile?.city || null,
            state: profile?.state || null,
          });
        }
      } catch (err) {
        console.error("Error fetching additional profile data:", err);
      }
    };

    fetchAdditionalProfileData();
  }, [initialUserProfile]);

  const handleSave = async () => {
    if (!userProfile) return;
    
    try {
      setSaving(true);
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          age: userProfile.age ? parseInt(userProfile.age.toString()) : null,
          occupation: userProfile.occupation || null,
          medical_condition: userProfile.medicalCondition || null,
          monthly_food_budget: userProfile.monthlyFoodBudget ? parseFloat(userProfile.monthlyFoodBudget.toString()) : null,
          gender: userProfile.gender || null,
          phone: userProfile.phone || null,
          city: userProfile.city || null,
          state: userProfile.state || null,
        }),
      });

      if (response.ok) {
        alert("Profile updated successfully!");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to update" }));
        alert(errorData.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      <UserDashboardSidebar initialUserProfile={initialUserProfile ? { name: initialUserProfile.name, image: initialUserProfile.image } : undefined} />
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Profile Settings</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Manage your profile information.
            </p>
          </div>

          {/* Profile Form */}
          <div className="space-y-6 max-w-2xl">
            {/* Profile Picture */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                {userProfile?.image ? (
                  <div className="w-20 h-20 rounded-full overflow-hidden">
                    <Image
                      src={userProfile.image}
                      alt={userProfile.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center">
                    {userProfile ? (
                      <span className="text-white text-lg font-semibold">
                        {getInitials(userProfile.name)}
                      </span>
                    ) : (
                  <User className="h-10 w-10 text-[#9ca3af]" />
                    )}
                </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="profile-image-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      try {
                        const formData = new FormData();
                        formData.append("file", file);

                        const response = await fetch("/api/user/upload-profile-image", {
                          method: "POST",
                          credentials: "include",
                          body: formData,
                        });

                        if (response.ok) {
                          const data = await response.json();
                          setUserProfile((prev) => ({
                            ...prev!,
                            image: data.imageUrl,
                          }));
                          // No sessionStorage - data managed in component state
                        }
                      } catch (err) {
                        console.error("Error uploading image:", err);
                        alert("Failed to upload image. Please try again.");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                    onClick={() => {
                      document.getElementById("profile-image-upload")?.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[#9ca3af]">
                Upload a new profile picture to replace your current one.
              </p>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Full Name
              </label>
              <Input
                type="text"
                value={userProfile?.name || ""}
                disabled
                className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af] opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-[#9ca3af]">
                Name is synced from your Google account.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Email
              </label>
              <Input
                type="email"
                value={userProfile?.email || ""}
                disabled
                className="bg-[#0a0a0a] border-[#262626] text-[#9ca3af] opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-[#9ca3af]">
                Email is synced from your Google account.
              </p>
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Gender
              </label>
              <div className="relative">
                <select
                  value={userProfile?.gender || ""}
                  onChange={(e) => setUserProfile((prev) => ({
                    ...prev!,
                    gender: e.target.value || null,
                  }))}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Phone Number
              </label>
              <Input
                type="tel"
                value={userProfile?.phone || ""}
                onChange={(e) => setUserProfile((prev) => ({
                  ...prev!,
                  phone: e.target.value || null,
                }))}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                placeholder="Enter your phone number"
              />
            </div>

            {/* City */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                City
              </label>
              <Input
                type="text"
                value={userProfile?.city || ""}
                onChange={(e) => setUserProfile((prev) => ({
                  ...prev!,
                  city: e.target.value || null,
                }))}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                placeholder="Enter your city"
              />
            </div>

            {/* State */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                State
              </label>
              <div className="relative">
                <select
                  value={userProfile?.state || ""}
                  onChange={(e) => setUserProfile((prev) => ({
                    ...prev!,
                    state: e.target.value || null,
                  }))}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
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
            </div>

            {/* Age */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Age
              </label>
              <Input
                type="number"
                value={userProfile?.age?.toString() || ""}
                onChange={(e) => setUserProfile((prev) => ({
                  ...prev!,
                  age: e.target.value ? parseInt(e.target.value) : null,
                }))}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                placeholder="Enter your age"
                min="1"
                max="120"
              />
            </div>

            {/* Occupation */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Occupation
              </label>
              <Input
                type="text"
                value={userProfile?.occupation || ""}
                onChange={(e) => setUserProfile((prev) => ({
                  ...prev!,
                  occupation: e.target.value || null,
                }))}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                placeholder="Enter your occupation"
              />
            </div>

            {/* Medical Condition */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Medical Condition
              </label>
              <Textarea
                value={userProfile?.medicalCondition || ""}
                onChange={(e) => setUserProfile((prev) => ({
                  ...prev!,
                  medicalCondition: e.target.value || null,
                }))}
                rows={3}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                placeholder="Any medical conditions or health concerns..."
              />
            </div>

            {/* Monthly Food Budget */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#D4D4D4]">
                Monthly Food Budget (NGN)
              </label>
              <Input
                type="number"
                value={userProfile?.monthlyFoodBudget?.toString() || ""}
                onChange={(e) => setUserProfile((prev) => ({
                  ...prev!,
                  monthlyFoodBudget: e.target.value ? parseFloat(e.target.value) : null,
                }))}
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                placeholder="Enter your monthly food budget"
                min="0"
                step="1000"
              />
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
